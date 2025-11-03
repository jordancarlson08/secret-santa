# Security Fixes Applied

**Date:** 2025-01-03  
**Status:** ✅ Critical vulnerabilities fixed

## Summary

All critical security vulnerabilities have been addressed. The API now has proper restrictions on what can be read/written, even without authentication.

---

## ✅ Fixed Issues

### 1. CORS Policy Restriction ✅
**Before:** `Access-Control-Allow-Origin: *` (allows any domain)  
**After:** Whitelist-only CORS policy

- Only allows requests from:
  - `http://localhost:3000` (local development)
  - Domains specified in `ALLOWED_ORIGINS` environment variable
  - Vercel deployment URL (automatically detected)
- Prevents unauthorized domains from accessing the API

**Configuration:**
To add your production domain, set the `ALLOWED_ORIGINS` environment variable in Vercel:
```
ALLOWED_ORIGINS=https://your-domain.vercel.app,https://your-custom-domain.com
```

---

### 2. Restricted PATCH Updates ✅
**Before:** Could update ANY column in the spreadsheet  
**After:** Only allows updates to `claimedBy` and `claimedDate`

- Whitelist enforcement: `ALLOWED_UPDATE_FIELDS = ['claimedBy', 'claimedDate']`
- All other fields (like `recipient`, `deliverTo`, `id`, etc.) are now protected
- Attempts to update unauthorized fields are silently ignored

**Security Impact:**
- ✅ Cannot modify sensitive fields like `recipient`, `deliverTo`, `item`, `url`
- ✅ Cannot corrupt data by modifying `id` field
- ✅ Cannot inject malicious data into any field except the two allowed ones

---

### 3. Input Validation & Sanitization ✅
**Before:** No validation or sanitization  
**After:** Comprehensive validation and sanitization

**ID Validation:**
- Must match regex: `/^[a-zA-Z0-9_-]+$/`
- Prevents injection attacks through ID parameter
- Rejects special characters that could break logic

**Formula Injection Prevention:**
- Detects and neutralizes formula injection attempts
- If input starts with `=`, `+`, `-`, or `@`, prefixes with single quote (`'`)
- Google Sheets treats quoted values as text, preventing formula execution
- Example: `=HYPERLINK('http://evil.com', 'click')` becomes `'=HYPERLINK(...)`

**Length Limits:**
- Input values limited to 200 characters
- Prevents abuse with extremely long strings

**Request Validation:**
- Validates request body structure
- Ensures `data` object exists and is valid
- Validates ID presence and format before processing

---

### 4. Error Message Protection ✅
**Before:** Exposed internal error details (file paths, API errors, etc.)  
**After:** Generic error messages only

- All errors return generic message: `"Internal server error"`
- Full error details only logged server-side (not sent to client)
- Prevents information leakage that could aid attackers

**Before:**
```javascript
return res.status(500).json({ error: error.message }); // ❌ Leaks info
```

**After:**
```javascript
console.error('Google Sheets API error:', error); // ✅ Logged server-side
return res.status(500).json({ error: 'Internal server error' }); // ✅ Generic
```

---

### 5. Rate Limiting ✅
**Before:** No rate limiting  
**After:** 20 requests per minute per IP address

- Prevents DoS attacks
- Protects against API quota exhaustion
- Returns HTTP 429 (Too Many Requests) when limit exceeded

**Limits:**
- Maximum: 20 requests per IP per minute
- Window: 60 seconds rolling window
- Note: Uses in-memory store (resets on serverless function cold start)
  - For high-traffic production, consider Redis or Vercel Edge Config

---

### 6. Improved ID Lookup Security ✅
**Before:** Loose type coercion could cause false matches  
**After:** Strict string matching with validation

- Validates ID column exists before lookup
- Strict string comparison (no type coercion edge cases)
- Handles missing/undefined values safely

---

## Additional Security Improvements

### Request Body Validation
- Validates request body structure exists
- Ensures `data` is an object before processing
- Prevents crashes from malformed requests

### Column Index Validation
- Checks that ID column exists in spreadsheet
- Returns clear error if spreadsheet structure is unexpected
- Prevents undefined behavior

---

## Configuration Required

### Environment Variables (Vercel)

1. **Required:**
   - `GOOGLE_SERVICE_ACCOUNT` - Service account JSON (already configured)

2. **Optional (but recommended):**
   - `ALLOWED_ORIGINS` - Comma-separated list of allowed domains
     ```
     Example: ALLOWED_ORIGINS=https://your-app.vercel.app,https://custom-domain.com
     ```
   - `VERCEL_URL` - Automatically set by Vercel (includes your deployment URL)

### Local Development

- `http://localhost:3000` is automatically allowed
- No additional configuration needed for local dev

---

## Testing the Fixes

### Test 1: CORS Protection
```bash
# Should be blocked (if domain not in whitelist)
curl -H "Origin: https://evil.com" https://your-api.vercel.app/api/sheets
```

### Test 2: Field Restriction
```bash
# Should only update claimedBy, not recipient
curl -X PATCH "https://your-api.vercel.app/api/sheets?id=1" \
  -H "Content-Type: application/json" \
  -d '{"data":{"claimedBy":"John","recipient":"HACKED"}}'
# recipient should NOT be updated
```

### Test 3: Formula Injection Prevention
```bash
# Formula should be neutralized
curl -X PATCH "https://your-api.vercel.app/api/sheets?id=1" \
  -H "Content-Type: application/json" \
  -d '{"data":{"claimedBy":"=HYPERLINK(\"http://evil.com\",\"click\")"}}'
# Should be saved as text: '=HYPERLINK(...)
```

### Test 4: Rate Limiting
```bash
# Send 25 requests quickly
for i in {1..25}; do
  curl https://your-api.vercel.app/api/sheets
done
# Last 5 should return 429
```

### Test 5: Invalid ID
```bash
# Should be rejected
curl -X PATCH "https://your-api.vercel.app/api/sheets?id=<script>" \
  -H "Content-Type: application/json" \
  -d '{"data":{"claimedBy":"John"}}'
# Should return 400 Bad Request
```

---

## What's Still Missing (Medium Priority)

These are recommended but not critical for initial deployment:

1. **Persistent Rate Limiting** - Current implementation resets on cold start
   - Consider Vercel Edge Config or Upstash Redis for production

2. **Request Size Limits** - Currently relies on Vercel defaults
   - Can add explicit limit if needed

3. **Audit Logging** - No logging of who accessed what
   - Consider adding logging for PATCH operations

4. **Spreadsheet ID in Env Var** - Currently hardcoded
   - Can move to environment variable for flexibility

---

## Security Status

✅ **Critical vulnerabilities:** FIXED  
✅ **High vulnerabilities:** FIXED  
🟡 **Medium vulnerabilities:** Most addressed, some improvements recommended  
🟢 **Low vulnerabilities:** Acceptable for current use case

**The API is now secure enough for production use without authentication, as long as field restrictions remain in place.**

