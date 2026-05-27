/**
 * Netlify Background Function — submission-created
 *
 * Fires automatically on every Netlify Form submission for this site.
 * Filters to join-network only, then appends a row to the Replant
 * Join-Us tracking Google Sheet.
 *
 * Required env vars (set in Netlify → Site config → Environment variables):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  — full contents of the service account .json key file
 *   GOOGLE_SHEET_ID              — the long ID from the Sheet URL
 *                                  e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
 */

const { google } = require('googleapis');

exports.handler = async function (event) {
  // Only process join-network submissions
  // Netlify wraps form payloads: event.body = { payload: { form_name, data, ... } }
  const body = JSON.parse(event.body);
  const payload = body.payload || body;
  if (payload.form_name !== 'join-network') {
    console.log(`[submission-created] Skipping form: ${payload.form_name}`);
    return { statusCode: 200 };
  }

  const { name, church, city, email, role } = payload.data;
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'short',
    timeStyle: 'short',
  });

  // Validate env vars before attempting auth
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.error('[submission-created] Missing GOOGLE_SERVICE_ACCOUNT_JSON env var');
    return { statusCode: 500 };
  }
  if (!process.env.GOOGLE_SHEET_ID) {
    console.error('[submission-created] Missing GOOGLE_SHEET_ID env var');
    return { statusCode: 500 };
  }

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (err) {
    console.error('[submission-created] Could not parse GOOGLE_SERVICE_ACCOUNT_JSON:', err.message);
    return { statusCode: 500 };
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [
          [
            timestamp,           // A — Timestamp
            name || '',          // B — Name
            church || '',        // C — Church / Ministry
            city || '',          // D — City
            email || '',         // E — Email
            role || '',          // F — Role
            '',                  // G — Reached out? (blank — filled manually)
          ],
        ],
      },
    });

    console.log(`[submission-created] Row appended for ${email}`);
    return { statusCode: 200 };
  } catch (err) {
    console.error('[submission-created] Sheets API error:', err.message);
    return { statusCode: 500 };
  }
};
