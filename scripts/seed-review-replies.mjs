import { createHash } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed:review-replies -- --user-id=<user-id> [--dry-run]
// Required env: DATABASE_URL.
// Optional env: SEED_REVIEW_REPLIES_USER_ID; CLI flags override it.
// Layers deterministic replies and reply likes onto the default seed:feed scenario.
// Reruns update only this script's deterministic rows and preserve manually created replies.
// Does not create notifications; exercise those later through real reply interactions.

// Constants

const minuteMs = 60 * 1000;
const replyBodyMaxLength = 500;
const seedReplyNamespace = "ratio-review-replies-v1";

const feedUsers = {
  ari: { id: "b3dfb8f0-c8ef-4d56-922f-8a2193d9fe61", name: "Ari Gray" },
  ezra: { id: "d9ad30f6-c336-45fb-8396-096a7d9333af", name: "Ezra Vale" },
  iris: { id: "e2b7d462-f00e-4023-b446-ce7ff2356825", name: "Iris Morgan" },
  jon: { id: "401cdb62-9867-4f9e-8d64-034d6a7352d2", name: "Jon Bell" },
  june: { id: "1c764483-3756-48a0-bc3d-d9dc78ce5f8e", name: "June Hart" },
  leah: { id: "9ba2afd7-55c5-420b-9e62-4b93144171eb", name: "Leah Brooks" },
  lena: { id: "a3b64729-3d9b-4eba-a921-17c8d6ac8828", name: "Lena Stone" },
  maya: { id: "8f37a7b8-3df0-4f32-9c0c-8e9c6bce0b01", name: "Maya Chen" },
  nina: { id: "c6a63f97-2d1a-42a4-8e94-8d6ed53aa3a4", name: "Nina Park" },
  noah: { id: "d241cd3d-9878-41ef-9c61-e1a549485f47", name: "Noah Reed" },
  sam: { id: "f607d55f-8ec2-42e2-93a5-bcd7051287d6", name: "Sam Rivera" },
  theo: { id: "1052f5cb-38cf-4323-8b0d-98c1e79244c5", name: "Theo Ramos" },
};

const paginationReplyBodies = [
  "The opener is what sold me. That first transition makes the whole record feel like one continuous thought.",
  "I had the opposite reaction at first, but the quieter middle stretch clicked on the third listen.",
  "The bass is doing so much work here without ever asking for attention.",
  "This review made me revisit it with headphones, and the tiny background details completely changed the mix for me.",
  "I still think the final track arrives one song too late, even if the ending itself is beautiful.",
  "That is fair. I like the extra detour because it makes the last song feel earned instead of inevitable.",
  "The sequencing is the real argument for me. Every song gets stranger because of what sits beside it.",
  "There are two tracks I would skip on their own, but I never skip them when I play the album front to back.",
  "The drums on the second half sound enormous without flattening the vocal.",
  "I keep changing my mind about the best song, which is usually a very good sign.",
  "The restraint matters. A louder master would have erased half of what makes these arrangements breathe.",
  "This is one of those records where the first listen gives you the map and the next five redraw it.",
  "I love the record, but I am less convinced by the lyrics than the production.",
  "The lyrics feel intentionally plain to me, almost like they are leaving space for the arrangement to carry the subtext.",
  "That bridge is the moment everything locks into place. Before it, I was admiring the craft more than feeling it.",
  "The closing run is immaculate. Three different moods, but they resolve the same tension.",
  "I put this on because of the review and immediately understood the silence-between-notes point.",
  "Coming back a week later: the songs I overlooked are now the ones stuck in my head.",
];

const maxLengthMultilineReplyBody = buildMaxLengthReplyBody();

const scenarioSpecs = [
  {
    albumId: "5vkqYmiPBYLaalcmjujWxK",
    authorKeys: [
      "jon",
      "ari",
      "viewer",
      "nina",
      "theo",
      "leah",
      "sam",
      "iris",
      "ezra",
      "june",
      "noah",
      "lena",
      "jon",
      "ari",
      "nina",
      "theo",
      "leah",
      "sam",
    ],
    bodies: paginationReplyBodies,
    key: "pagination",
    label: "Pagination boundary",
    reviewAuthorKey: "maya",
  },
  {
    albumId: "7ycBtnsMtyVbbwTfJwRjSP",
    authorKeys: ["maya", "viewer", "nina", "ari"],
    bodies: [
      "The tension between the bright horn parts and the heavier verses is exactly why this keeps working for me.",
      "I hear that too.\n\nThe second half turns the same contrast into something much more uneasy.",
      "This is the review that finally convinced me to sit with the whole album instead of revisiting singles.",
      maxLengthMultilineReplyBody,
    ],
    key: "mixed-content",
    label: "Multiline and 500-character content",
    reviewAuthorKey: "theo",
  },
  {
    albumId: "3mH6qwIy9crq0I9YQbOuDf",
    authorKeys: ["nina", "viewer", "ezra"],
    bodies: [
      "A low rating, but I can see the argument. Which part lost you first?",
      "For me it was the pacing more than any individual song. The ideas are there; the transitions just never settled.",
      "That makes sense. I disagree, but it is useful context for a rating that would otherwise be easy to read as a joke.",
    ],
    key: "rating-only",
    label: "Rating-only review",
    requiresRatingOnlyReview: true,
    reviewAuthorKey: "jon",
  },
  {
    albumId: "1vz94WpXDVYIEGja8cjFNa",
    authorKeys: ["viewer"],
    bodies: ["This one is mine, so the delete action and the empty-thread focus state are both easy to smoke-test."],
    key: "viewer-owned",
    label: "Viewer-owned deletion",
    reviewAuthorKey: "leah",
  },
  {
    albumId: "2noRn2Aes5aoNVsU6iWThc",
    authorKeys: [],
    bodies: [],
    key: "empty-control",
    label: "Untouched empty control",
    reviewAuthorKey: "ari",
  },
];

const likeCountPattern = [3, 0, 1, 4, 2];
const viewerLikedReplyIndexes = new Set([0, 4, 12]);

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedReviewReplies();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

// Seed orchestration

async function seedReviewReplies() {
  validateOptions(options);

  const usersById = await getRequiredUsers();
  const viewer = usersById.get(options.userId);
  const scenarios = await getScenarios(usersById);
  const seededReplyCount = scenarios.reduce((total, scenario) => total + scenario.replies.length, 0);
  const legacyReplyIds = scenarios.flatMap((scenario) => scenario.replies.map((reply) => reply.legacyId));
  const seededLikeCount = scenarios.reduce(
    (total, scenario) =>
      total + scenario.replies.reduce((replyTotal, reply) => replyTotal + reply.likeUserIds.length, 0),
    0
  );

  console.log(`Prepared ${seededReplyCount} replies and ${seededLikeCount} reply likes for ${formatUserName(viewer)}.`);
  printScenarioSummary(scenarios, "Would seed");

  if (options.dryRun) {
    return console.log("Dry run complete. No rows changed.");
  }

  const summary = await db.begin(async (transaction) => {
    let upsertedReplies = 0;
    let upsertedReplyLikes = 0;
    const deletedLegacyReplies = await transaction`
      delete from review_reply
      where id = any(${legacyReplyIds})
      returning id
    `;

    for (const scenario of scenarios) {
      for (const reply of scenario.replies) {
        const replyRows = await transaction`
          insert into review_reply (id, review_id, user_id, body, created_at)
          values (${reply.id}, ${scenario.review.id}, ${reply.userId}, ${reply.body}, ${reply.createdAt})
          on conflict (id) do update set
            review_id = excluded.review_id,
            user_id = excluded.user_id,
            body = excluded.body,
            created_at = excluded.created_at
          returning id
        `;

        upsertedReplies += replyRows.length;

        for (const [likeIndex, userId] of reply.likeUserIds.entries()) {
          const replyLikeRows = await transaction`
            insert into review_reply_like (reply_id, user_id, created_at)
            values (
              ${reply.id},
              ${userId},
              ${new Date(reply.createdAt.getTime() + (likeIndex + 1) * 15_000)}
            )
            on conflict (reply_id, user_id) do update set
              created_at = excluded.created_at
            returning reply_id
          `;

          upsertedReplyLikes += replyLikeRows.length;
        }
      }
    }

    return {
      deletedLegacyReplies: deletedLegacyReplies.length,
      upsertedReplies,
      upsertedReplyLikes,
    };
  });

  console.log(
    `Done. Removed ${summary.deletedLegacyReplies} legacy seed replies, then upserted ${summary.upsertedReplies} valid replies and ${summary.upsertedReplyLikes} reply likes without deleting manual data.`
  );
  printScenarioSummary(scenarios, "Seeded");
}

// Scenario preparation

async function getRequiredUsers() {
  const requiredUserIds = [...new Set([options.userId, ...Object.values(feedUsers).map((user) => user.id)])];
  const users = await db`
    select id, name, username, display_username, banned
    from "user"
    where id = any(${requiredUserIds})
  `;
  const usersById = new Map(users.map((user) => [user.id, user]));
  const missingUserIds = requiredUserIds.filter((userId) => !usersById.has(userId));

  if (missingUserIds.length > 0) {
    throw new Error(
      `Missing ${missingUserIds.length} required feed users. Run pnpm seed:feed -- --user-id=${options.userId} first.`
    );
  }

  const ineligibleUsers = users.filter((user) => user.banned || !user.username);

  if (ineligibleUsers.length > 0) {
    throw new Error(
      `Reply authors must be visible users with usernames. Ineligible: ${ineligibleUsers.map((user) => user.id).join(", ")}.`
    );
  }

  return usersById;
}

async function getScenarios(usersById) {
  const scenarios = [];

  for (const spec of scenarioSpecs) {
    const reviewAuthor = feedUsers[spec.reviewAuthorKey];
    const [review] = await db`
      select
        review.id,
        review.album_id,
        review.body,
        review.created_at,
        album.title as album_title
      from review
      inner join album on album.id = review.album_id
      where review.user_id = ${reviewAuthor.id}
        and review.album_id = ${spec.albumId}
      limit 1
    `;

    if (!review) {
      throw new Error(
        `Missing the ${spec.label.toLowerCase()} feed review. Run pnpm seed:feed -- --user-id=${options.userId} first.`
      );
    }

    if (spec.requiresRatingOnlyReview && review.body !== null) {
      throw new Error(
        `The ${spec.label.toLowerCase()} fixture is no longer rating-only. Rerun seed:feed without --randomize before seeding replies.`
      );
    }

    if (spec.bodies.length !== spec.authorKeys.length) {
      throw new Error(`The ${spec.label.toLowerCase()} fixture needs one author for every reply body.`);
    }

    const replies = spec.bodies.map((body, replyIndex) => {
      const authorKey = spec.authorKeys[replyIndex];
      const replyAuthor = authorKey === "viewer" ? usersById.get(options.userId) : feedUsers[authorKey];

      if (!replyAuthor) {
        throw new Error(`The ${spec.label.toLowerCase()} fixture references unknown reply author ${authorKey}.`);
      }

      const userId = replyAuthor.id;
      const createdAt = new Date(new Date(review.created_at).getTime() + (replyIndex + 1) * 2 * minuteMs);
      const id = getSeedReplyId(spec.key, replyIndex);
      const legacyId = getLegacySeedReplyId(spec.key, replyIndex);
      const likeUserIds = getLikeUserIds({ replyIndex, userId });

      return { body, createdAt, id, legacyId, likeUserIds, userId };
    });

    validateReplies(replies, usersById);
    scenarios.push({ ...spec, replies, review, reviewAuthor });
  }

  return scenarios;
}

function getLikeUserIds({ replyIndex, userId }) {
  const targetLikeCount = likeCountPattern[replyIndex % likeCountPattern.length];
  const viewerShouldLike = viewerLikedReplyIndexes.has(replyIndex) && options.userId !== userId;
  const candidateUserIds = [
    ...(viewerShouldLike ? [options.userId] : []),
    ...Object.values(feedUsers)
      .map((user) => user.id)
      .filter((candidateUserId) => candidateUserId !== options.userId),
  ];

  return [...new Set(candidateUserIds)]
    .filter((candidateUserId) => candidateUserId !== userId)
    .slice(0, targetLikeCount);
}

function validateReplies(replies, usersById) {
  for (const reply of replies) {
    if (!(reply.body.trim() && reply.body.length <= replyBodyMaxLength)) {
      throw new Error(`Seed reply ${reply.id} must contain between 1 and ${replyBodyMaxLength} characters.`);
    }

    if (!usersById.has(reply.userId)) {
      throw new Error(`Seed reply ${reply.id} references missing user ${reply.userId}.`);
    }
  }
}

// Output

function printScenarioSummary(scenarios, verb) {
  for (const scenario of scenarios) {
    const route = `/review/${scenario.review.id}`;
    const replyLabel = scenario.replies.length === 1 ? "reply" : "replies";
    console.log(
      `- ${verb} ${scenario.replies.length} ${replyLabel} for ${scenario.label}: "${scenario.review.album_title}" by ${scenario.reviewAuthor.name} (${route})`
    );
  }
}

// Options and helpers

function getOptions() {
  const cliOptions = {
    dryRun: false,
    userId: process.env.SEED_REVIEW_REPLIES_USER_ID ?? "",
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--dry-run") {
      cliOptions.dryRun = true;
      continue;
    }

    if (argument.startsWith("--user-id=")) {
      cliOptions.userId = argument.slice("--user-id=".length);
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return cliOptions;
}

function validateOptions(cliOptions) {
  if (!cliOptions.userId.trim()) {
    throw new Error("User id is required");
  }
}

function getSeedReplyId(scenarioKey, replyIndex) {
  const legacyHex = getSeedReplyHex(scenarioKey, replyIndex);
  const uuidHex = `${legacyHex.slice(0, 12)}4${legacyHex.slice(13, 16)}8${legacyHex.slice(17)}`;

  return formatUuidHex(uuidHex);
}

function getLegacySeedReplyId(scenarioKey, replyIndex) {
  return formatUuidHex(getSeedReplyHex(scenarioKey, replyIndex));
}

function getSeedReplyHex(scenarioKey, replyIndex) {
  return createHash("sha256").update(`${seedReplyNamespace}:${scenarioKey}:${replyIndex}`).digest("hex").slice(0, 32);
}

function formatUuidHex(hex) {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function buildMaxLengthReplyBody() {
  const source = [
    "This deliberately long reply checks wrapping, spacing, and the composer limit without relying on placeholder text.",
    "The line break also makes it useful for the multiline rendering pass. ",
  ].join("\n\n");

  return source.repeat(Math.ceil(replyBodyMaxLength / source.length)).slice(0, replyBodyMaxLength);
}

function formatUserName(user) {
  return `${user.display_username || user.username || user.name} (${user.id})`;
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
