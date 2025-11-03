# Google Sheets API Setup Instructions

## Prerequisites
- Service account JSON file: `sub-for-santa-6th-ward-addf2efcb33a.json`
- Spreadsheet ID: `1HgpTFqxJ-foW4o_4GnwVjhGNf73GZZXPS9Nxy5BtYPg`

## Local Development Setup

1. **Set up environment variable:**
   - Copy the entire contents of `sub-for-santa-6th-ward-addf2efcb33a.json`
   - Paste it as a single-line JSON string in `.env.local`:
   ```
   GOOGLE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"..."}
   ```
   
   Or use a package like `dotenv` to load it directly from the file.

2. **For local testing, you'll need to run the API separately or use Vercel CLI:**
   ```bash
   npx vercel dev
   ```

## Vercel Deployment Setup

1. **Go to your Vercel project settings**
2. **Navigate to Environment Variables**
3. **Add a new variable:**
   - **Name:** `GOOGLE_SERVICE_ACCOUNT`
   - **Value:** Paste the entire JSON contents of your service account file as a single line
   - **Environment:** Production, Preview, and Development

4. **Important:** Make sure your Google Sheet is shared with the service account email:
   - Service account email: `sub-for-santa-sheets@sub-for-santa-6th-ward.iam.gserviceaccount.com`
   - Give it **Editor** access

## Testing

The API endpoints are:
- `GET /api/sheets` - Fetch all gifts
- `PATCH /api/sheets?id={giftId}` - Update a gift (claim it)

Example:
```javascript
// Get all gifts
fetch('/api/sheets')

// Claim a gift
fetch('/api/sheets?id=1', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    data: {
      claimedBy: 'John Doe',
      claimedDate: '2024-12-10T12:00:00.000Z'
    }
  })
})
```

## Notes

- The API assumes your Google Sheet has headers in the first row
- Column names are case-sensitive
- The sheet name is set to "Sheet1" by default - update `SHEET_NAME` in `api/sheets.js` if different

