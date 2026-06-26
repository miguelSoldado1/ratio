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
  { displayUsername: "Maya Chen", id: "Vf8kLq2RzN4pYt7CxM9aBw3HsD6eGjQ1", name: "Maya Chen", username: "maya" },
  { displayUsername: "Jon Bell", id: "Kp3xTn9YvC6mQa1LsR8dFw2HbZ5gEuN4", name: "Jon Bell", username: "jon" },
  { displayUsername: "Ari Gray", id: "Zq7mBd4FsJ2hXc9VaL6pRy1NwT8kGeC3", name: "Ari Gray", username: "ari" },
  { displayUsername: "Nina Park", id: "Cr6sQw1LpV9eHg4KtX2mNa7YdB5jFuR8", name: "Nina Park", username: "nina" },
  { displayUsername: "Theo Ramos", id: "Lm2vGx8JqD5rCb1NsT9pYf4WaH7kZeQ6", name: "Theo Ramos", username: "theo" },
  { displayUsername: "Leah Brooks", id: "Rw9aMf3KpS6yNd2VxC8tLb1QgE5hJzU4", name: "Leah Brooks", username: "leah" },
  { displayUsername: "Sam Rivera", id: "Hx4nYe7CsB1qWu9JpL6dTr2VaM8fKgZ5", name: "Sam Rivera", username: "sam" },
  { displayUsername: "Iris Morgan", id: "Qa5tLz8VpF2mXg6RcN1yKe9DwB4hJsU7", name: "Iris Morgan", username: "iris" },
  { displayUsername: "Ezra Vale", id: "Dp1cWr6YnH9vKs3MbT7qXe4LaF2gJzQ8", name: "Ezra Vale", username: "ezra" },
  { displayUsername: "June Hart", id: "Wt8qBc2FgL5nRx9YaV3mKp6SeD1hJzU4", name: "June Hart", username: "june" },
  { displayUsername: "Noah Reed", id: "Ne6vJp1XaC8tLq4HgR9mYd2FsB5kWuZ7", name: "Noah Reed", username: "noah" },
  { displayUsername: "Lena Stone", id: "Yk3mRs7QwD1hVf9LpC6tNa2XgB8jZeU5", name: "Lena Stone", username: "lena" },
  { displayUsername: "Owen Kim", id: "Fb9xLc4NsT7qYa1JpM6dWr2VeH8kGzQ5", name: "Owen Kim", username: "owen" },
  { displayUsername: "Vera Lane", id: "Gs2pYw8KdN5mXc1RaL9tVq4HeB7jFuZ6", name: "Vera Lane", username: "vera" },
  { displayUsername: "Kai Foster", id: "Mb7rQe1VxC4tLg9YsF2nHa6JpD8kWuZ5", name: "Kai Foster", username: "kai" },
  { displayUsername: "Mina Scott", id: "Tu4nLz9QpB2hXc7VaM1rYe6DsF8kGjW5", name: "Mina Scott", username: "mina" },
  { displayUsername: "Cal Torres", id: "Jp8mWx3FdR6qNa1LtC9yVe4HsB2kGuZ7", name: "Cal Torres", username: "cal" },
  { displayUsername: "Gia Ellis", id: "Xc1vKe6NsT9pYq4HaL7mRd2FwB5jZuG8", name: "Gia Ellis", username: "gia" },
  { displayUsername: "Rae Miller", id: "Ld5tQw2JpC8mXg1VaR6nYe9FsB4hKzU7", name: "Rae Miller", username: "rae" },
  { displayUsername: "Alex Finch", id: "Bq9xVr4NsF7dLa2JpM5tYe1HcG8kWuZ6", name: "Alex Finch", username: "alex" },
  { displayUsername: "Cora Wells", id: "Hr3mYw8QpD1nXc6VaL9tKe2FsB5jGuZ7", name: "Cora Wells", username: "cora" },
  { displayUsername: "Drew Cole", id: "Se7qLc2VxF5mRa9JpN1yTd4HwB8kGuZ6", name: "Drew Cole", username: "drew" },
  { displayUsername: "Elle Price", id: "Na4tWz9KdC2hXg7VpM1rLe6FsB8jQuY5", name: "Elle Price", username: "elle" },
  { displayUsername: "Finn Blake", id: "Vp8mQe3HsD6yNa1LtC9rXw4JpB2kGuZ7", name: "Finn Blake", username: "finn" },
  { displayUsername: "Hope Shaw", id: "Qg1xLc6VtF9dRa4JpN7yMe2HsB5kWuZ8", name: "Hope Shaw", username: "hope" },
  { displayUsername: "Jules West", id: "Cw5rYp2KdN8mXg1VaL6tQe9FsB4hJuZ7", name: "Jules West", username: "jules" },
  { displayUsername: "Remy Fox", id: "Fz9mLe4HsD7qNa2JpV5tYw1RcB8kGuX6", name: "Remy Fox", username: "remy" },
  { displayUsername: "Sage Quinn", id: "Ks3xQw8VdF1mLa6JpN9tYe2HcB5rGuZ7", name: "Sage Quinn", username: "sage" },
  { displayUsername: "Tess Hale", id: "Yd7mLc2QpB5hXg9VaR1tNe6FsJ8kWuZ4", name: "Tess Hale", username: "tess" },
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
