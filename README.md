# Gift Registry

A simple, responsive web application for managing a gift registry. Users can view available gifts and claim them by entering their name.

## Features

- 📱 Responsive design that works on mobile and desktop
- 🎨 Modern, clean UI with smooth animations
- ✅ Real-time gift claiming with name input
- 🔄 Automatic filtering of claimed gifts
- 🖼️ Support for gift images and product links

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool and dev server
- **SheetDB.io** - API for Google Sheets integration

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deployment to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and sign in
3. Click "New Project" and import your repository
4. Vercel will automatically detect Vite and configure the build settings
5. Click "Deploy"

The app will be live in seconds!

### Manual Vercel Deployment

Alternatively, you can use the Vercel CLI:

```bash
npm install -g vercel
vercel
```

## Google Sheets Setup

Make sure your Google Sheet has the following columns:
- `id` - Unique identifier for each gift
- `item` - Name of the gift item
- `previewUrl` - URL to an image (optional)
- `shouldWrap` - TRUE/FALSE (optional)
- `deliverTo` - Delivery address or location (optional)
- `receipient` - Recipient name (optional, note: there's a typo in the field name)
- `url` - Link to product page (optional)
- `other` - Additional notes (optional)
- `claimedBy` - Name of the person who claimed it (will be populated when claimed)

The API endpoint is already configured: `https://sheetdb.io/api/v1/s4ntthbwf4egb`

## How It Works

1. The app fetches all gifts from the SheetDB API
2. It filters out gifts where `claimedBy` is not empty
3. Users can click "Claim This Gift" to enter their name
4. Upon claiming, the app updates the spreadsheet with the user's name
5. The claimed gift is immediately removed from the list

## License

MIT

