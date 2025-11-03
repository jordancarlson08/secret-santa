# Security Audit Report - Google Sheets API Integration

**Date:** 2025-01-03  
**Application:** Gift Registry (Sub-for-Santa)  
**API Endpoint:** `/api/sheets`

## Executive Summary

This audit identifies **15 security vulnerabilities** ranging from critical to informational. The most severe issues involve unrestricted API access, no authentication, and potential for data manipulation or denial of service attacks.

---

## 🔴 CRITICAL VULNERABILITIES (Fix Immediately)

### 1. **Unrestricted CORS Policy - API Accessible from Any Domain**
**Severity:** CRITICAL  
**Location:** `api/sheets.js:45`  
**Issue:** 
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```
**Risk:**
- Any malicious website can make requests to your API
- Attackers can steal data by embedding your API calls in their site
- Can be used for CSRF attacks even without user interaction
- Violates Same-Origin Policy protections

**Impact:** Complete API compromise, data theft, unauthorized operations

**Recommendation:**
```javascript
// Whitelist specific domains
const allowedOrigins = [
  'https://your-domain.vercel.app',
  'http://localhost:3000' // Only for dev
];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

---

### 2. **No Authentication or Authorization**
**Severity:** CRITICAL  
**Location:** `api/sheets.js:43-162`  
**Issue:** API has no authentication mechanism. Anyone can:
- Read all gift data
- Claim any gift
- Modify any column in the spreadsheet

**Risk:**
- Complete unauthorized access to data
- Ability to claim gifts fraudulently
- Data corruption or deletion
- Privacy violations (even though recipient is filtered)

**Impact:** Full system compromise, data integrity loss

**Recommendation:**
- Implement API key authentication for server-to-server calls
- Add rate limiting per IP address
- Consider requiring simple authentication for claim operations
- Log all operations with IP addresses for audit trail

---

### 3. **Unrestricted PATCH Updates - Can Modify Any Column**
**Severity:** CRITICAL  
**Location:** `api/sheets.js:125-141`  
**Issue:**
```javascript
Object.keys(data).forEach(key => {
  const colIndex = headers.indexOf(key);
  if (colIndex !== -1) {
    // Updates ANY matching column!
  }
});
```
**Risk:**
- Attacker can update `recipient`, `deliverTo`, or any sensitive column
- Can modify `id` field causing data corruption
- Can inject malicious data into any field
- No validation that only `claimedBy` and `claimedDate` should be updated

**Impact:** Data integrity loss, privacy violations, system corruption

**Recommendation:**
```javascript
// Whitelist only allowed fields
const ALLOWED_UPDATE_FIELDS = ['claimedBy', 'claimedDate'];
const sanitizedData = {};
Object.keys(data).forEach(key => {
  if (ALLOWED_UPDATE_FIELDS.includes(key)) {
    sanitizedData[key] = data[key];
  }
});
```

---

## 🟠 HIGH SEVERITY VULNERABILITIES

### 4. **No Rate Limiting - DoS Vulnerability**
**Severity:** HIGH  
**Location:** `api/sheets.js:43`  
**Issue:** No limits on:
- Number of requests per IP
- Frequency of requests
- Size of requests

**Risk:**
- Attacker can flood API with requests causing:
  - Google Sheets API quota exhaustion
  - Vercel function execution time/cost spikes
  - Service unavailability for legitimate users
- Can trigger expensive operations repeatedly

**Impact:** Denial of service, unexpected costs, service degradation

**Recommendation:**
- Implement rate limiting middleware (e.g., `express-rate-limit` or Vercel Edge Config)
- Limit to ~10 requests per minute per IP
- Return 429 status when limit exceeded

---

### 5. **No Input Validation - Injection Risks**
**Severity:** HIGH  
**Location:** `api/sheets.js:94-95, 115-116`  
**Issue:**
- `id` query parameter not validated (could be malicious)
- `claimedBy` name field not sanitized (could contain formula injection)
- No length limits on input fields
- No type checking

**Risk:**
- **Formula Injection:** If attacker sends `claimedBy: "=HYPERLINK('http://evil.com', 'Click')"`, Google Sheets will execute it
- **Script Injection:** Malicious data stored in cells could execute in other contexts
- **Data Corruption:** Invalid data types can corrupt spreadsheet
- **ID Manipulation:** Special characters in ID could break logic

**Impact:** Data corruption, potential code execution in spreadsheet, XSS if data displayed elsewhere

**Recommendation:**
```javascript
// Validate ID
const id = String(req.query.id).trim();
if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
  return res.status(400).json({ error: 'Invalid ID format' });
}

// Sanitize name - prevent formula injection
function sanitizeSheetValue(value) {
  if (typeof value !== 'string') return String(value);
  // Prevent formula injection by prefixing with single quote
  if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
    return "'" + value;
  }
  return value.slice(0, 100); // Limit length
}
```

---

### 6. **Error Message Information Disclosure**
**Severity:** HIGH  
**Location:** `api/sheets.js:159-161`  
**Issue:**
```javascript
catch (error) {
  console.error('Google Sheets API error:', error);
  return res.status(500).json({ error: error.message });
}
```
**Risk:**
- Error messages expose internal details:
  - Google API error details
  - File paths (in dev mode)
  - Service account structure
  - Spreadsheet structure

**Impact:** Information leakage aiding attackers

**Recommendation:**
```javascript
catch (error) {
  console.error('Google Sheets API error:', error);
  // Don't expose internal errors to client
  return res.status(500).json({ error: 'Internal server error' });
}
```

---

## 🟡 MEDIUM SEVERITY VULNERABILITIES

### 7. **No CSRF Protection**
**Severity:** MEDIUM  
**Location:** `api/sheets.js:43, src/App.jsx:108`  
**Issue:**
- No CSRF tokens
- CORS allows cross-origin requests (combined with no auth, CSRF is possible)
- Same-origin policy bypassed by CORS

**Risk:**
- Malicious site could trick authenticated users into making unwanted API calls
- While less critical without auth, still a concern for future auth implementation

**Impact:** Unauthorized actions on behalf of users

**Recommendation:**
- Add CSRF tokens when authentication is implemented
- Use SameSite cookies if cookies are added
- Verify Referer/Origin headers

---

### 8. **No Request Size Limits**
**Severity:** MEDIUM  
**Location:** `api/sheets.js:43`  
**Issue:** No limits on request body size

**Risk:**
- Attacker can send huge payloads causing:
  - Memory exhaustion
  - Slow processing
  - High function execution costs

**Impact:** Resource exhaustion, cost spikes

**Recommendation:**
- Limit request body to ~10KB
- Limit query parameters to reasonable size
- Use Vercel's built-in limits or add middleware

---

### 9. **Column Name Injection via Object Keys**
**Severity:** MEDIUM  
**Location:** `api/sheets.js:125`  
**Issue:**
```javascript
Object.keys(data).forEach(key => {
  const colIndex = headers.indexOf(key);
```
While `indexOf` prevents non-existent columns, the logic assumes:
- Column names match exactly
- No special characters in column names that could be manipulated
- Case sensitivity issues

**Risk:**
- If spreadsheet has columns like `claimedBy ` (with space), could be exploited
- Case-insensitive matching issues

**Impact:** Updates to wrong columns, data corruption

**Recommendation:**
- Use strict whitelist of allowed column names (already recommended in #3)
- Normalize column names (trim, lowercase comparison)
- Validate against actual headers array strictly

---

### 10. **ID Lookup Vulnerability**
**Severity:** MEDIUM  
**Location:** `api/sheets.js:114-117`  
**Issue:**
```javascript
const rowIndex = rows.findIndex((row, index) => {
  if (index === 0) return false;
  return row[idColumnIndex] === id || row[idColumnIndex] === id.toString();
});
```
**Risk:**
- Type coercion (`id.toString()`) could cause matches with unexpected values
- If `idColumnIndex` is -1 (column not found), could match wrong rows
- No validation that ID is unique

**Impact:** Updating wrong rows, data corruption

**Recommendation:**
```javascript
if (idColumnIndex === -1) {
  return res.status(500).json({ error: 'ID column not found' });
}
// Ensure exact match, proper type checking
const rowIndex = rows.findIndex((row, index) => {
  if (index === 0) return false;
  return String(row[idColumnIndex] || '') === String(id);
});
```

---

### 11. **Service Account File in Repository (Risk if Exposed)**
**Severity:** MEDIUM  
**Location:** `api/sheets.js:24`  
**Issue:**
```javascript
const credentialsPath = path.join(__dirname, '..', 'sub-for-santa-6th-ward-addf2efcb33a.json');
```
**Risk:**
- If JSON file accidentally committed to git, service account is exposed
- File exists in filesystem (less secure than env var)
- File name exposes project identifier

**Impact:** Complete Google Sheets access compromise if leaked

**Recommendation:**
- ✅ Already in `.gitignore` (good!)
- Use environment variables only in production
- Remove file path fallback or make it dev-only with warning
- Add pre-commit hook to prevent credential commits

---

### 12. **Missing Request Validation**
**Severity:** MEDIUM  
**Location:** `api/sheets.js:92-99`  
**Issue:**
- No validation that `data` exists in PATCH request
- No validation that `data` is an object
- No validation that body is JSON

**Risk:**
- Crashes from undefined errors
- Unexpected behavior with malformed requests

**Impact:** Service errors, potential exploitation

**Recommendation:**
```javascript
if (req.method === 'PATCH') {
  if (!req.body || typeof req.body !== 'object' || !req.body.data) {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  const { id } = req.query;
  const { data } = req.body;
  // ... rest of code
}
```

---

## 🟢 LOW SEVERITY / INFORMATIONAL

### 13. **Spreadsheet ID Hardcoded**
**Severity:** LOW  
**Location:** `api/sheets.js:3`  
**Issue:** Spreadsheet ID is hardcoded

**Risk:**
- Less flexible (can't switch sheets easily)
- ID visible in code (minor info disclosure)

**Impact:** Operational inflexibility

**Recommendation:**
- Move to environment variable: `SPREADSHEET_ID`

---

### 14. **No Logging/Monitoring**
**Severity:** LOW  
**Location:** `api/sheets.js`  
**Issue:** Only error logging, no audit trail

**Risk:**
- Can't detect abuse or anomalies
- No way to trace malicious activity
- Compliance issues (no audit log)

**Impact:** Difficult to investigate incidents

**Recommendation:**
- Log all operations: IP, timestamp, action, ID
- Set up alerts for unusual patterns
- Use Vercel Analytics or similar

---

### 15. **localStorage XSS Potential**
**Severity:** LOW  
**Location:** `src/App.jsx:34-38, 53-64`  
**Issue:**
- Data from API stored in localStorage without sanitization
- Data later rendered in React (React escapes by default, but still a risk)
- If data contains malicious scripts, could execute

**Impact:** XSS if data displayed unsafely

**Recommendation:**
- React already escapes by default (good)
- Consider sanitizing before localStorage storage
- Use DOMPurify if rendering HTML

---

## Summary of Recommendations by Priority

### Immediate Actions Required:
1. ✅ Fix CORS to whitelist specific domains
2. ✅ Add whitelist for PATCH updates (only allow `claimedBy` and `claimedDate`)
3. ✅ Implement input validation and sanitization (especially formula injection prevention)
4. ✅ Add rate limiting
5. ✅ Fix error message disclosure

### Short-term Improvements:
6. Implement authentication/authorization
7. Add request size limits
8. Improve ID validation and lookup
9. Add comprehensive logging
10. Fix CSRF protection

### Long-term Enhancements:
11. Move spreadsheet ID to environment variable
12. Add monitoring and alerting
13. Implement audit logging
14. Add API versioning

---

## Testing Recommendations

After implementing fixes, test for:
1. **CORS:** Try accessing API from unauthorized domain
2. **Rate Limiting:** Send 100+ requests quickly
3. **Input Validation:** Try formula injection: `claimedBy: "=HYPERLINK('http://evil.com', 'test')"`
4. **Column Whitelist:** Try updating `recipient` or other unauthorized columns
5. **Error Handling:** Trigger errors and verify no internal details leaked

---

## Additional Security Best Practices

1. **Regular Security Audits:** Review quarterly
2. **Dependency Updates:** Keep `googleapis` and other packages updated
3. **Secret Rotation:** Rotate service account keys periodically
4. **Least Privilege:** Service account should only have access to this specific sheet
5. **Backup Strategy:** Regular backups of spreadsheet data
6. **Access Control:** Limit who can edit the Google Sheet directly

