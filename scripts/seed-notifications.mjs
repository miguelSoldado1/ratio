import { createHash } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed:notifications -- --user-id=<user-id> [--limit=26] [--randomize] [--seed=<seed>] [--current-date] [--dry-run]
// Required env: DATABASE_URL.
// Optional env: SEED_NOTIFICATIONS_USER_ID, SEED_NOTIFICATIONS_LIMIT, and SEED_NOTIFICATIONS_SEED; CLI flags override them.
// Uses existing users and the target user's existing reviews to create notification grouping scenarios.
// Reply scenarios also create their source replies/likes so notification hydration can validate and render them.

const defaultSeed = "ratio-notifications";
const minuteMs = 60 * 1000;
const notificationReplyNamespace = "ratio-notifications-replies-v1";
const seedStartedAt = new Date();

const scenarioSpecs = [
  { actorCount: 4, minutesAgo: 5, type: "user_followed" },
  { actorCount: 3, minutesAgo: 9, type: "reply_liked" },
  { actorCount: 2, minutesAgo: 15, type: "review_replied" },
  { actorCount: 2, minutesAgo: 55, type: "user_followed" },
  { actorCount: 5, minutesAgo: 2, type: "user_followed" },
  { actorCount: 3, minutesAgo: 12, type: "user_followed" },
  { actorCount: 2, minutesAgo: 24, type: "user_followed" },
  { actorCount: 1, minutesAgo: 38, type: "user_followed" },
  { actorCount: 3, minutesAgo: 72, type: "review_liked" },
  { actorCount: 1, minutesAgo: 96, type: "user_followed" },
];
const defaultNotificationLimit = scenarioSpecs.reduce((sum, scenario) => sum + scenario.actorCount, 0);

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedNotifications();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

async function seedNotifications() {
  validateOptions(options);

  const rng = createSeededRandom(options.seed);
  const scenarioPlans = getScenarioSpecs(options.limit, rng, options.randomize);
  const reviewTargetScenarioCount = scenarioPlans.filter((scenario) => scenario.type !== "user_followed").length;

  const [targetUser] = await db`
    select id, name, username, display_username
    from "user"
    where id = ${options.userId}
  `;

  if (!targetUser) {
    throw new Error(`No user found for id ${options.userId}`);
  }

  const targetReviews = await db`
    select review.id, review.album_id, album.title as album_title
    from review
    inner join album on album.id = review.album_id
    where review.user_id = ${options.userId}
    order by review.created_at desc, review.id desc
    limit ${reviewTargetScenarioCount}
  `;

  if (reviewTargetScenarioCount > 0 && targetReviews.length === 0) {
    throw new Error(`Need at least 1 existing review by ${options.userId}; found 0.`);
  }

  const actors = await db`
    select id, name, username, display_username
    from "user"
    where id <> ${options.userId}
      and username is not null
      and banned is not true
    order by created_at desc, id desc
    limit ${options.limit}
  `;

  if (actors.length < options.limit) {
    throw new Error(`Need at least ${options.limit} eligible existing actor users; found ${actors.length}.`);
  }

  const scenarioActors = options.randomize ? shuffle(actors, rng) : actors;
  const scenarios = buildScenarios({
    actors: scenarioActors,
    currentDate: options.currentDate,
    scenarioPlans,
    targetReviews,
  });

  console.log(`Prepared ${options.limit} notification events for ${formatUserName(targetUser)} (${targetUser.id}).`);
  console.log(
    `Using ${options.randomize ? "randomized" : "deterministic"} notification scenario with seed "${options.seed}".`
  );
  if (options.currentDate) {
    console.log("Using the current created_at timestamp for every seeded notification.");
  }
  for (const scenario of scenarios) {
    console.log(formatScenarioPreview(scenario));
  }

  if (options.dryRun) {
    return console.log("Dry run complete. No rows changed.");
  }

  const summary = await db.begin(async (transaction) => {
    const counts = {
      changedNotifications: 0,
      insertedFollows: 0,
      insertedLikes: 0,
      upsertedReplies: 0,
      upsertedReplyLikes: 0,
    };

    for (const scenario of scenarios) {
      switch (scenario.type) {
        case "review_liked":
          await seedReviewLikedScenario(transaction, scenario, counts);
          break;
        case "review_replied":
          await seedReviewRepliedScenario(transaction, scenario, counts);
          break;
        case "reply_liked":
          await seedReplyLikedScenario(transaction, scenario, counts);
          break;
        case "user_followed":
          await seedUserFollowedScenario(transaction, scenario, counts);
          break;
        default:
          throw new Error(`Unsupported notification scenario type: ${scenario.type}`);
      }
    }

    return counts;
  });

  console.log(
    `Done. Upserted ${summary.changedNotifications} notifications, ${summary.insertedLikes} review likes, ${summary.insertedFollows} follows, ${summary.upsertedReplies} replies, and ${summary.upsertedReplyLikes} reply likes.`
  );
}

/** Seeds review-like sources and their per-actor notification rows. */
async function seedReviewLikedScenario(transaction, scenario, counts) {
  for (const actor of scenario.actors) {
    const likeRows = await transaction`
      insert into review_like (review_id, user_id, created_at)
      values (${scenario.review.id}, ${actor.id}, ${actor.createdAt})
      on conflict (review_id, user_id) do update set created_at = excluded.created_at
      returning user_id
    `;
    counts.insertedLikes += likeRows.length;

    const notificationRows = await transaction`
      insert into notification (recipient_user_id, actor_user_id, type, review_id, created_at, seen_at)
      values (${options.userId}, ${actor.id}, 'review_liked', ${scenario.review.id}, ${actor.createdAt}, null)
      on conflict (recipient_user_id, actor_user_id, type, review_id) where type = 'review_liked'
      do update set created_at = excluded.created_at, seen_at = excluded.seen_at
      returning id
    `;
    counts.changedNotifications += notificationRows.length;
  }
}

/** Seeds chronological replies and leaves the thread notification pointing at the newest source reply. */
async function seedReviewRepliedScenario(transaction, scenario, counts) {
  const chronologicalActors = [...scenario.actors].sort(
    (firstActor, secondActor) => firstActor.createdAt.getTime() - secondActor.createdAt.getTime()
  );

  for (const actor of chronologicalActors) {
    const replyId = getNotificationReplyId(scenario.index, `review-replied:${actor.id}`);
    const replyRows = await transaction`
      insert into review_reply (id, review_id, user_id, body, created_at)
      values (
        ${replyId},
        ${scenario.review.id},
        ${actor.id},
        ${`Seeded reply notification from ${formatUserName(actor)}.`},
        ${actor.createdAt}
      )
      on conflict (id) do update set
        review_id = excluded.review_id,
        user_id = excluded.user_id,
        body = excluded.body,
        created_at = excluded.created_at
      returning id
    `;
    counts.upsertedReplies += replyRows.length;

    const notificationRows = await transaction`
      insert into notification (recipient_user_id, actor_user_id, type, review_id, reply_id, created_at, seen_at)
      values (
        ${options.userId},
        ${actor.id},
        'review_replied',
        ${scenario.review.id},
        ${replyId},
        ${actor.createdAt},
        null
      )
      on conflict (recipient_user_id, type, review_id) where type = 'review_replied'
      do update set
        actor_user_id = excluded.actor_user_id,
        reply_id = excluded.reply_id,
        created_at = excluded.created_at,
        seen_at = excluded.seen_at
      returning id
    `;
    counts.changedNotifications += notificationRows.length;
  }
}

/** Seeds one target-owned reply, its grouped source likes, and matching notification rows. */
async function seedReplyLikedScenario(transaction, scenario, counts) {
  const replyId = getNotificationReplyId(scenario.index, "reply-liked:target");
  const oldestLikeAt = scenario.actors.at(-1)?.createdAt ?? seedStartedAt;
  const replyCreatedAt = new Date(oldestLikeAt.getTime() - minuteMs);
  const replyRows = await transaction`
    insert into review_reply (id, review_id, user_id, body, created_at)
    values (
      ${replyId},
      ${scenario.review.id},
      ${options.userId},
      'Seeded reply for grouped reply-like notifications.',
      ${replyCreatedAt}
    )
    on conflict (id) do update set
      review_id = excluded.review_id,
      user_id = excluded.user_id,
      body = excluded.body,
      created_at = excluded.created_at
    returning id
  `;
  counts.upsertedReplies += replyRows.length;

  for (const actor of scenario.actors) {
    const likeRows = await transaction`
      insert into review_reply_like (reply_id, user_id, created_at)
      values (${replyId}, ${actor.id}, ${actor.createdAt})
      on conflict (reply_id, user_id) do update set created_at = excluded.created_at
      returning reply_id
    `;
    counts.upsertedReplyLikes += likeRows.length;

    const notificationRows = await transaction`
      insert into notification (recipient_user_id, actor_user_id, type, reply_id, created_at, seen_at)
      values (${options.userId}, ${actor.id}, 'reply_liked', ${replyId}, ${actor.createdAt}, null)
      on conflict (recipient_user_id, actor_user_id, type, reply_id) where type = 'reply_liked'
      do update set created_at = excluded.created_at, seen_at = excluded.seen_at
      returning id
    `;
    counts.changedNotifications += notificationRows.length;
  }
}

/** Seeds follow sources and their per-actor notification rows. */
async function seedUserFollowedScenario(transaction, scenario, counts) {
  for (const actor of scenario.actors) {
    const followRows = await transaction`
      insert into user_follow (follower_id, following_id, created_at)
      values (${actor.id}, ${options.userId}, ${actor.createdAt})
      on conflict (follower_id, following_id) do update set created_at = excluded.created_at
      returning follower_id
    `;
    counts.insertedFollows += followRows.length;

    const notificationRows = await transaction`
      insert into notification (recipient_user_id, actor_user_id, type, review_id, created_at, seen_at)
      values (${options.userId}, ${actor.id}, 'user_followed', null, ${actor.createdAt}, null)
      on conflict (recipient_user_id, actor_user_id, type) where type = 'user_followed'
      do update set created_at = excluded.created_at, seen_at = excluded.seen_at
      returning id
    `;
    counts.changedNotifications += notificationRows.length;
  }
}

function buildScenarios({ actors, currentDate, scenarioPlans, targetReviews }) {
  let actorOffset = 0;
  let reviewOffset = 0;

  return scenarioPlans.map((spec, index) => {
    const scenarioActors = actors.slice(actorOffset, actorOffset + spec.actorCount).map((actor, index) => ({
      ...actor,
      createdAt: currentDate ? seedStartedAt : new Date(seedStartedAt.getTime() - (spec.minutesAgo + index) * minuteMs),
    }));

    actorOffset += spec.actorCount;

    const scenario = {
      ...spec,
      actors: scenarioActors,
      index,
      review: null,
    };

    if (spec.type !== "user_followed") {
      scenario.review = targetReviews[reviewOffset] ?? targetReviews.at(-1);
      reviewOffset += 1;
    }

    return scenario;
  });
}

function formatScenarioPreview(scenario) {
  const actorNames = scenario.actors.map(formatUserName).join(", ");

  if (scenario.type === "review_liked") {
    return `- unread ${scenario.actorCount}-actor review_liked group for "${scenario.review.album_title}": ${actorNames}`;
  }

  if (scenario.type === "review_replied") {
    return `- unread review_replied notification on "${scenario.review.album_title}" from the latest of: ${actorNames}`;
  }

  if (scenario.type === "reply_liked") {
    return `- unread ${scenario.actorCount}-actor reply_liked group on "${scenario.review.album_title}": ${actorNames}`;
  }

  return `- ${scenario.actorCount} unread user_followed notifications: ${actorNames}`;
}

function getOptions() {
  const cliOptions = {
    currentDate: false,
    dryRun: false,
    limit: Number(process.env.SEED_NOTIFICATIONS_LIMIT ?? defaultNotificationLimit),
    randomize: false,
    seed: process.env.SEED_NOTIFICATIONS_SEED ?? defaultSeed,
    userId: process.env.SEED_NOTIFICATIONS_USER_ID ?? "",
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--dry-run") {
      cliOptions.dryRun = true;
      continue;
    }

    if (argument === "--current-date") {
      cliOptions.currentDate = true;
      continue;
    }

    if (argument === "--randomize") {
      cliOptions.randomize = true;
      cliOptions.seed = process.env.SEED_NOTIFICATIONS_SEED ?? `ratio-notifications-${Date.now()}`;
      continue;
    }

    if (argument.startsWith("--user-id=")) {
      cliOptions.userId = argument.slice("--user-id=".length);
      continue;
    }

    if (argument.startsWith("--limit=")) {
      cliOptions.limit = Number(argument.slice("--limit=".length));
      continue;
    }

    if (argument.startsWith("--seed=")) {
      cliOptions.seed = argument.slice("--seed=".length);
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return cliOptions;
}

function getScenarioSpecs(limit, rng, randomize) {
  if (randomize) {
    return getRandomScenarioSpecs(limit, rng);
  }

  const selectedScenarios = [];
  let remainingNotifications = limit;

  for (const scenario of scenarioSpecs) {
    if (remainingNotifications <= 0) {
      break;
    }

    const actorCount = Math.min(scenario.actorCount, remainingNotifications);
    selectedScenarios.push({ ...scenario, actorCount });
    remainingNotifications -= actorCount;
  }

  return selectedScenarios;
}

function getRandomScenarioSpecs(limit, rng) {
  const selectedScenarios = [];
  let remainingNotifications = limit;
  let minutesAgo = 2;

  while (remainingNotifications > 0) {
    const type = getRandomNotificationType(rng);
    const maxActorCount = getNotificationTypeMaxActorCount(type);
    const actorCount = getRandomInteger(rng, 1, Math.min(maxActorCount, remainingNotifications));

    selectedScenarios.push({
      actorCount,
      minutesAgo,
      type,
    });

    remainingNotifications -= actorCount;
    minutesAgo += getRandomInteger(rng, 3, 18);
  }

  return selectedScenarios;
}

/** Selects a seeded notification type while keeping follows and review likes the common cases. */
function getRandomNotificationType(rng) {
  const typeRoll = rng();

  if (typeRoll < 0.45) return "user_followed";
  if (typeRoll < 0.7) return "review_liked";
  if (typeRoll < 0.85) return "review_replied";
  return "reply_liked";
}

/** Caps actors per group so randomized notification copy remains useful and readable. */
function getNotificationTypeMaxActorCount(type) {
  if (type === "review_liked") return 8;
  if (type === "review_replied") return 2;
  return 4;
}

function validateOptions(cliOptions) {
  if (!cliOptions.userId.trim()) {
    throw new Error("User id is required");
  }

  if (!cliOptions.seed.trim()) {
    throw new Error("Seed must not be empty");
  }

  if (!Number.isInteger(cliOptions.limit) || cliOptions.limit < 1 || cliOptions.limit > defaultNotificationLimit) {
    throw new Error(`Limit must be an integer from 1 to ${defaultNotificationLimit}`);
  }
}

/** Returns a stable RFC 4122 UUID for source replies owned by one notification scenario. */
function getNotificationReplyId(scenarioIndex, discriminator) {
  const hex = createHash("sha256")
    .update(`${notificationReplyNamespace}:${options.seed}:${options.userId}:${scenarioIndex}:${discriminator}`)
    .digest("hex")
    .slice(0, 32);
  const uuidHex = `${hex.slice(0, 12)}4${hex.slice(13, 16)}8${hex.slice(17)}`;

  return `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20)}`;
}

function shuffle(values, rng) {
  const shuffledValues = [...values];

  for (let index = shuffledValues.length - 1; index > 0; index -= 1) {
    const randomIndex = getRandomInteger(rng, 0, index);
    [shuffledValues[index], shuffledValues[randomIndex]] = [shuffledValues[randomIndex], shuffledValues[index]];
  }

  return shuffledValues;
}

function createSeededRandom(seed) {
  const modulus = 2_147_483_647;
  let state = 1;

  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) % modulus;
  }

  return () => {
    state = (state * 48_271) % modulus;
    return state / modulus;
  };
}

function getRandomNumber(rng, min, max) {
  return min + rng() * (max - min);
}

function getRandomInteger(rng, min, max) {
  return Math.floor(getRandomNumber(rng, min, max + 1));
}

function formatUserName(user) {
  return user.display_username || user.username || user.name;
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
