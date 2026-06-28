// Minimal Google Sheets v4 REST client — just enough to create a personal
// spreadsheet (in the user's own Drive, via the drive.file scope) and write
// one month's report into a tab named after that month.
//
// We call the REST API directly with fetch instead of pulling in the
// `googleapis` SDK, since a server action only ever needs these four calls.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

export class GoogleSheetsError extends Error {}

export async function getAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleSheetsError(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET לא מוגדרים בשרת",
    );
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new GoogleSheetsError("רענון הרשאת Google נכשל, יש להתחבר מחדש");
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new GoogleSheetsError("רענון הרשאת Google לא החזיר access token");
  }
  return data.access_token;
}

async function sheetsRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new GoogleSheetsError(extractErrorMessage(response.status, body));
  }
  return response.json() as Promise<T>;
}

function extractErrorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed.error?.message) return `Google Sheets: ${parsed.error.message}`;
  } catch {
    // body wasn't JSON — fall through to the generic message below.
  }
  return `Google Sheets API error (${status})`;
}

/** Creates a new personal spreadsheet and returns its id. */
export async function createSpreadsheet(
  accessToken: string,
  title: string,
  firstTabTitle: string,
): Promise<string> {
  const data = await sheetsRequest<{ spreadsheetId: string }>(accessToken, "", {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: firstTabTitle } }],
    }),
  });
  return data.spreadsheetId;
}

/** True if the spreadsheet still exists and is reachable with this token. */
export async function spreadsheetExists(
  accessToken: string,
  spreadsheetId: string,
): Promise<boolean> {
  try {
    await sheetsRequest(accessToken, `/${spreadsheetId}?fields=spreadsheetId`);
    return true;
  } catch {
    return false;
  }
}

/** Ensures a tab with this exact title exists, creating it if missing. */
export async function ensureSheetTab(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
): Promise<void> {
  const data = await sheetsRequest<{ sheets: { properties: { title: string } }[] }>(
    accessToken,
    `/${spreadsheetId}?fields=sheets.properties.title`,
  );
  const exists = data.sheets.some((sheet) => sheet.properties.title === tabTitle);
  if (exists) return;

  await sheetsRequest(accessToken, `/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tabTitle } } }],
    }),
  });
}

/** Clears a tab, then writes the matrix starting at A1. */
export async function writeSheetValues(
  accessToken: string,
  spreadsheetId: string,
  tabTitle: string,
  matrix: string[][],
): Promise<void> {
  const range = encodeURIComponent(`'${tabTitle}'`);
  await sheetsRequest(accessToken, `/${spreadsheetId}/values/${range}:clear`, {
    method: "POST",
  });

  const writeRange = encodeURIComponent(`'${tabTitle}'!A1`);
  await sheetsRequest(
    accessToken,
    `/${spreadsheetId}/values/${writeRange}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: matrix }),
    },
  );
}

export function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
