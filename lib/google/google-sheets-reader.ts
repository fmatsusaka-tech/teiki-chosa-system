import { getGoogleAccessToken } from "./google-service-account";

interface SheetsValuesResponse {
  range?: string;
  majorDimension?: string;
  values?: unknown[][];
  error?: { message?: string };
}

export async function readSpreadsheetValues(params: {
  spreadsheetId: string;
  range: string;
  env?: NodeJS.ProcessEnv;
  fetch?: typeof globalThis.fetch;
}): Promise<unknown[][]> {
  const fetch = params.fetch ?? globalThis.fetch;
  const token = await getGoogleAccessToken({ env: params.env, fetch });
  const endpoint = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(params.spreadsheetId)}/values/${encodeURIComponent(params.range)}`,
  );
  endpoint.searchParams.set("majorDimension", "ROWS");
  endpoint.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  endpoint.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");

  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await response.json() as SheetsValuesResponse;
  if (!response.ok) {
    throw new Error(body.error?.message || `Google Sheets read failed (${response.status}).`);
  }
  return body.values ?? [];
}
