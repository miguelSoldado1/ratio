import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed:review-likes -- --review-id=<review-id> [--count=24] [--dry-run]
// Required env: DATABASE_URL.
// Optional env: SEED_REVIEW_LIKES_REVIEW_ID and SEED_REVIEW_LIKES_COUNT; CLI flags override them.
// Randomly samples existing users, excluding the review author and users who already liked the review.

const defaultCount = 24;
const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedReviewLikes();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

async function seedReviewLikes() {
  validateOptions(options);

  const [review] = await db`
    select
      review.id,
      review.user_id,
      "user".name,
      "user".username,
      "user".display_username
    from review
    inner join "user" on "user".id = review.user_id
    where review.id = ${options.reviewId}
  `;

  if (!review) {
    throw new Error(`No review found for id ${options.reviewId}`);
  }

  const candidates = await db`
    select "user".id, "user".name, "user".username, "user".display_username
    from "user"
    where "user".id <> ${review.user_id}
      and not exists (
        select 1
        from review_like
        where review_like.review_id = ${options.reviewId}
          and review_like.user_id = "user".id
      )
    order by random()
    limit ${options.count}
  `;

  console.log(
    `Prepared ${candidates.length} random likes for review ${review.id} by ${formatUserName(review)} (${review.user_id}).`
  );

  if (candidates.length < options.count) {
    console.warn(`Only ${candidates.length} eligible users are available for the requested ${options.count} likes.`);
  }

  if (options.dryRun) {
    for (const user of candidates) {
      console.log(`Would like as ${formatUserName(user)} (${user.id})`);
    }

    return console.log("Dry run complete. No rows changed.");
  }

  const summary = await db.begin(async (transaction) => {
    let insertedLikes = 0;

    for (const user of candidates) {
      const changedRows = await transaction`
        insert into review_like (review_id, user_id, created_at)
        values (${options.reviewId}, ${user.id}, now())
        on conflict (review_id, user_id) do nothing
        returning user_id
      `;

      insertedLikes += changedRows.length;
    }

    return { insertedLikes };
  });

  console.log(`Done. Inserted ${summary.insertedLikes} new likes for review ${options.reviewId}.`);
}

function getOptions() {
  const cliOptions = {
    count: Number(process.env.SEED_REVIEW_LIKES_COUNT ?? defaultCount),
    dryRun: false,
    reviewId: process.env.SEED_REVIEW_LIKES_REVIEW_ID ?? "",
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--dry-run") {
      cliOptions.dryRun = true;
      continue;
    }

    if (argument.startsWith("--count=")) {
      cliOptions.count = Number(argument.slice("--count=".length));
      continue;
    }

    if (argument.startsWith("--review-id=")) {
      cliOptions.reviewId = argument.slice("--review-id=".length);
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return cliOptions;
}

function validateOptions(cliOptions) {
  if (!cliOptions.reviewId.trim()) {
    throw new Error("Review id is required");
  }

  if (!Number.isInteger(cliOptions.count) || cliOptions.count < 1) {
    throw new Error("Count must be a positive integer");
  }
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
