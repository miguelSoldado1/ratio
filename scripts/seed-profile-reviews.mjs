import { config } from "dotenv";
import postgres from "postgres";
import SpotifyWebApi from "spotify-web-api-node";

config({ path: ".env" });

// Usage: pnpm seed:profile-reviews -- --user-id=<user-id> [--limit=24] [--dry-run]
// Required env: DATABASE_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
// Optional env: SEED_PROFILE_USER_ID and SEED_PROFILE_REVIEW_LIMIT; CLI flags override them.
// Picks a random album subset, fetches pinned Spotify IDs, and inserts missing reviews only.

const defaultLimit = 24;
const market = "US";
const oneHourMs = 60 * 60 * 1000;
const reviewBodyMaxLength = 2000;
const spotifyRetryDelaysMs = [500, 1000, 2000];

const albumSpecs = [
  { id: "5vkqYmiPBYLaalcmjujWxK", artist: "Radiohead", title: "In Rainbows", year: 2007 },
  { id: "7ycBtnsMtyVbbwTfJwRjSP", artist: "Kendrick Lamar", title: "To Pimp A Butterfly", year: 2015 },
  { id: "3mH6qwIy9crq0I9YQbOuDf", artist: "Frank Ocean", title: "Blonde", year: 2016 },
  { id: "1vz94WpXDVYIEGja8cjFNa", artist: "Joni Mitchell", title: "Blue", year: 1971 },
  { id: "2noRn2Aes5aoNVsU6iWThc", artist: "Daft Punk", title: "Discovery", year: 2001 },
  { id: "4m2880jivSbbyEGAKfITCa", artist: "Daft Punk", title: "Random Access Memories", year: 2013 },
  { id: "0ETFjACtuP2ADo6LFhL6HN", artist: "The Beatles", title: "Abbey Road", year: 1969 },
  { id: "6YUCc2RiXcEKS9ibuZxjt0", artist: "Stevie Wonder", title: "Songs In The Key Of Life", year: 1976 },
  { id: "1bt6q2SruMsBtcerNVtpZB", artist: "Fleetwood Mac", title: "Rumours", year: 1977 },
  { id: "1BZoqf8Zje5nGdwZhOjAtD", artist: "Lauryn Hill", title: "The Miseducation of Lauryn Hill", year: 1998 },
  { id: "6dVIqQ8qmQ5GBnJ9shOYGE", artist: "Radiohead", title: "OK Computer", year: 1997 },
  { id: "6PBZN8cbwkqm1ERj2BGXJ1", artist: "Kendrick Lamar", title: "good kid, m.A.A.d city", year: 2012 },
  { id: "5zi7WsKlIiUXv09tbGLKsE", artist: "Tyler, The Creator", title: "IGOR", year: 2019 },
  { id: "19bQiwEKhXUBJWY6oV3KZk", artist: "Madvillain", title: "Madvillainy", year: 2004 },
  { id: "1weenld61qoidwYuZ1GESA", artist: "Miles Davis", title: "Kind Of Blue", year: 1959 },
  { id: "2v6ANhWhZBUKkg6pJJBs3B", artist: "Marvin Gaye", title: "What's Going On", year: 1971 },
  { id: "2CNEkSE8TADXRT2AzcEt1b", artist: "The Beach Boys", title: "Pet Sounds", year: 1966 },
  { id: "2guirTSEqLizK7j9i1MTTZ", artist: "Nirvana", title: "Nevermind", year: 1991 },
  { id: "5Y0p2XCgRRIjna91aQE8q7", artist: "The Smiths", title: "The Queen Is Dead", year: 1986 },
  { id: "1JvXxLsm0PxlGH4LXzqMGq", artist: "Talking Heads", title: "Remain in Light", year: 1980 },
  { id: "53eHm1f3sFiSzWMaKOl98Z", artist: "Slowdive", title: "Souvlaki", year: 1993 },
  { id: "2k8KgmDp9oHrmu0MIj4XDE", artist: "The Strokes", title: "Is This It", year: 2001 },
  { id: "392p3shh2jkxUxY2VHvlH8", artist: "Frank Ocean", title: "channel ORANGE", year: 2012 },
  { id: "76290XdXVF9rPzGdNRWdCh", artist: "SZA", title: "Ctrl", year: 2017 },
  { id: "7dK54iZuOxXFarGhXwEXfF", artist: "Beyonce", title: "Lemonade", year: 2016 },
  { id: "2B87zXm9bOWvAJdkJBTpzF", artist: "Lorde", title: "Melodrama", year: 2017 },
  { id: "5XpEKORZ4y6OrCZSKsi46A", artist: "Lana Del Rey", title: "Norman Fucking Rockwell!", year: 2019 },
  { id: "0Cuqhgy8vm96JEkBY3polk", artist: "Weyes Blood", title: "Titanic Rising", year: 2019 },
  { id: "0fO1KemWL2uCCQmM22iKlj", artist: "Fiona Apple", title: "Fetch The Bolt Cutters", year: 2020 },
  { id: "79dL7FLiJFOO0EoehUHQBv", artist: "Tame Impala", title: "Currents", year: 2015 },
  { id: "3Yko2SxDk4hc6fncIBQlcM", artist: "Solange", title: "A Seat at the Table", year: 2016 },
  { id: "5Hfbag0SsHxafx1SySFSX6", artist: "D'Angelo", title: "Black Messiah", year: 2014 },
  { id: "1p12OAWwudgMqfMzjMvl2a", artist: "A Tribe Called Quest", title: "The Low End Theory", year: 1991 },
  { id: "7otEvlhYLzpqiaxq3dT4Lg", artist: "Wu-Tang Clan", title: "Enter The Wu-Tang (36 Chambers)", year: 1993 },
  { id: "3kEtdS2pH6hKcMU9Wioob1", artist: "Nas", title: "Illmatic", year: 1994 },
  { id: "20r762YmB5HeofjMCiPMLv", artist: "Kanye West", title: "My Beautiful Dark Twisted Fantasy", year: 2010 },
  { id: "2lO9yuuIDgBpSJzxTh3ai8", artist: "D'Angelo", title: "Voodoo", year: 2000 },
  { id: "0YtYaaO0aipyeQl0xhAWTO", artist: "The Avalanches", title: "Since I Left You", year: 2000 },
  { id: "3539EbNgIdEDGBKkUf4wno", artist: "Portishead", title: "Dummy", year: 1994 },
  { id: "49MNmJhZQewjt06rpwp6QR", artist: "Massive Attack", title: "Mezzanine", year: 1998 },
  { id: "0HMsmYvoT1h2x1C4di5faf", artist: "Bjork", title: "Homogenic", year: 1997 },
  { id: "7MvSB0JTdtl1pSwZcgvYQX", artist: "Janelle Monae", title: "The ArchAndroid", year: 2010 },
  { id: "5G5UwqPsxDKpxJLX4xsyuh", artist: "Kate Bush", title: "Hounds Of Love", year: 1985 },
];

const loremIpsumPhrases = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
  "Curabitur pretium tincidunt lacus, nulla gravida orci a odio.",
  "Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.",
  "Integer in mauris eu nibh euismod gravida.",
  "Duis ac tellus et risus vulputate vehicula.",
  "Donec lobortis risus a elit, etiam tempor ut ullamcorper ligula.",
];

const reviewBodyProfiles = [
  null,
  { paragraphCount: 1, targetLength: 32 },
  { paragraphCount: 1, targetLength: 120 },
  { paragraphCount: 1, targetLength: 520 },
  { paragraphCount: 2, targetLength: 900 },
  { paragraphCount: 2, targetLength: 1320 },
  { paragraphCount: 3, targetLength: 1780 },
];

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const spotifyClientId = requireEnv("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  await seedProfileReviews();
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
}

async function seedProfileReviews() {
  validateOptions(options);

  const [targetUser] = await db`
    select id, name, username, display_username
    from "user"
    where id = ${options.userId}
  `;

  if (!targetUser) {
    throw new Error(`No user found for id ${options.userId}`);
  }

  console.log(`Seeding reviews for ${formatUserName(targetUser)} (${targetUser.id})`);

  const spotifyApi = await createAuthenticatedSpotifyApi();
  const selectedSpecs = getRandomAlbumSpecs(options.limit);
  const spotifyAlbums = [];

  for (const spec of selectedSpecs) {
    const album = await fetchSpotifyAlbum(spotifyApi, spec);
    spotifyAlbums.push(album);
    console.log(`Fetched ${album.name} by ${formatArtistNames(album.artists)} (${album.id})`);
  }

  const seedReviews = spotifyAlbums.map((album, index) => {
    const createdAt = new Date(Date.now() - index * oneHourMs);
    const rating = Math.floor(Math.random() * 10) + 1;
    const body = buildReviewBody();

    validateReviewBody(body, index);

    return { album, body, createdAt, rating };
  });

  if (options.dryRun) {
    return console.log(`Dry run complete. ${spotifyAlbums.length} Spotify albums fetched; no rows changed.`);
  }

  const summary = await db.begin(async (transaction) => {
    let changedReviews = 0;
    let skippedReviews = 0;

    for (const { album, body, createdAt, rating } of seedReviews) {
      await upsertAlbum(transaction, album);

      const changedRows = await transaction`
        insert into review (user_id, album_id, rating, body, created_at, updated_at)
        values (${options.userId}, ${album.id}, ${rating}, ${body}, ${createdAt}, ${createdAt})
        on conflict (user_id, album_id) do nothing
        returning id
      `;

      if (changedRows.length === 0) {
        skippedReviews += 1;
      } else {
        changedReviews += 1;
      }
    }

    return { changedReviews, skippedReviews, upsertedAlbums: spotifyAlbums.length };
  });

  console.log(
    `Done. Upserted ${summary.upsertedAlbums} albums, changed ${summary.changedReviews} reviews, skipped ${summary.skippedReviews} existing reviews.`
  );
}

async function createAuthenticatedSpotifyApi() {
  const spotifyApi = new SpotifyWebApi({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret,
  });
  const { body } = await withSpotifyRetry(() => spotifyApi.clientCredentialsGrant(), "Spotify client credentials");

  spotifyApi.setAccessToken(body.access_token);
  return spotifyApi;
}

async function fetchSpotifyAlbum(spotifyApi, spec) {
  const { body: album } = await withSpotifyRetry(
    () => spotifyApi.getAlbum(spec.id, { market }),
    `Spotify album lookup for ${spec.id}`
  );

  if (album.album_type !== "album") {
    throw new Error(`${album.id} resolved to ${album.album_type}, not an album`);
  }

  if (!matchesAlbumSpec(album, spec)) {
    throw new Error(`Spotify album ${spec.id} did not match ${spec.title} by ${spec.artist}`);
  }

  return album;
}

async function withSpotifyRetry(operation, label) {
  for (let attemptIndex = 0; attemptIndex <= spotifyRetryDelaysMs.length; attemptIndex += 1) {
    try {
      return await operation();
    } catch (error) {
      const isLastAttempt = attemptIndex === spotifyRetryDelaysMs.length;

      if (isLastAttempt || !isRetryableSpotifyError(error)) {
        throw error;
      }

      const delayMs = spotifyRetryDelaysMs[attemptIndex];
      console.warn(`${label} failed with ${getSpotifyErrorStatus(error)}; retrying in ${delayMs}ms.`);
      await wait(delayMs);
    }
  }
}

function isRetryableSpotifyError(error) {
  const status = getSpotifyErrorStatus(error);
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function getSpotifyErrorStatus(error) {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return "unknown status";
  }

  const { statusCode } = error;
  return typeof statusCode === "number" ? statusCode : "unknown status";
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function buildReviewBody() {
  const profile = getRandomItem(reviewBodyProfiles);

  if (profile === null) {
    return null;
  }

  return buildLoremIpsumReview(profile);
}

function buildLoremIpsumReview(profile) {
  const paragraphTargetLength = Math.floor(profile.targetLength / profile.paragraphCount);

  return Array.from({ length: profile.paragraphCount }, () => buildLoremIpsumParagraph(paragraphTargetLength)).join(
    "\n\n"
  );
}

function buildLoremIpsumParagraph(targetLength) {
  let paragraph = "";

  while (paragraph.length < targetLength) {
    const phrase = getRandomItem(loremIpsumPhrases);
    const nextParagraph = paragraph ? `${paragraph} ${phrase}` : phrase;

    if (nextParagraph.length > targetLength && paragraph) {
      break;
    }

    paragraph = nextParagraph;
  }

  return paragraph;
}

function getRandomItem(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function getRandomAlbumSpecs(limit) {
  const specs = [...albumSpecs];

  for (let index = specs.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [specs[index], specs[randomIndex]] = [specs[randomIndex], specs[index]];
  }

  return specs.slice(0, limit);
}

function validateReviewBody(body, index) {
  if (body !== null && body.length > reviewBodyMaxLength) {
    throw new Error(`Seed review ${index + 1} is ${body.length} characters; max is ${reviewBodyMaxLength}`);
  }
}

async function upsertAlbum(transaction, album) {
  const releaseYear = Number(album.release_date.slice(0, 4));

  if (!Number.isInteger(releaseYear)) {
    throw new Error(`Spotify album ${album.id} has an invalid release date: ${album.release_date}`);
  }

  await transaction`
    insert into album (id, title, artist_names, cover_url, release_year, total_tracks, updated_at)
    values (
      ${album.id},
      ${album.name},
      ${album.artists.map((artist) => artist.name)},
      ${getLargestImageUrl(album.images)},
      ${releaseYear},
      ${album.total_tracks},
      now()
    )
    on conflict (id) do update set
      title = excluded.title,
      artist_names = excluded.artist_names,
      cover_url = excluded.cover_url,
      release_year = excluded.release_year,
      total_tracks = excluded.total_tracks,
      updated_at = excluded.updated_at
  `;
}

function matchesAlbumSpec(album, spec) {
  const albumTitle = normalizeMatchText(album.name);
  const specTitle = normalizeMatchText(spec.title);
  const albumArtists = album.artists.map((artist) => normalizeMatchText(artist.name));
  const specArtist = normalizeMatchText(spec.artist);
  const titleMatches = albumTitle === specTitle || albumTitle.includes(specTitle) || specTitle.includes(albumTitle);
  const artistMatches = albumArtists.some(
    (artist) => artist === specArtist || artist.includes(specArtist) || specArtist.includes(artist)
  );
  const yearMatches = album.release_date.startsWith(String(spec.year));

  return titleMatches && artistMatches && yearMatches;
}

function normalizeMatchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getLargestImageUrl(images) {
  const [firstImage, ...remainingImages] = images;
  if (!firstImage) return null;

  let largestImage = firstImage;

  for (const image of remainingImages) {
    const imageWidth = image.width ?? 0;
    const largestImageWidth = largestImage.width ?? 0;

    if (imageWidth > largestImageWidth) {
      largestImage = image;
    }
  }

  return largestImage.url;
}

function formatArtistNames(artists) {
  return artists.map((artist) => artist.name).join(", ");
}

function formatUserName(user) {
  return user.display_username || user.username || user.name;
}

function getOptions() {
  const cliOptions = {
    dryRun: false,
    limit: Number(process.env.SEED_PROFILE_REVIEW_LIMIT ?? defaultLimit),
    userId: process.env.SEED_PROFILE_USER_ID ?? "",
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

  if (!Number.isInteger(cliOptions.limit) || cliOptions.limit < 1 || cliOptions.limit > albumSpecs.length) {
    throw new Error(`Limit must be an integer from 1 to ${albumSpecs.length}`);
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}
