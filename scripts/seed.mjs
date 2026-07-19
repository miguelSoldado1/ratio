import { createHash } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed -- --user-id=<user-id> [--dry-run]
// Required env: DATABASE_URL.
// The reset is intended for local development databases. It preserves the target
// user's Better Auth identity, linked accounts, profile fields, and active sessions.

const syntheticUserCount = 50;
const targetFollowerCount = 16;
const targetFollowingCount = 24;
const seedName = "ratio-local-v1";
const oneHourMs = 60 * 60 * 1000;
const seedStartedAt = new Date();

const seedNames = [
  "Maya Chen",
  "Jon Bell",
  "Ari Gray",
  "Nina Park",
  "Theo Ramos",
  "Leah Brooks",
  "Sam Rivera",
  "Iris Morgan",
  "Ezra Vale",
  "June Hart",
  "Noah Reed",
  "Lena Stone",
  "Owen Kim",
  "Vera Lane",
  "Kai Foster",
  "Mina Scott",
  "Cal Torres",
  "Gia Ellis",
  "Rae Miller",
  "Alex Finch",
  "Cora Wells",
  "Drew Cole",
  "Elle Price",
  "Finn Blake",
  "Hope Shaw",
  "Jules West",
  "Remy Fox",
  "Sage Quinn",
  "Tess Hale",
  "Robin Ellis",
  "Wren Taylor",
  "Micah Stone",
  "Skye Adams",
  "Rowan Blake",
  "Parker Lee",
  "Emery James",
  "Casey Ford",
  "Riley Hart",
  "Morgan Bell",
  "Avery Cole",
  "Quinn Hayes",
  "Jamie Brooks",
  "Taylor Reed",
  "Cameron Wells",
  "Jordan Lane",
  "Charlie Moss",
  "Sasha King",
  "Marley Fox",
  "Devon Gray",
  "Harper West",
];

const albums = [
  {
    artistNames: ["Radiohead"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273de3c04b5fc750b68899b20a9",
    id: "5vkqYmiPBYLaalcmjujWxK",
    releaseDate: "2007-10-10",
    title: "In Rainbows",
    totalTracks: 10,
  },
  {
    artistNames: ["Kendrick Lamar"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273cdb645498cd3d8a2db4d05e1",
    id: "7ycBtnsMtyVbbwTfJwRjSP",
    releaseDate: "2015-03-15",
    title: "To Pimp A Butterfly",
    totalTracks: 16,
  },
  {
    artistNames: ["Frank Ocean"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273c5649add07ed3720be9d5526",
    id: "3mH6qwIy9crq0I9YQbOuDf",
    releaseDate: "2016-08-20",
    title: "Blonde",
    totalTracks: 17,
  },
  {
    artistNames: ["Joni Mitchell"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e79dc1438d650f426b5e99a7",
    id: "1vz94WpXDVYIEGja8cjFNa",
    releaseDate: "1971-06-22",
    title: "Blue",
    totalTracks: 10,
  },
  {
    artistNames: ["Daft Punk"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b2731e81bff9807a9e629fce5ade",
    id: "2noRn2Aes5aoNVsU6iWThc",
    releaseDate: "2001-03-07",
    title: "Discovery",
    totalTracks: 14,
  },
  {
    artistNames: ["Daft Punk"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b2739b9b36b0e22870b9f542d937",
    id: "4m2880jivSbbyEGAKfITCa",
    releaseDate: "2013-05-17",
    title: "Random Access Memories",
    totalTracks: 13,
  },
  {
    artistNames: ["The Beatles"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273dc30583ba717007b00cceb25",
    id: "0ETFjACtuP2ADo6LFhL6HN",
    releaseDate: "1969-09-26",
    title: "Abbey Road",
    totalTracks: 17,
  },
  {
    artistNames: ["Stevie Wonder"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b2732fee61bfec596bb6f5447c50",
    id: "6YUCc2RiXcEKS9ibuZxjt0",
    releaseDate: "1976-09-28",
    title: "Songs In The Key Of Life",
    totalTracks: 21,
  },
  {
    artistNames: ["Fleetwood Mac"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27357df7ce0eac715cf70e519a7",
    id: "1bt6q2SruMsBtcerNVtpZB",
    releaseDate: "1977-02-04",
    title: "Rumours",
    totalTracks: 11,
  },
  {
    artistNames: ["Lauryn Hill"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273e08b1250db5f75643f1508c9",
    id: "1BZoqf8Zje5nGdwZhOjAtD",
    releaseDate: "1998-08-25",
    title: "The Miseducation of Lauryn Hill",
    totalTracks: 14,
  },
  {
    artistNames: ["Radiohead"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273c8b444df094279e70d0ed856",
    id: "6dVIqQ8qmQ5GBnJ9shOYGE",
    releaseDate: "1997-05-21",
    title: "OK Computer",
    totalTracks: 12,
  },
  {
    artistNames: ["Kendrick Lamar"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273d28d2ebdedb220e479743797",
    id: "6PBZN8cbwkqm1ERj2BGXJ1",
    releaseDate: "2012-10-22",
    title: "good kid, m.A.A.d city",
    totalTracks: 14,
  },
  {
    artistNames: ["Tyler, The Creator"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b27330a635de2bb0caa4e26f6abb",
    id: "5zi7WsKlIiUXv09tbGLKsE",
    releaseDate: "2019-05-17",
    title: "IGOR",
    totalTracks: 12,
  },
  {
    artistNames: ["Madvillain"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b2733e3bb917af94bd82074c5d47",
    id: "19bQiwEKhXUBJWY6oV3KZk",
    releaseDate: "2004-03-23",
    title: "Madvillainy",
    totalTracks: 22,
  },
  {
    artistNames: ["Miles Davis"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273387a29c90de3b2398c29c34f",
    id: "1weenld61qoidwYuZ1GESA",
    releaseDate: "1959-08-17",
    title: "Kind Of Blue",
    totalTracks: 5,
  },
  {
    artistNames: ["Marvin Gaye"],
    coverUrl: "https://i.scdn.co/image/ab67616d0000b273b36949bee43217351961ffbc",
    id: "2v6ANhWhZBUKkg6pJJBs3B",
    releaseDate: "1971-05-21",
    title: "What's Going On",
    totalTracks: 9,
  },
];

const reviewBodies = [
  "The record keeps opening trapdoors under itself. Every time I think I understand the center of it, another arrangement choice pulls the whole thing sideways.",
  "Small, sharp, and weirdly durable. I keep coming back to the production choices more than the hooks.",
  "The sequencing does a lot of quiet work. The peaks arrive early enough to invite you in, then the stranger material starts rearranging your expectations.",
  "Five stars for commitment to the bit. I do not know if I enjoyed this or survived it.",
  "There are a few moments where the record drifts, but the texture is so specific that I do not really mind. It feels lived in.",
];

const replyBodies = [
  "The opener is what sold me. That first transition makes the whole record feel like one continuous thought.",
  "I had the opposite reaction at first, but the quieter middle stretch clicked on the third listen.",
  "The bass is doing so much work here without ever asking for attention.",
  "This made me revisit it with headphones, and the tiny background details completely changed the mix for me.",
  "I still think the final track arrives one song too late, even if the ending itself is beautiful.",
  "The sequencing is the real argument for me. Every song gets stranger because of what sits beside it.",
  "I keep changing my mind about the best song, which is usually a very good sign.",
  "The restraint matters. A louder master would have erased half of what makes these arrangements breathe.",
];

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedDatabase();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

async function seedDatabase() {
  validateOptions(options);

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the local seed while NODE_ENV=production.");
  }

  const targetUser = await getTargetUser(options.userId);
  const seedUsers = buildSeedUsers();
  validateSeedUserConflicts(targetUser, seedUsers);

  const fixture = buildFixture(targetUser.id, seedUsers);
  printPlan(targetUser, fixture);

  if (options.dryRun) {
    console.log("Dry run complete. No rows changed.");
    return;
  }

  const summary = await db.begin(async (transaction) => {
    await resetDatabase(transaction, targetUser.id);

    await insertUsers(transaction, seedUsers);
    await insertAlbums(transaction);
    await insertReviews(transaction, fixture.reviews);
    await insertLikes(transaction, fixture.reviewLikes);
    await insertFollows(transaction, fixture.follows);
    await insertReplies(transaction, fixture.replies);
    await insertReplyLikes(transaction, fixture.replyLikes);
    await insertNotifications(transaction, fixture.notifications);

    return {
      albums: albums.length,
      follows: fixture.follows.length,
      likes: fixture.reviewLikes.length,
      notifications: fixture.notifications.length,
      replies: fixture.replies.length,
      replyLikes: fixture.replyLikes.length,
      reviews: fixture.reviews.length,
      users: seedUsers.length,
    };
  });

  console.log(
    `Done. Reset the database and seeded ${summary.users} users, ${summary.albums} albums, ${summary.reviews} reviews, ${summary.likes} review likes, ${summary.replies} replies, ${summary.replyLikes} reply likes, ${summary.follows} follows, and ${summary.notifications} unread notifications.`
  );
}

async function getTargetUser(userId) {
  const [targetUser] = await db`
    select id, name, username, display_username, image, avatar_object_key, banned
    from "user"
    where id = ${userId}
  `;

  if (!targetUser) {
    throw new Error(`No user found for id ${userId}. Nothing was changed.`);
  }

  return targetUser;
}

function buildSeedUsers() {
  return Array.from({ length: syntheticUserCount }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    const name = seedNames[index];

    return {
      displayUsername: name,
      email: `seedlistener${number}@seed.ratio.local`,
      id: `ratio-seed-user-${number}`,
      name,
      username: `seedlistener${number}`,
    };
  });
}

function validateSeedUserConflicts(targetUser, seedUsers) {
  if (seedUsers.some((seedUser) => seedUser.id === targetUser.id)) {
    throw new Error(`Target user ${targetUser.id} conflicts with the deterministic seed user IDs.`);
  }

  if (targetUser.username && seedUsers.some((seedUser) => seedUser.username === targetUser.username)) {
    throw new Error(`Target username ${targetUser.username} conflicts with the deterministic seed usernames.`);
  }

  if (targetUser.email && seedUsers.some((seedUser) => seedUser.email === targetUser.email)) {
    throw new Error("Target email conflicts with the deterministic seed emails.");
  }
}

function buildFixture(targetUserId, seedUsers) {
  const reviews = [];

  const addReview = ({ albumIndex, authorId, body, hoursAgo, rating }) => {
    const key = `${authorId}:${albums[albumIndex].id}`;
    const review = {
      albumId: albums[albumIndex].id,
      authorId,
      body,
      createdAt: hoursFromNow(hoursAgo),
      id: uuidFor("review", key),
      rating,
    };

    reviews.push(review);
    return review;
  };

  const targetReviews = [0, 1, 2, 3, 4, 5].map((albumIndex, index) =>
    addReview({
      albumIndex,
      authorId: targetUserId,
      body: reviewBodies[index % reviewBodies.length],
      hoursAgo: 2 + index * 31,
      rating: [9, 8, 10, 7, 6, 9][index],
    })
  );

  for (const [userIndex, user] of seedUsers.entries()) {
    for (const offset of [0, 5, 10]) {
      addReview({
        albumIndex: (userIndex + offset) % albums.length,
        authorId: user.id,
        body: (userIndex + offset) % 5 === 0 ? null : reviewBodies[(userIndex + offset) % reviewBodies.length],
        hoursAgo: 4 + ((userIndex * 13 + offset * 17) % 520),
        rating: ((userIndex * 3 + offset) % 10) + 1,
      });
    }
  }

  const reviewLikes = buildReviewLikes(reviews, seedUsers, targetUserId);
  const follows = buildFollows(seedUsers, targetUserId);
  const replies = buildReplies(reviews, targetReviews, seedUsers, targetUserId);
  const replyLikes = buildReplyLikes(replies, seedUsers, targetUserId);
  const notifications = buildNotifications({
    follows,
    replies,
    replyLikes,
    reviewLikes,
    seedUsers,
    targetReviews,
    targetUserId,
  });

  return { follows, notifications, replies, replyLikes, reviewLikes, reviews };
}

function buildReviewLikes(reviews, seedUsers, targetUserId) {
  const actors = [...seedUsers.map((user) => user.id), targetUserId];
  const likes = [];

  for (const [reviewIndex, review] of reviews.entries()) {
    const likeCount = review.authorId === targetUserId ? 8 + (reviewIndex % 4) : 2 + ((reviewIndex * 7) % 9);
    let actorOffset = 0;

    while (likes.filter((like) => like.reviewId === review.id).length < likeCount) {
      const userId = actors[(reviewIndex + actorOffset * 7) % actors.length];
      actorOffset += 1;

      if (userId === review.authorId || likes.some((like) => like.reviewId === review.id && like.userId === userId)) {
        continue;
      }

      likes.push({
        createdAt: hoursFromNow(reviewIndex % 8),
        reviewId: review.id,
        userId,
      });
    }
  }

  return likes;
}

function buildFollows(seedUsers, targetUserId) {
  const follows = [];

  for (const [index, user] of seedUsers.entries()) {
    const nextUser = seedUsers[(index + 1) % seedUsers.length];
    const secondUser = seedUsers[(index + 7) % seedUsers.length];

    follows.push({ createdAt: hoursFromNow(index + 3), followerId: user.id, followingId: nextUser.id });
    follows.push({ createdAt: hoursFromNow(index + 4), followerId: user.id, followingId: secondUser.id });

    if (index < targetFollowerCount) {
      follows.push({ createdAt: hoursFromNow(index + 1), followerId: user.id, followingId: targetUserId });
    }

    if (index < targetFollowingCount) {
      follows.push({ createdAt: hoursFromNow(index + 2), followerId: targetUserId, followingId: user.id });
    }
  }

  return follows;
}

function buildReplies(reviews, targetReviews, seedUsers, targetUserId) {
  const replies = [];

  for (const [replyIndex, user] of seedUsers.slice(0, 8).entries()) {
    replies.push({
      body: replyBodies[replyIndex % replyBodies.length],
      createdAt: hoursFromNow(1 + replyIndex / 4),
      id: uuidFor("reply", `${targetReviews[0].id}:${replyIndex}`),
      reviewId: targetReviews[0].id,
      userId: user.id,
    });
  }

  for (const [replyIndex, user] of seedUsers.slice(8, 11).entries()) {
    replies.push({
      body: replyBodies[(replyIndex + 2) % replyBodies.length],
      createdAt: hoursFromNow(10 + replyIndex),
      id: uuidFor("reply", `${targetReviews[1].id}:${replyIndex}`),
      reviewId: targetReviews[1].id,
      userId: user.id,
    });
  }

  const syntheticReviews = reviews.filter((review) => review.authorId !== targetUserId).slice(0, 30);

  for (const [reviewIndex, review] of syntheticReviews.entries()) {
    const firstUser = seedUsers[(reviewIndex + 12) % seedUsers.length];
    replies.push({
      body: replyBodies[(reviewIndex + 3) % replyBodies.length],
      createdAt: hoursFromNow(20 + reviewIndex * 3),
      id: uuidFor("reply", `${review.id}:first`),
      reviewId: review.id,
      userId: firstUser.id,
    });

    if (reviewIndex % 4 === 0) {
      replies.push({
        body: replyBodies[(reviewIndex + 4) % replyBodies.length],
        createdAt: hoursFromNow(21 + reviewIndex * 3),
        id: uuidFor("reply", `${review.id}:second`),
        reviewId: review.id,
        userId: seedUsers[(reviewIndex + 18) % seedUsers.length].id,
      });
    }
  }

  replies.push({
    body: "I keep coming back to this one. The details are better every time.",
    createdAt: hoursFromNow(3),
    id: uuidFor("reply", "target-owned-reply"),
    reviewId: syntheticReviews[0].id,
    userId: targetUserId,
  });

  return replies;
}

function buildReplyLikes(replies, seedUsers, targetUserId) {
  const replyLikes = [];

  for (const [replyIndex, reply] of replies.entries()) {
    const likeCount = reply.userId === targetUserId ? 6 : replyIndex % 4;

    for (let index = 0; index < likeCount; index += 1) {
      const userId = seedUsers[(replyIndex + index * 9) % seedUsers.length].id;

      if (userId === reply.userId || replyLikes.some((like) => like.replyId === reply.id && like.userId === userId)) {
        continue;
      }

      replyLikes.push({
        createdAt: minutesFromNow(replyIndex + index + 1),
        replyId: reply.id,
        userId,
      });
    }
  }

  return replyLikes;
}

function buildNotifications({ follows, replies, replyLikes, reviewLikes, seedUsers, targetReviews, targetUserId }) {
  const notifications = [];
  const addNotification = (notification) => notifications.push({ ...notification, seenAt: null });

  for (const [reviewIndex, review] of targetReviews.slice(0, 3).entries()) {
    const actors = reviewLikes
      .filter((like) => like.reviewId === review.id)
      .slice(0, 5)
      .map((like) => seedUsers.find((user) => user.id === like.userId) ?? { id: like.userId });

    for (const [actorIndex, actor] of actors.entries()) {
      const like = reviewLikes.find((candidate) => candidate.reviewId === review.id && candidate.userId === actor.id);

      if (!like) {
        throw new Error(`Notification fixture failed to create a like for ${actor.id} on ${review.id}.`);
      }

      addNotification({
        actorUserId: actor.id,
        createdAt: minutesFromNow(reviewIndex * 5 + actorIndex + 1),
        recipientUserId: targetUserId,
        reviewId: review.id,
        type: "review_liked",
      });
    }
  }

  for (const review of targetReviews.slice(0, 2)) {
    const reviewReplies = replies.filter((reply) => reply.reviewId === review.id && reply.userId !== targetUserId);
    const latestReply = [...reviewReplies].sort((first, second) => second.createdAt - first.createdAt)[0];

    if (latestReply) {
      addNotification({
        actorUserId: latestReply.userId,
        createdAt: latestReply.createdAt,
        recipientUserId: targetUserId,
        replyId: latestReply.id,
        reviewId: review.id,
        type: "review_replied",
      });
    }
  }

  const targetReply = replies.find((reply) => reply.userId === targetUserId);

  if (!targetReply) {
    throw new Error("Notification fixture failed to create a target-owned reply.");
  }

  const targetReplyLikes = replyLikes
    .filter((like) => like.replyId === targetReply.id)
    .map((like) => seedUsers.find((user) => user.id === like.userId) ?? { id: like.userId });

  if (targetReplyLikes.length < 1) {
    throw new Error("Notification fixture failed to create likes for the target-owned reply.");
  }

  for (const actor of targetReplyLikes) {
    addNotification({
      actorUserId: actor.id,
      createdAt: minutesFromNow(30),
      recipientUserId: targetUserId,
      replyId: targetReply.id,
      type: "reply_liked",
    });
  }

  const targetFollowers = follows
    .filter((follow) => follow.followingId === targetUserId)
    .map((follow) => seedUsers.find((user) => user.id === follow.followerId) ?? { id: follow.followerId });

  for (const [index, actor] of targetFollowers.entries()) {
    addNotification({
      actorUserId: actor.id,
      createdAt: minutesFromNow(45 + index),
      recipientUserId: targetUserId,
      type: "user_followed",
    });
  }

  return notifications;
}

async function resetDatabase(transaction, targetUserId) {
  await transaction`delete from notification`;
  await transaction`delete from profile_pinned_review`;
  await transaction`delete from review_reply_like`;
  await transaction`delete from review_reply`;
  await transaction`delete from review_like`;
  await transaction`delete from user_follow`;
  await transaction`delete from review`;
  await transaction`delete from album`;
  await transaction`delete from verification`;
  await transaction`delete from session where user_id <> ${targetUserId}`;
  await transaction`delete from account where user_id <> ${targetUserId}`;
  await transaction`delete from "user" where id <> ${targetUserId}`;
}

async function insertUsers(transaction, seedUsers) {
  for (const seedUser of seedUsers) {
    await transaction`
      insert into "user" (id, name, email, email_verified, username, display_username, updated_at)
      values (
        ${seedUser.id},
        ${seedUser.name},
        ${seedUser.email},
        true,
        ${seedUser.username},
        ${seedUser.displayUsername},
        now()
      )
    `;
  }
}

async function insertAlbums(transaction) {
  for (const album of albums) {
    await transaction`
      insert into album (id, title, artist_names, cover_url, release_date, total_tracks, updated_at)
      values (${album.id}, ${album.title}, ${album.artistNames}, ${album.coverUrl}, ${album.releaseDate}, ${album.totalTracks}, now())
    `;
  }
}

async function insertReviews(transaction, reviews) {
  for (const review of reviews) {
    await transaction`
      insert into review (id, user_id, album_id, rating, body, created_at, updated_at)
      values (${review.id}, ${review.authorId}, ${review.albumId}, ${review.rating}, ${review.body}, ${review.createdAt}, ${review.createdAt})
    `;
  }
}

async function insertLikes(transaction, likes) {
  for (const like of likes) {
    await transaction`
      insert into review_like (review_id, user_id, created_at)
      values (${like.reviewId}, ${like.userId}, ${like.createdAt})
    `;
  }
}

async function insertFollows(transaction, follows) {
  for (const follow of follows) {
    await transaction`
      insert into user_follow (follower_id, following_id, created_at)
      values (${follow.followerId}, ${follow.followingId}, ${follow.createdAt})
    `;
  }
}

async function insertReplies(transaction, replies) {
  for (const reply of replies) {
    await transaction`
      insert into review_reply (id, review_id, user_id, body, created_at)
      values (${reply.id}, ${reply.reviewId}, ${reply.userId}, ${reply.body}, ${reply.createdAt})
    `;
  }
}

async function insertReplyLikes(transaction, replyLikes) {
  for (const like of replyLikes) {
    await transaction`
      insert into review_reply_like (reply_id, user_id, created_at)
      values (${like.replyId}, ${like.userId}, ${like.createdAt})
    `;
  }
}

async function insertNotifications(transaction, notifications) {
  for (const notification of notifications) {
    await transaction`
      insert into notification (recipient_user_id, actor_user_id, type, review_id, reply_id, created_at, seen_at)
      values (
        ${notification.recipientUserId},
        ${notification.actorUserId},
        ${notification.type},
        ${notification.reviewId ?? null},
        ${notification.replyId ?? null},
        ${notification.createdAt},
        ${notification.seenAt}
      )
      on conflict do nothing
    `;
  }
}

function printPlan(targetUser, fixture) {
  console.log(`Preparing local seed for ${formatUserName(targetUser)} (${targetUser.id}).`);
  console.log(`Using fixed fixture "${seedName}" with ${syntheticUserCount} synthetic users.`);
  console.log(
    `Will preserve 1 target user and recreate ${syntheticUserCount} synthetic users (${syntheticUserCount + 1} total users).`
  );
  console.log(
    `Will recreate ${albums.length} albums, ${fixture.reviews.length} reviews, ${fixture.reviewLikes.length} review likes, ${fixture.replies.length} replies, ${fixture.replyLikes.length} reply likes, ${fixture.follows.length} follows, and ${fixture.notifications.length} unread notifications.`
  );

  if (!options.dryRun) {
    console.log("The reset will preserve the target user's profile, linked accounts, and active sessions.");
  }
}

function getOptions() {
  const cliOptions = {
    dryRun: false,
    userId: process.env.SEED_USER_ID ?? "",
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") continue;
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
    throw new Error("User id is required. Pass --user-id=<user-id>. Nothing was changed.");
  }
}

function hoursFromNow(hoursAgo) {
  return new Date(seedStartedAt.getTime() - hoursAgo * oneHourMs);
}

function minutesFromNow(minutesAgo) {
  return new Date(seedStartedAt.getTime() - minutesAgo * 60_000);
}

function uuidFor(namespace, value) {
  const digest = createHash("sha256").update(`${seedName}:${namespace}:${value}`).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
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
