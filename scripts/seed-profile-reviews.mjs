import { config } from "dotenv";
import postgres from "postgres";
import SpotifyWebApi from "spotify-web-api-node";

config({ path: ".env" });

const defaultUserId = "CSvcdHs3JoHlZPSuITgzwygfNRcX4bT7";
const defaultLimit = 36;
const market = "US";
const seedMarker = "[ratio seed:profile-infinite]";
const oneHourMs = 60 * 60 * 1000;
const reviewBodyMaxLength = 2000;
const spotifyRetryDelaysMs = [500, 1000, 2000];

const albumSpecs = [
  { artist: "Radiohead", title: "In Rainbows", year: 2007 },
  { artist: "Kendrick Lamar", title: "To Pimp A Butterfly", year: 2015 },
  { artist: "Frank Ocean", title: "Blonde", year: 2016 },
  { artist: "Joni Mitchell", title: "Blue", year: 1971 },
  { artist: "Daft Punk", title: "Discovery", year: 2001 },
  { artist: "Daft Punk", title: "Random Access Memories", year: 2013 },
  { artist: "The Beatles", title: "Abbey Road", year: 1969 },
  { artist: "Stevie Wonder", title: "Songs In The Key Of Life", year: 1976 },
  { artist: "Fleetwood Mac", title: "Rumours", year: 1977 },
  { artist: "Lauryn Hill", title: "The Miseducation of Lauryn Hill", year: 1998 },
  { artist: "Radiohead", title: "OK Computer", year: 1997 },
  { artist: "Kendrick Lamar", title: "good kid, m.A.A.d city", year: 2012 },
  { artist: "Tyler, The Creator", title: "IGOR", year: 2019 },
  { artist: "Madvillain", title: "Madvillainy", year: 2004 },
  { artist: "Miles Davis", title: "Kind Of Blue", year: 1959 },
  { artist: "Marvin Gaye", title: "What's Going On", year: 1971 },
  { artist: "The Beach Boys", title: "Pet Sounds", year: 1966 },
  { artist: "The Velvet Underground", title: "The Velvet Underground & Nico", year: 1967 },
  { artist: "Nirvana", title: "Nevermind", year: 1991 },
  { artist: "The Smiths", title: "The Queen Is Dead", year: 1986 },
  { artist: "Talking Heads", title: "Remain in Light", year: 1980 },
  { artist: "Slowdive", title: "Souvlaki", year: 1993 },
  { artist: "The Strokes", title: "Is This It", year: 2001 },
  { artist: "Frank Ocean", title: "channel ORANGE", year: 2012 },
  { artist: "SZA", title: "Ctrl", year: 2017 },
  { artist: "Beyonce", title: "Lemonade", year: 2016 },
  { artist: "Lorde", title: "Melodrama", year: 2017 },
  { artist: "Lana Del Rey", title: "Norman Fucking Rockwell!", year: 2019 },
  { artist: "Weyes Blood", title: "Titanic Rising", year: 2019 },
  { artist: "Fiona Apple", title: "Fetch The Bolt Cutters", year: 2020 },
  { artist: "Tame Impala", title: "Currents", year: 2015 },
  { artist: "Solange", title: "A Seat at the Table", year: 2016 },
  { artist: "D'Angelo", title: "Black Messiah", year: 2014 },
  { artist: "A Tribe Called Quest", title: "The Low End Theory", year: 1991 },
  { artist: "Wu-Tang Clan", title: "Enter The Wu-Tang (36 Chambers)", year: 1993 },
  { artist: "Nas", title: "Illmatic", year: 1994 },
  { artist: "Kanye West", title: "My Beautiful Dark Twisted Fantasy", year: 2010 },
  { artist: "D'Angelo", title: "Voodoo", year: 2000 },
  { artist: "The Avalanches", title: "Since I Left You", year: 2000 },
  { artist: "Portishead", title: "Dummy", year: 1994 },
  { artist: "Massive Attack", title: "Mezzanine", year: 1998 },
  { artist: "Bjork", title: "Homogenic", year: 1997 },
  { artist: "Janelle Monae", title: "The ArchAndroid", year: 2010 },
  { artist: "Kate Bush", title: "Hounds Of Love", year: 1985 },
];

const ratingPattern = [10, 9, 8, 9, 7, 10, 8, 6, 9, 10, 7, 8];

const loremIpsumSentences = [
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

const options = getOptions();
const databaseUrl = requireEnv("DATABASE_URL");
const spotifyClientId = requireEnv("SPOTIFY_CLIENT_ID");
const spotifyClientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
const db = postgres(databaseUrl, { max: 1, prepare: false });

try {
  validateOptions(options);

  const [targetUser] = await db`select id from "user" where id = ${options.userId}`;

  if (!targetUser) {
    throw new Error(`No user found for id ${options.userId}`);
  }

  const spotifyApi = await createAuthenticatedSpotifyApi();
  const selectedSpecs = albumSpecs.slice(0, options.limit);
  const spotifyAlbums = [];

  for (const spec of selectedSpecs) {
    const album = await resolveSpotifyAlbum(spotifyApi, spec);
    spotifyAlbums.push(album);
    console.log(`Resolved ${album.name} by ${formatArtistNames(album.artists)} (${album.id})`);
  }

  if (options.dryRun) {
    console.log(`Dry run complete. ${spotifyAlbums.length} Spotify albums resolved; no rows changed.`);
  } else {
    const summary = await db.begin(async (transaction) => {
      if (options.replaceSeed) {
        const deletedRows = await transaction`
          delete from review
          where user_id = ${options.userId}
            and body like ${`${seedMarker}%`}
          returning id
        `;
        console.log(`Deleted ${deletedRows.length} existing seed reviews for ${options.userId}.`);
      }

      let changedReviews = 0;
      let skippedReviews = 0;

      for (const [index, album] of spotifyAlbums.entries()) {
        await upsertAlbum(transaction, album);

        const createdAt = new Date(Date.now() - index * oneHourMs);
        const rating = ratingPattern[index % ratingPattern.length];
        const body = buildReviewBody(index, album);

        validateReviewBody(body, index);

        const changedRows = await transaction`
          insert into review (user_id, album_id, rating, body, created_at, updated_at)
          values (${options.userId}, ${album.id}, ${rating}, ${body}, ${createdAt}, ${createdAt})
          on conflict (user_id, album_id) do update set
            rating = excluded.rating,
            body = excluded.body,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at
          where "review"."body" is null
            or "review"."body" like ${`${seedMarker}%`}
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
      `Done. Upserted ${summary.upsertedAlbums} albums, changed ${summary.changedReviews} reviews, skipped ${summary.skippedReviews} non-seed existing reviews.`
    );
  }
} finally {
  await db.end({ timeout: 1 }).catch(() => undefined);
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

async function resolveSpotifyAlbum(spotifyApi, spec) {
  const query = `${spec.title} ${spec.artist}`;
  const { body } = await withSpotifyRetry(
    () => spotifyApi.searchAlbums(query, { limit: 10, market }),
    `Spotify search for ${spec.title} by ${spec.artist}`
  );
  const candidates = body.albums?.items?.filter((album) => album.album_type === "album") ?? [];
  const candidate = candidates
    .map((album) => ({ album, score: scoreAlbumMatch(album, spec) }))
    .sort((left, right) => right.score - left.score)[0];

  if (!candidate || candidate.score < 100) {
    throw new Error(`Could not confidently resolve Spotify album for ${spec.title} by ${spec.artist}`);
  }

  const { body: album } = await withSpotifyRetry(
    () => spotifyApi.getAlbum(candidate.album.id, { market }),
    `Spotify album lookup for ${candidate.album.id}`
  );

  if (album.album_type !== "album") {
    throw new Error(`${album.id} resolved to ${album.album_type}, not an album`);
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

function buildReviewBody(index, album) {
  const profile = index % 12;

  if (profile === 2 || profile === 7 || profile === 11) {
    return null;
  }

  const albumLabel = `${album.name} by ${formatArtistNames(album.artists)}`;
  const reviewText = buildReviewText(profile, index, albumLabel);

  return `${seedMarker}\n\n${reviewText}`;
}

function buildReviewText(profile, index, albumLabel) {
  if (profile === 0) {
    return `${albumLabel}. ${buildTrimmedLoremIpsum(index, 1820)}`;
  }

  if (profile === 1) {
    return "Lorem ipsum. Tiny note.";
  }

  if (profile === 3) {
    return `Lorem ipsum dolor sit amet. ${albumLabel}.`;
  }

  if (profile === 4) {
    return buildTrimmedLoremIpsum(index, 720);
  }

  if (profile === 5) {
    return `${buildTrimmedLoremIpsum(index, 340)}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.`;
  }

  if (profile === 6) {
    return "Lorem ipsum dolor sit amet.";
  }

  if (profile === 8) {
    return `${albumLabel}. ${buildTrimmedLoremIpsum(index, 1540)}`;
  }

  if (profile === 9) {
    return "Lorem ipsum dolor sit amet, consectetur.";
  }

  if (profile === 10) {
    return `${buildTrimmedLoremIpsum(index, 1100)}\n\n${buildTrimmedLoremIpsum(index + 17, 220)}`;
  }

  return buildTrimmedLoremIpsum(index, 520);
}

function buildTrimmedLoremIpsum(index, targetLength) {
  const source = Array.from({ length: 24 }, (_, repetitionIndex) => {
    const rotatedSentences = rotateArray(loremIpsumSentences, (index + repetitionIndex) % loremIpsumSentences.length);
    return rotatedSentences.join(" ");
  }).join("\n\n");
  const maxStart = Math.max(0, source.length - targetLength - 1);
  const trimStart = deterministicNumber(index * 37 + targetLength, maxStart);
  const trimmed = source.slice(trimStart, trimStart + targetLength + 160).trim();

  return trimmed.slice(0, targetLength).trim();
}

function rotateArray(values, offset) {
  return [...values.slice(offset), ...values.slice(0, offset)];
}

function deterministicNumber(seed, maxValue) {
  if (maxValue <= 0) return 0;

  const value = Math.sin(seed + 1) * 10_000;
  return Math.floor((value - Math.floor(value)) * (maxValue + 1));
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

function scoreAlbumMatch(album, spec) {
  const albumTitle = normalizeMatchText(album.name);
  const specTitle = normalizeMatchText(spec.title);
  const albumArtists = album.artists.map((artist) => normalizeMatchText(artist.name));
  const specArtist = normalizeMatchText(spec.artist);
  let score = 0;

  if (albumTitle === specTitle) {
    score += 100;
  } else if (albumTitle.includes(specTitle) || specTitle.includes(albumTitle)) {
    score += 45;
  }

  if (albumArtists.some((artist) => artist === specArtist)) {
    score += 80;
  } else if (albumArtists.some((artist) => artist.includes(specArtist) || specArtist.includes(artist))) {
    score += 40;
  }

  if (album.release_date.startsWith(String(spec.year))) {
    score += 20;
  }

  return score;
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

function getOptions() {
  const cliOptions = {
    dryRun: false,
    limit: Number(process.env.SEED_PROFILE_REVIEW_LIMIT ?? defaultLimit),
    replaceSeed: false,
    userId: process.env.SEED_PROFILE_USER_ID ?? defaultUserId,
  };

  for (const argument of process.argv.slice(2)) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--dry-run") {
      cliOptions.dryRun = true;
      continue;
    }

    if (argument === "--replace-seed") {
      cliOptions.replaceSeed = true;
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
