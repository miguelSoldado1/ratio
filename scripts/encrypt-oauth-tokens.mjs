import { symmetricDecrypt, symmetricEncrypt } from "better-auth/crypto";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env" });

// Usage: pnpm auth:encrypt-oauth-tokens -- --apply
// Without --apply, the script reports how many legacy plaintext tokens it
// would encrypt and leaves the database unchanged.

const applyChanges = process.argv.includes("--apply");
const HEX_TOKEN_PATTERN = /^[0-9a-f]+$/i;
const databaseUrl = requireEnv("DATABASE_URL");
const betterAuthSecret = requireEnv("BETTER_AUTH_SECRET");
const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  const accounts = await sql`
    select id, access_token, refresh_token
    from "account"
    where access_token is not null or refresh_token is not null
  `;
  const updates = [];

  for (const account of accounts) {
    const accessToken = await encryptPlaintextToken(account.access_token);
    const refreshToken = await encryptPlaintextToken(account.refresh_token);

    if (!(accessToken.changed || refreshToken.changed)) continue;

    updates.push({
      accessToken: accessToken.value,
      id: account.id,
      originalAccessToken: account.access_token,
      originalRefreshToken: account.refresh_token,
      refreshToken: refreshToken.value,
    });
  }

  let encryptedAccountCount = 0;
  let skippedAccountCount = 0;

  if (applyChanges && updates.length > 0) {
    await sql.begin(async (transaction) => {
      for (const update of updates) {
        const updatedAccounts = await transaction`
          update "account"
          set
            access_token = ${update.accessToken},
            refresh_token = ${update.refreshToken},
            updated_at = now()
          where id = ${update.id}
            and access_token is not distinct from ${update.originalAccessToken}
            and refresh_token is not distinct from ${update.originalRefreshToken}
          returning id
        `;

        if (updatedAccounts.length > 0) {
          encryptedAccountCount += 1;
        } else {
          skippedAccountCount += 1;
        }
      }
    });
  }

  const action = applyChanges ? "Encrypted" : "Would encrypt";
  const accountCount = applyChanges ? encryptedAccountCount : updates.length;
  console.info(`${action} OAuth token material for ${accountCount} account(s).`);

  if (skippedAccountCount > 0) {
    console.info(`Skipped ${skippedAccountCount} account(s) changed during migration; rerun to retry them safely.`);
  }

  if (!applyChanges && updates.length > 0) {
    console.info("Run again with --apply after reviewing the count.");
  }
} finally {
  await sql.end({ timeout: 1 }).catch(() => undefined);
}

async function encryptPlaintextToken(token) {
  if (!token || (await isEncryptedToken(token))) {
    return { changed: false, value: token };
  }

  return {
    changed: true,
    value: await symmetricEncrypt({ data: token, key: betterAuthSecret }),
  };
}

async function isEncryptedToken(token) {
  if (token.startsWith("$ba$")) return true;
  if (!(token.length % 2 === 0 && HEX_TOKEN_PATTERN.test(token))) return false;

  try {
    await symmetricDecrypt({ data: token, key: betterAuthSecret });
    return true;
  } catch {
    return false;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);

  return value;
}
