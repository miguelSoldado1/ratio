import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed:users-and-follows -- --user-id=<user-id> [--limit=24] [--dry-run]
// Required env: DATABASE_URL.
// Optional env: SEED_FOLLOW_TARGET_USER_ID and SEED_FOLLOW_USER_LIMIT; CLI flags override them.
// Creates deterministic users and bidirectional follow relationships with the target user.

const oneHourMs = 60 * 60 * 1000;
const seedStartedAt = new Date();
const defaultLimit = 24;

const seedUsers = [
  { displayUsername: "Maya Chen", id: "seed-user-maya", name: "Maya Chen", username: "maya" },
  { displayUsername: "Jon Bell", id: "seed-user-jon", name: "Jon Bell", username: "jon" },
  { displayUsername: "Ari Gray", id: "seed-user-ari", name: "Ari Gray", username: "ari" },
  { displayUsername: "Nina Park", id: "seed-user-nina", name: "Nina Park", username: "nina" },
  { displayUsername: "Theo Ramos", id: "seed-user-theo", name: "Theo Ramos", username: "theo" },
  { displayUsername: "Leah Brooks", id: "seed-user-leah", name: "Leah Brooks", username: "leah" },
  { displayUsername: "Sam Rivera", id: "seed-user-sam", name: "Sam Rivera", username: "sam" },
  { displayUsername: "Iris Morgan", id: "seed-user-iris", name: "Iris Morgan", username: "iris" },
  { displayUsername: "Ezra Vale", id: "seed-user-ezra", name: "Ezra Vale", username: "ezra" },
  { displayUsername: "June Hart", id: "seed-user-june", name: "June Hart", username: "june" },
  { displayUsername: "Noah Reed", id: "seed-user-noah", name: "Noah Reed", username: "noah" },
  { displayUsername: "Lena Stone", id: "seed-user-lena", name: "Lena Stone", username: "lena" },
  { displayUsername: "Owen Kim", id: "seed-user-owen", name: "Owen Kim", username: "owen" },
  { displayUsername: "Vera Lane", id: "seed-user-vera", name: "Vera Lane", username: "vera" },
  { displayUsername: "Kai Foster", id: "seed-user-kai", name: "Kai Foster", username: "kai" },
  { displayUsername: "Mina Scott", id: "seed-user-mina", name: "Mina Scott", username: "mina" },
  { displayUsername: "Cal Torres", id: "seed-user-cal", name: "Cal Torres", username: "cal" },
  { displayUsername: "Gia Ellis", id: "seed-user-gia", name: "Gia Ellis", username: "gia" },
  { displayUsername: "Rae Miller", id: "seed-user-rae", name: "Rae Miller", username: "rae" },
  { displayUsername: "Alex Finch", id: "seed-user-alex", name: "Alex Finch", username: "alex" },
  { displayUsername: "Cora Wells", id: "seed-user-cora", name: "Cora Wells", username: "cora" },
  { displayUsername: "Drew Cole", id: "seed-user-drew", name: "Drew Cole", username: "drew" },
  { displayUsername: "Elle Price", id: "seed-user-elle", name: "Elle Price", username: "elle" },
  { displayUsername: "Finn Blake", id: "seed-user-finn", name: "Finn Blake", username: "finn" },
  { displayUsername: "Hope Shaw", id: "seed-user-hope", name: "Hope Shaw", username: "hope" },
  { displayUsername: "Jules West", id: "seed-user-jules", name: "Jules West", username: "jules" },
  { displayUsername: "Remy Fox", id: "seed-user-remy", name: "Remy Fox", username: "remy" },
  { displayUsername: "Sage Quinn", id: "seed-user-sage", name: "Sage Quinn", username: "sage" },
  { displayUsername: "Tess Hale", id: "seed-user-tess", name: "Tess Hale", username: "tess" },
];

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedUsersAndFollows();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

async function seedUsersAndFollows() {
  validateOptions(options);

  const selectedSeedUsers = getSeedUsers(options.limit);
  const followEdges = getFollowEdges(selectedSeedUsers, options.userId);

  console.log(
    `Prepared ${selectedSeedUsers.length} users and ${followEdges.length} follow relationships for ${options.userId}.`
  );

  if (options.dryRun) {
    return console.log("Dry run complete. No rows changed.");
  }

  const [targetUser] = await db`
    select id, name, username, display_username
    from "user"
    where id = ${options.userId}
  `;

  if (!targetUser) {
    throw new Error(`No user found for id ${options.userId}`);
  }

  console.log(`Seeding follows for ${formatUserName(targetUser)} (${targetUser.id})`);

  const summary = await db.begin(async (transaction) => {
    let changedUsers = 0;
    let changedFollows = 0;

    for (const seedUser of selectedSeedUsers) {
      const changedRows = await transaction`
        insert into "user" (id, name, email, email_verified, username, display_username, updated_at)
        values (
          ${seedUser.id},
          ${seedUser.name},
          ${`${seedUser.username}@seed.ratio.local`},
          true,
          ${seedUser.username},
          ${seedUser.displayUsername},
          now()
        )
        on conflict (id) do update set
          name = excluded.name,
          email = excluded.email,
          email_verified = excluded.email_verified,
          username = excluded.username,
          display_username = excluded.display_username,
          updated_at = excluded.updated_at
        returning id
      `;

      changedUsers += changedRows.length;
    }

    for (const edge of followEdges) {
      const changedRows = await transaction`
        insert into user_follow (follower_id, following_id, created_at)
        values (${edge.followerId}, ${edge.followingId}, ${edge.createdAt})
        on conflict (follower_id, following_id) do nothing
        returning follower_id
      `;

      changedFollows += changedRows.length;
    }

    return { changedFollows, changedUsers };
  });

  console.log(`Done. Upserted ${summary.changedUsers} users and inserted ${summary.changedFollows} new follows.`);
  console.log("Open the target user's followers and following dialogs to exercise populated lists.");
}

function getSeedUsers(limit) {
  return seedUsers.slice(0, limit);
}

function getFollowEdges(selectedSeedUsers, targetUserId) {
  return selectedSeedUsers.flatMap((seedUser, index) => [
    createFollowEdge(seedUser.id, targetUserId, index * 2),
    createFollowEdge(targetUserId, seedUser.id, index * 2 + 1),
  ]);
}

function createFollowEdge(followerId, followingId, index) {
  if (followerId === followingId) {
    throw new Error(`Invalid self-follow for ${followerId}`);
  }

  return {
    createdAt: new Date(seedStartedAt.getTime() - index * oneHourMs),
    followerId,
    followingId,
  };
}

function getOptions() {
  const cliOptions = {
    dryRun: false,
    limit: Number(process.env.SEED_FOLLOW_USER_LIMIT ?? defaultLimit),
    userId: process.env.SEED_FOLLOW_TARGET_USER_ID ?? "",
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--dry-run") {
      cliOptions.dryRun = true;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      cliOptions.limit = Number(argument.slice("--limit=".length));
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

  if (!Number.isInteger(cliOptions.limit) || cliOptions.limit < 1 || cliOptions.limit > seedUsers.length) {
    throw new Error(`Limit must be an integer from 1 to ${seedUsers.length}`);
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
