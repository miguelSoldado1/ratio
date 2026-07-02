import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed:notifications -- --user-id=<user-id> [--limit=22] [--randomize] [--seed=<seed>] [--current-date] [--dry-run]
// Required env: DATABASE_URL.
// Optional env: SEED_NOTIFICATIONS_USER_ID, SEED_NOTIFICATIONS_LIMIT, and SEED_NOTIFICATIONS_SEED; CLI flags override them.
// Uses existing users and the target user's existing reviews to create notification grouping scenarios.

const defaultSeed = "ratio-notifications";
const minuteMs = 60 * 1000;
const seedStartedAt = new Date();

const scenarioSpecs = [
  { actorCount: 4, minutesAgo: 5, type: "user_followed" },
  { actorCount: 2, minutesAgo: 55, type: "user_followed" },
  { actorCount: 5, minutesAgo: 2, type: "user_followed" },
  { actorCount: 3, minutesAgo: 12, type: "user_followed" },
  { actorCount: 2, minutesAgo: 24, type: "user_followed" },
  { actorCount: 1, minutesAgo: 38, type: "user_followed" },
  { actorCount: 3, minutesAgo: 72, type: "review_liked" },
  { actorCount: 2, minutesAgo: 96, type: "user_followed" },
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
  const reviewLikeScenarioCount = scenarioPlans.filter((scenario) => scenario.type === "review_liked").length;

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
    limit ${reviewLikeScenarioCount}
  `;

  if (reviewLikeScenarioCount > 0 && targetReviews.length === 0) {
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

  console.log(`Prepared ${options.limit} notifications for ${formatUserName(targetUser)} (${targetUser.id}).`);
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
    let insertedFollows = 0;
    let insertedLikes = 0;
    let changedNotifications = 0;

    for (const scenario of scenarios) {
      for (const actor of scenario.actors) {
        if (scenario.type === "review_liked") {
          const likeRows = await transaction`
            insert into review_like (review_id, user_id, created_at)
            values (${scenario.review.id}, ${actor.id}, ${actor.createdAt})
            on conflict (review_id, user_id) do update set
              created_at = excluded.created_at
            returning user_id
          `;

          insertedLikes += likeRows.length;

          const notificationRows = await transaction`
            insert into notification (recipient_user_id, actor_user_id, type, review_id, created_at, seen_at)
            values (
              ${options.userId},
              ${actor.id},
              'review_liked',
              ${scenario.review.id},
              ${actor.createdAt},
              null
            )
            on conflict (recipient_user_id, actor_user_id, type, review_id)
              where type = 'review_liked'
            do update set
              created_at = excluded.created_at,
              seen_at = excluded.seen_at
            returning id
          `;

          changedNotifications += notificationRows.length;
          continue;
        }

        const followRows = await transaction`
          insert into user_follow (follower_id, following_id, created_at)
          values (${actor.id}, ${options.userId}, ${actor.createdAt})
          on conflict (follower_id, following_id) do update set
            created_at = excluded.created_at
          returning follower_id
        `;

        insertedFollows += followRows.length;

        const notificationRows = await transaction`
          insert into notification (recipient_user_id, actor_user_id, type, review_id, created_at, seen_at)
          values (${options.userId}, ${actor.id}, 'user_followed', null, ${actor.createdAt}, null)
          on conflict (recipient_user_id, actor_user_id, type)
            where type = 'user_followed'
          do update set
            created_at = excluded.created_at,
            seen_at = excluded.seen_at
          returning id
        `;

        changedNotifications += notificationRows.length;
      }
    }

    return { changedNotifications, insertedFollows, insertedLikes };
  });

  console.log(
    `Done. Upserted ${summary.changedNotifications} notifications, ${summary.insertedLikes} likes, and ${summary.insertedFollows} follows.`
  );
}

function buildScenarios({ actors, currentDate, scenarioPlans, targetReviews }) {
  let actorOffset = 0;
  let reviewOffset = 0;

  return scenarioPlans.map((spec) => {
    const scenarioActors = actors.slice(actorOffset, actorOffset + spec.actorCount).map((actor, index) => ({
      ...actor,
      createdAt: currentDate ? seedStartedAt : new Date(seedStartedAt.getTime() - (spec.minutesAgo + index) * minuteMs),
    }));

    actorOffset += spec.actorCount;

    const scenario = {
      ...spec,
      actors: scenarioActors,
      review: null,
    };

    if (spec.type === "review_liked") {
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
    const type = rng() < 0.65 ? "user_followed" : "review_liked";
    const maxActorCount = type === "review_liked" ? 8 : 4;
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
