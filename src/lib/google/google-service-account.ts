import { createSign } from "node:crypto";

interface ServiceAccountCredentials {
  clientEmail: string;
  privateKey: string;
}

interface AccessTokenResponse {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

export function readGoogleServiceAccountCredentials(
  env: NodeJS.ProcessEnv = process.env,
): ServiceAccountCredentials {
  const clientEmail = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    throw new Error("Google service account credentials are not configured.");
  }
  return { clientEmail, privateKey: normalizePrivateKey(privateKey) };
}

export async function getGoogleAccessToken(params?: {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}): Promise<string> {
  const now = params?.now?.() ?? Date.now();
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) return cachedToken.token;

  const credentials = readGoogleServiceAccountCredentials(params?.env);
  const issuedAt = Math.floor(now / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(credentials.privateKey, "base64url")}`;

  const fetch = params?.fetch ?? globalThis.fetch;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json() as AccessTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description || body.error || `Google token request failed (${response.status}).`);
  }
  cachedToken = {
    token: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

export function clearGoogleAccessTokenCache(): void {
  cachedToken = null;
}
