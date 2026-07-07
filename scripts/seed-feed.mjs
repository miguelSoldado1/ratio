import { createHash } from "node:crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm seed:feed -- --user-id=<user-id> [--reset-except-user] [--randomize] [--seed=<seed>] [--dry-run]
// Required env: DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
// Optional env: SEED_FEED_VIEWER_USER_ID; CLI flags override it.
// Creates deterministic users, albums, reviews, likes, and follows for testing the home feed.
// By default it upserts seed rows and resets likes only for seeded reviews.
// Use --reset-except-user to delete app data and all auth users except the passed user before seeding.

const oneHourMs = 60 * 60 * 1000;
const oneDayMs = 24 * oneHourMs;
const seedStartedAt = new Date();
const defaultSeed = "ratio-feed-v1";
const spotifyMarket = "US";
const targetReviewCount = 96;
const viewerReviewCount = 8;
const dryRunPreviewCount = 30;
const maxCurrentReviewAgeHours = 7 * 24;
const maxOldTrendingReviewAgeHours = 21 * 24;
const spotifyReleaseYearDatePattern = /^\d{4}$/;
const spotifyReleaseMonthDatePattern = /^\d{4}-\d{2}$/;
const spotifyReleaseDayDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const reviewShareCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const reviewShareCodeLength = 10;
const resettableTables = [
  "review_like",
  "user_follow",
  "review",
  "album",
  "verification",
  "session",
  "account",
  "user",
];

const seedAuthors = [
  {
    displayUsername: "Maya Chen",
    followed: true,
    id: "8f37a7b8-3df0-4f32-9c0c-8e9c6bce0b01",
    name: "Maya Chen",
    username: "feedmaya",
  },
  {
    displayUsername: "Jon Bell",
    followed: true,
    id: "401cdb62-9867-4f9e-8d64-034d6a7352d2",
    name: "Jon Bell",
    username: "feedjon",
  },
  {
    displayUsername: "Ari Gray",
    followed: true,
    id: "b3dfb8f0-c8ef-4d56-922f-8a2193d9fe61",
    name: "Ari Gray",
    username: "feedari",
  },
  {
    displayUsername: "Nina Park",
    followed: true,
    id: "c6a63f97-2d1a-42a4-8e94-8d6ed53aa3a4",
    name: "Nina Park",
    username: "feednina",
  },
  {
    displayUsername: "Theo Ramos",
    followed: false,
    id: "1052f5cb-38cf-4323-8b0d-98c1e79244c5",
    name: "Theo Ramos",
    username: "feedtheo",
  },
  {
    displayUsername: "Leah Brooks",
    followed: false,
    id: "9ba2afd7-55c5-420b-9e62-4b93144171eb",
    name: "Leah Brooks",
    username: "feedleah",
  },
  {
    displayUsername: "Sam Rivera",
    followed: false,
    id: "f607d55f-8ec2-42e2-93a5-bcd7051287d6",
    name: "Sam Rivera",
    username: "feedsam",
  },
  {
    displayUsername: "Iris Morgan",
    followed: false,
    id: "e2b7d462-f00e-4023-b446-ce7ff2356825",
    name: "Iris Morgan",
    username: "feediris",
  },
  {
    displayUsername: "Ezra Vale",
    followed: true,
    id: "d9ad30f6-c336-45fb-8396-096a7d9333af",
    name: "Ezra Vale",
    username: "feedezra",
  },
  {
    displayUsername: "June Hart",
    followed: false,
    id: "1c764483-3756-48a0-bc3d-d9dc78ce5f8e",
    name: "June Hart",
    username: "feedjune",
  },
  {
    displayUsername: "Noah Reed",
    followed: false,
    id: "d241cd3d-9878-41ef-9c61-e1a549485f47",
    name: "Noah Reed",
    username: "feednoah",
  },
  {
    displayUsername: "Lena Stone",
    followed: true,
    id: "a3b64729-3d9b-4eba-a921-17c8d6ac8828",
    name: "Lena Stone",
    username: "feedlena",
  },
];

const seedAlbumIds = [
  "5vkqYmiPBYLaalcmjujWxK",
  "7ycBtnsMtyVbbwTfJwRjSP",
  "3mH6qwIy9crq0I9YQbOuDf",
  "1vz94WpXDVYIEGja8cjFNa",
  "2noRn2Aes5aoNVsU6iWThc",
  "0ETFjACtuP2ADo6LFhL6HN",
  "1bt6q2SruMsBtcerNVtpZB",
  "5zi7WsKlIiUXv09tbGLKsE",
  "19bQiwEKhXUBJWY6oV3KZk",
  "1weenld61qoidwYuZ1GESA",
  "76290XdXVF9rPzGdNRWdCh",
  "2B87zXm9bOWvAJdkJBTpzF",
  "0fO1KemWL2uCCQmM22iKlj",
  "79dL7FLiJFOO0EoehUHQBv",
  "3kEtdS2pH6hKcMU9Wioob1",
  "0HMsmYvoT1h2x1C4di5faf",
];

const reviewBodies = {
  big: "The record keeps opening trapdoors under itself. Every time I think I understand the center of it, another arrangement choice pulls the whole thing sideways. It is patient without feeling sleepy, ambitious without turning into homework, and the best moments feel like the band trusted silence as much as sound.",
  compact: "Small, sharp, and weirdly durable. I keep coming back to the production choices more than the hooks.",
  funny: "Five stars for commitment to the bit. I do not know if I enjoyed this or survived it.",
  long: [
    "This is the kind of album that changes shape depending on when you meet it. On first pass it feels immediate, almost obvious, but the sequencing does a lot of quiet work. The peaks arrive early enough to invite you in, then the stranger material sits in the middle where it can start rearranging your expectations.",
    "The thing I like most is how little it begs to be admired. The record has craft everywhere, but it rarely points at itself. Even the maximal parts leave room around the vocal and rhythm section. That restraint makes the emotional turns land harder than they would in a louder mix.",
  ].join("\n\n"),
  mid: "There are a few moments where the record drifts, but the texture is so specific that I do not really mind. It feels lived in.",
};

const reviewBodyKeys = [null, "big", "compact", "funny", "long", "mid"];

const reviewSpecs = [
  {
    album: 0,
    author: 0,
    body: "long",
    createdHoursAgo: 1,
    rating: 10,
    recentLikes: 6,
    totalLikes: 18,
    viewerLiked: true,
  },
  { album: 1, author: 4, body: "big", createdHoursAgo: 2, rating: 9, recentLikes: 18, totalLikes: 52 },
  { album: 2, author: 1, body: null, createdHoursAgo: 3, rating: 2, recentLikes: 2, totalLikes: 9 },
  { album: 3, author: 5, body: "compact", createdHoursAgo: 5, rating: 10, recentLikes: 0, totalLikes: 3 },
  { album: 4, author: 2, body: "funny", createdHoursAgo: 8, rating: 1, recentLikes: 11, totalLikes: 23 },
  { album: 5, author: 6, body: "mid", createdHoursAgo: 12, rating: 8, recentLikes: 4, totalLikes: 15 },
  {
    album: 6,
    author: 3,
    body: null,
    createdHoursAgo: 18,
    rating: 10,
    recentLikes: 19,
    totalLikes: 44,
    viewerLiked: true,
  },
  { album: 7, author: 7, body: "big", createdHoursAgo: 24, rating: 8, recentLikes: 1, totalLikes: 12 },
  { album: 8, author: 8, body: "compact", createdHoursAgo: 30, rating: 9, recentLikes: 7, totalLikes: 19 },
  { album: 9, author: 9, body: "long", createdHoursAgo: 38, rating: 10, recentLikes: 0, totalLikes: 5 },
  { album: 10, author: 10, body: null, createdHoursAgo: 48, rating: 6, recentLikes: 10, totalLikes: 31 },
  { album: 11, author: 11, body: "big", createdHoursAgo: 60, rating: 9, recentLikes: 2, totalLikes: 20 },
  { album: 12, author: 0, body: "compact", createdHoursAgo: 72, rating: 10, recentLikes: 13, totalLikes: 64 },
  { album: 13, author: 1, body: "mid", createdHoursAgo: 96, rating: 7, recentLikes: 0, totalLikes: 2 },
  { album: 14, author: 2, body: null, createdHoursAgo: 120, rating: 10, recentLikes: 15, totalLikes: 38 },
  { album: 15, author: 3, body: "long", createdHoursAgo: 156, rating: 8, recentLikes: 8, totalLikes: 27 },
  { album: 0, author: 4, body: "mid", createdHoursAgo: 168, rating: 6, recentLikes: 0, totalLikes: 1 },
  { album: 1, author: 5, body: "compact", createdHoursAgo: 240, rating: 10, recentLikes: 21, totalLikes: 86 },
  { album: 2, author: 8, body: "big", createdHoursAgo: 336, rating: 9, recentLikes: 5, totalLikes: 42 },
  { album: 3, author: 10, body: null, createdHoursAgo: 504, rating: 1, recentLikes: 24, totalLikes: 90 },
];

const seedLikers = Array.from({ length: 120 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");

  return {
    displayUsername: `Feed Liker ${number}`,
    id: getSeedLikerId(index),
    name: `Feed Liker ${number}`,
    username: `feedliker${number}`,
  };
});

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedFeed();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

async function seedFeed() {
  validateOptions(options);
  const progress = createProgress([
    "validate viewer",
    ...(options.resetExceptUser ? ["reset database"] : []),
    "prepare scenario",
    ...(options.dryRun
      ? []
      : [
          "fetch Spotify albums",
          "write seed users",
          "write albums",
          "write reviews",
          "reset likes",
          "write likes",
          "write follows",
        ]),
  ]);

  progress.start();
  const rng = createSeededRandom(options.seed);
  const reviewPlans = getReviewPlans(rng, options.randomize);
  const followedAuthors = getFollowedAuthors(rng, options.randomize, options.userId);

  progress.step("validate viewer");
  const [viewer] = await db`
    select id, name, username, display_username
    from "user"
    where id = ${options.userId}
  `;

  if (!viewer) {
    throw new Error(`No user found for id ${options.userId}`);
  }

  if (options.resetExceptUser) {
    progress.step("reset database");

    if (options.dryRun) {
      console.log(`Dry run would clear ${resettableTables.join(", ")} while preserving user ${options.userId}.`);
    } else {
      await resetDatabaseExceptUser(options.userId);
    }
  }

  progress.step("prepare scenario");
  console.log(`Preparing feed seed for ${formatUserName(viewer)} (${viewer.id}).`);
  if (!viewer.username) {
    console.warn("The target user has no username, so their reviews will not appear in the feed.");
  }

  console.log(`Using ${options.randomize ? "randomized" : "deterministic"} feed scenario with seed "${options.seed}".`);
  console.log(
    `Will upsert ${seedAuthors.length + seedLikers.length} seed users, ${seedAlbumIds.length} albums, ${reviewPlans.length} reviews, and ${followedAuthors.length} follows.`
  );

  if (options.dryRun) {
    for (const spec of reviewPlans.slice(0, dryRunPreviewCount)) {
      const authorName = spec.viewerAuthor ? formatUserName(viewer) : formatSeedUserName(seedAuthors[spec.author]);
      const albumId = seedAlbumIds[spec.album];
      console.log(
        `Would seed ${authorName} on Spotify album ${albumId}: ${spec.totalLikes} likes, ${spec.recentLikes} recent, ${spec.body ? "written" : "rating-only"}.`
      );
    }

    if (reviewPlans.length > dryRunPreviewCount) {
      console.log(`...and ${reviewPlans.length - dryRunPreviewCount} more reviews.`);
    }

    return console.log("Dry run complete. No rows changed.");
  }

  progress.step("fetch Spotify albums");
  const spotifyAlbums = await getSpotifyAlbums(seedAlbumIds);

  const summary = await db.begin(async (transaction) => {
    progress.step("write seed users");
    await upsertUsers(transaction, [...seedAuthors, ...seedLikers]);
    progress.step("write albums");
    await upsertAlbums(transaction, spotifyAlbums);
    progress.step("write reviews");
    const seededReviews = await upsertReviews(transaction, reviewPlans);
    progress.step("reset likes");
    await resetSeedReviewLikes(transaction, seededReviews);
    progress.step("write likes");
    const insertedLikes = await insertLikes(transaction, seededReviews);
    progress.step("write follows");
    const insertedFollows = await insertFollows(transaction, followedAuthors, options.userId);

    return {
      insertedFollows,
      insertedLikes,
      reviews: seededReviews.length,
      seedUsers: seedAuthors.length + seedLikers.length,
      upsertedAlbums: seedAlbumIds.length,
    };
  });

  progress.done();
  console.log(
    `Done. Upserted ${summary.seedUsers} seed users, ${summary.upsertedAlbums} albums, ${summary.reviews} reviews, inserted ${summary.insertedLikes} likes, and inserted ${summary.insertedFollows} follows.`
  );
  console.log("Open / in an anonymous browser and as the target user to compare feed ranking.");
}

async function upsertUsers(transaction, users) {
  for (const seedUser of users) {
    await transaction`
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
    `;
  }
}

async function upsertAlbums(transaction, albums) {
  for (const album of albums) {
    await transaction`
      insert into album (id, title, artist_names, cover_url, release_date, total_tracks, updated_at)
      values (
        ${album.id},
        ${album.title},
        ${album.artistNames},
        ${album.coverUrl},
        ${album.releaseDate},
        ${album.totalTracks},
        now()
      )
      on conflict (id) do update set
        title = excluded.title,
        artist_names = excluded.artist_names,
        cover_url = excluded.cover_url,
        release_date = excluded.release_date,
        total_tracks = excluded.total_tracks,
        updated_at = excluded.updated_at
    `;
  }
}

async function resetDatabaseExceptUser(viewerUserId) {
  await db.begin(async (transaction) => {
    await transaction`delete from review_like`;
    await transaction`delete from user_follow`;
    await transaction`delete from review`;
    await transaction`delete from album`;
    await transaction`delete from verification`;
    await transaction`delete from session where user_id <> ${viewerUserId}`;
    await transaction`delete from account where user_id <> ${viewerUserId}`;
    await transaction`delete from "user" where id <> ${viewerUserId}`;
  });
}

async function getSpotifyAlbums(albumIds) {
  const token = await getSpotifyAccessToken();
  const ids = albumIds.join(",");
  const response = await fetch(`https://api.spotify.com/v1/albums?ids=${ids}&market=${spotifyMarket}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify album lookup failed (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();
  const spotifyAlbums = payload.albums;

  if (!Array.isArray(spotifyAlbums)) {
    throw new Error("Spotify album lookup returned an invalid response");
  }

  const expectedAlbumIds = new Set(albumIds);

  return spotifyAlbums.map((album) => {
    if (!album?.id || album.album_type !== "album") {
      throw new Error("Spotify album lookup returned a missing or non-album item");
    }

    if (!expectedAlbumIds.has(album.id)) {
      throw new Error(`Spotify returned unexpected album ${album.id}`);
    }

    const releaseDate = getNormalizedSpotifyReleaseDate(String(album.release_date ?? ""));

    if (!releaseDate) {
      throw new Error(`Spotify album ${album.id} has an invalid release date`);
    }

    if (!(album.name && album.total_tracks)) {
      throw new Error(`Spotify album ${album.id} is missing required metadata`);
    }

    return {
      artistNames: Array.isArray(album.artists) ? album.artists.map((artist) => artist.name).filter(Boolean) : [],
      coverUrl: getLargestSpotifyImageUrl(album.images),
      id: album.id,
      releaseDate,
      title: album.name,
      totalTracks: album.total_tracks,
    };
  });
}

function getNormalizedSpotifyReleaseDate(releaseDate) {
  if (spotifyReleaseYearDatePattern.test(releaseDate)) return `${releaseDate}-01-01`;
  if (spotifyReleaseMonthDatePattern.test(releaseDate)) return `${releaseDate}-01`;
  if (spotifyReleaseDayDatePattern.test(releaseDate)) return releaseDate;

  return null;
}

async function getSpotifyAccessToken() {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed (${response.status}): ${await response.text()}`);
  }

  const payload = await response.json();

  if (typeof payload.access_token !== "string") {
    throw new Error("Spotify token response did not include an access token");
  }

  return payload.access_token;
}

function getLargestSpotifyImageUrl(images) {
  if (!Array.isArray(images) || images.length === 0) return null;

  const [largestImage] = [...images].sort((first, second) => {
    const firstArea = (first.width ?? 0) * (first.height ?? 0);
    const secondArea = (second.width ?? 0) * (second.height ?? 0);
    return secondArea - firstArea;
  });

  return typeof largestImage?.url === "string" ? largestImage.url : null;
}

async function upsertReviews(transaction, reviewPlans) {
  const seededReviews = [];

  for (const spec of reviewPlans) {
    const authorId = spec.viewerAuthor ? options.userId : seedAuthors[spec.author].id;
    const albumId = seedAlbumIds[spec.album];
    const body = spec.body ? reviewBodies[spec.body] : null;
    const createdAt = new Date(seedStartedAt.getTime() - spec.createdHoursAgo * oneHourMs);
    const shareCode = getSeedReviewShareCode(authorId, albumId);

    const [review] = await transaction`
      insert into review (user_id, album_id, share_code, rating, body, created_at, updated_at)
      values (${authorId}, ${albumId}, ${shareCode}, ${spec.rating}, ${body}, ${createdAt}, ${createdAt})
      on conflict (user_id, album_id) do update set
        share_code = excluded.share_code,
        rating = excluded.rating,
        body = excluded.body,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at
      returning id, user_id, album_id
    `;

    seededReviews.push({ ...review, spec });
  }

  return seededReviews;
}

function getSeedReviewShareCode(authorId, albumId) {
  const bytes = createHash("sha256").update(`${authorId}:${albumId}`).digest();
  let code = "";

  for (const byte of bytes) {
    code += reviewShareCodeAlphabet[byte % reviewShareCodeAlphabet.length];
    if (code.length === reviewShareCodeLength) return code;
  }

  return code;
}

async function resetSeedReviewLikes(transaction, seededReviews) {
  const reviewIds = seededReviews.map((review) => review.id);

  await transaction`
    delete from review_like
    where review_id = any(${reviewIds})
  `;
}

async function insertLikes(transaction, seededReviews) {
  let insertedLikes = 0;

  for (const review of seededReviews) {
    const likeEdges = getLikeEdges(review, options.userId);

    for (const edge of likeEdges) {
      const changedRows = await transaction`
        insert into review_like (review_id, user_id, created_at)
        values (${review.id}, ${edge.userId}, ${edge.createdAt})
        on conflict (review_id, user_id) do nothing
        returning user_id
      `;

      insertedLikes += changedRows.length;
    }
  }

  return insertedLikes;
}

function getLikeEdges(review, viewerUserId) {
  const edges = [];
  const viewerCanLike = review.spec.viewerLiked && viewerUserId !== review.user_id;

  if (viewerCanLike) {
    edges.push({ createdAt: getRecentLikeCreatedAt(0), userId: viewerUserId });
  }

  let likerIndex = 0;

  while (edges.length < review.spec.totalLikes) {
    const liker = seedLikers[likerIndex % seedLikers.length];
    likerIndex += 1;

    if (liker.id === review.user_id || edges.some((edge) => edge.userId === liker.id)) {
      continue;
    }

    const isRecentLike = edges.length < review.spec.recentLikes;
    edges.push({
      createdAt: isRecentLike ? getRecentLikeCreatedAt(edges.length) : getOlderLikeCreatedAt(edges.length),
      userId: liker.id,
    });
  }

  return edges;
}

function getRecentLikeCreatedAt(index) {
  return new Date(seedStartedAt.getTime() - (index + 1) * oneHourMs);
}

function getOlderLikeCreatedAt(index) {
  return new Date(seedStartedAt.getTime() - (8 * oneDayMs + index * oneHourMs));
}

async function insertFollows(transaction, followedAuthors, viewerUserId) {
  let insertedFollows = 0;

  for (const [index, author] of followedAuthors.entries()) {
    const changedRows = await transaction`
      insert into user_follow (follower_id, following_id, created_at)
      values (${viewerUserId}, ${author.id}, ${new Date(seedStartedAt.getTime() - index * oneHourMs)})
      on conflict (follower_id, following_id) do nothing
      returning following_id
    `;

    insertedFollows += changedRows.length;
  }

  return insertedFollows;
}

function getOptions() {
  const cliOptions = {
    dryRun: false,
    randomize: false,
    resetExceptUser: false,
    seed: process.env.SEED_FEED_SEED ?? defaultSeed,
    userId: process.env.SEED_FEED_VIEWER_USER_ID ?? "",
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--dry-run") {
      cliOptions.dryRun = true;
      continue;
    }

    if (argument === "--randomize") {
      cliOptions.randomize = true;
      cliOptions.seed = process.env.SEED_FEED_SEED ?? `ratio-feed-${Date.now()}`;
      continue;
    }

    if (argument === "--reset-except-user") {
      cliOptions.resetExceptUser = true;
      continue;
    }

    if (argument.startsWith("--seed=")) {
      cliOptions.seed = argument.slice("--seed=".length);
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

  if (!cliOptions.seed.trim()) {
    throw new Error("Seed must not be empty");
  }
}

function getReviewPlans(rng, randomize) {
  const plans = [...reviewSpecs];
  const usedReviewKeys = new Set(plans.map((spec) => getReviewPlanKey(spec)));
  let attempt = 0;

  while (plans.length < targetReviewCount && attempt < seedAuthors.length * seedAlbumIds.length * 3) {
    const spec = getGeneratedReviewSpec(attempt, plans.length);
    attempt += 1;

    if (usedReviewKeys.has(getReviewPlanKey(spec))) {
      continue;
    }

    usedReviewKeys.add(getReviewPlanKey(spec));
    plans.push(spec);
  }

  plans.push(...getViewerReviewSpecs());

  const finalPlans = randomize ? plans.map((spec, index) => randomizeReviewSpec(spec, index, rng)) : plans;

  return randomize ? shuffle(finalPlans, rng) : finalPlans;
}

function getViewerReviewSpecs() {
  return Array.from({ length: viewerReviewCount }, (_, index) => ({
    album: (index * 2 + 5) % seedAlbumIds.length,
    body: index % 3 === 0 ? null : reviewBodyKeys[(index + 2) % reviewBodyKeys.length],
    createdHoursAgo: getGeneratedNumber(index, 2, maxCurrentReviewAgeHours),
    rating: 10 - (index % 6),
    recentLikes: index % 2 === 0 ? 3 + index : 0,
    totalLikes: index % 2 === 0 ? 8 + index * 2 : index,
    viewerAuthor: true,
    viewerLiked: false,
  }));
}

function getGeneratedReviewSpec(attempt, index) {
  const author = Math.floor(attempt / seedAlbumIds.length) % seedAuthors.length;
  const album = attempt % seedAlbumIds.length;
  const ageBand = index % 4;
  const isOldTrending = index % 13 === 0;
  const isHotNow = index % 9 === 0;
  const totalLikes = getGeneratedTotalLikes(index, { isHotNow, isOldTrending });
  const recentLikes = getGeneratedRecentLikes(index, { isHotNow, isOldTrending });

  return {
    album,
    author,
    body: reviewBodyKeys[index % reviewBodyKeys.length],
    createdHoursAgo: getGeneratedReviewAgeHours(index, ageBand, isOldTrending),
    rating: ((index * 3) % 10) + 1,
    recentLikes: Math.min(recentLikes, totalLikes),
    totalLikes,
    viewerLiked: index % 17 === 0,
  };
}

function getGeneratedTotalLikes(index, { isHotNow, isOldTrending }) {
  if (isOldTrending) return 70 + (index % 35);
  if (isHotNow) return 30 + (index % 25);

  return (index * 7) % 22;
}

function getGeneratedRecentLikes(index, { isHotNow, isOldTrending }) {
  if (isOldTrending) return 18 + (index % 12);
  if (isHotNow) return 8 + (index % 10);

  return (index * 3) % 6;
}

function getGeneratedReviewAgeHours(index, ageBand, isOldTrending) {
  if (isOldTrending) return getGeneratedNumber(index, maxCurrentReviewAgeHours + 1, maxOldTrendingReviewAgeHours);
  if (ageBand === 0) return getGeneratedNumber(index, 1, 24);
  if (ageBand === 1) return getGeneratedNumber(index, 25, 96);
  if (ageBand === 2) return getGeneratedNumber(index, 97, maxCurrentReviewAgeHours);

  return getGeneratedNumber(index, 1, maxCurrentReviewAgeHours);
}

function randomizeReviewSpec(spec, index, rng) {
  const totalLikes = clamp(Math.round(spec.totalLikes * getRandomNumber(rng, 0.45, 1.65)), 0, seedLikers.length - 1);
  const recentLikes = clamp(
    Math.round(spec.recentLikes * getRandomNumber(rng, 0.25, 1.8) + getRandomInteger(rng, -2, 4)),
    0,
    totalLikes
  );

  return {
    ...spec,
    body: getRandomReviewBodyKey(rng, index),
    createdHoursAgo: clamp(
      Math.round(spec.createdHoursAgo * getRandomNumber(rng, 0.55, 1.45) + getRandomInteger(rng, -3, 6)),
      1,
      spec.recentLikes >= 18 ? maxOldTrendingReviewAgeHours : maxCurrentReviewAgeHours
    ),
    rating: getRandomInteger(rng, 1, 10),
    recentLikes,
    totalLikes,
    viewerLiked: rng() > 0.8,
  };
}

function getReviewPlanKey(spec) {
  return `${spec.author}:${spec.album}`;
}

function getGeneratedNumber(index, min, max) {
  return min + ((index * 37) % (max - min + 1));
}

function getFollowedAuthors(rng, randomize, viewerUserId) {
  const eligibleAuthors = seedAuthors.filter((author) => author.id !== viewerUserId);

  if (!randomize) {
    return eligibleAuthors.filter((author) => author.followed);
  }

  return shuffle(eligibleAuthors, rng).slice(0, getRandomInteger(rng, 3, 7));
}

function getRandomReviewBodyKey(rng, index) {
  if (index % 5 === 0) return null;

  return reviewBodyKeys[getRandomInteger(rng, 0, reviewBodyKeys.length - 1)];
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSeedLikerId(index) {
  return `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function createProgress(steps) {
  let currentStep = 0;

  return {
    done() {
      process.stdout.write(`\r[${steps.length}/${steps.length}] complete${" ".repeat(24)}\n`);
    },
    start() {
      console.log(`Starting feed seed with ${steps.length} steps.`);
    },
    step(label) {
      currentStep += 1;
      process.stdout.write(`\r[${currentStep}/${steps.length}] ${label}${" ".repeat(24)}\n`);
    },
  };
}

function formatSeedUserName(user) {
  return user.displayUsername || user.username || user.name;
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
