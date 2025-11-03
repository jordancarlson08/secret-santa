import { google } from 'googleapis';

const SPREADSHEET_ID = '1HgpTFqxJ-foW4o_4GnwVjhGNf73GZZXPS9Nxy5BtYPg';
const SHEET_NAME = 'Sheet1'; // Change if your sheet has a different name

// Get credentials from environment variable (for Vercel)
// For local development, try reading from file if env var not set
async function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    } catch (e) {
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT: ' + e.message);
    }
  }
  
  // Try reading from file for local development
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const credentialsPath = path.join(__dirname, '..', 'sub-for-santa-6th-ward-addf2efcb33a.json');
    const fileContents = fs.readFileSync(credentialsPath, 'utf8');
    return JSON.parse(fileContents);
  } catch (e) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT not set and file not found: ' + e.message);
  }
}

// Convert row array to object based on headers
function rowToObject(headers, row) {
  const obj = {};
  headers.forEach((header, index) => {
    if (header && row[index] !== undefined) {
      obj[header] = row[index] || '';
    }
  });
  return obj;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const credentials = await getCredentials();
    
    // Authenticate with service account
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    if (req.method === 'GET') {
      // Get all gifts
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return res.json([]);
      }

      const headers = rows[0];
      const gifts = rows.slice(1).map((row, index) => {
        const gift = rowToObject(headers, row);
        // Use row number as ID if no ID column
        if (!gift.id) {
          gift.id = (index + 2).toString(); // +2 because index is 0-based and row 1 is headers
        }
        return gift;
      });

      return res.json(gifts);
    }

    if (req.method === 'PATCH') {
      // Update a gift (claim it)
      const { id } = req.query;
      const { data } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }

      // Get all rows to find the one to update
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:Z`,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: 'Sheet is empty' });
      }

      const headers = rows[0];
      const idColumnIndex = headers.indexOf('id');
      const rowIndex = rows.findIndex((row, index) => {
        if (index === 0) return false; // Skip header
        return row[idColumnIndex] === id || row[idColumnIndex] === id.toString();
      });

      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Gift not found' });
      }

      // Find the columns to update
      const updates = [];
      Object.keys(data).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          // Convert column index to letter (A, B, C, etc.)
          let colLetter = '';
          let colNum = colIndex;
          while (colNum >= 0) {
            colLetter = String.fromCharCode(65 + (colNum % 26)) + colLetter;
            colNum = Math.floor(colNum / 26) - 1;
          }
          
          updates.push({
            range: `${SHEET_NAME}!${colLetter}${rowIndex + 1}`,
            values: [[data[key]]],
          });
        }
      });

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid columns to update' });
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updates,
        },
      });

      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Google Sheets API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

