# Lawn Buddy

Lawn care management application built with Cloudflare Workers. Help homeowners manage and take care of their lawn throughout the year.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Cloudflare account (for deployment)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your Cloudflare account and configure wrangler:
```bash
npx wrangler login
```

### Development

Start the development server:
```bash
npm run dev
```

The server will run on `http://localhost:8787`

### API Endpoints

- `GET /api/health` - Health check endpoint

### Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Project Structure

```
lawn-buddy/
├── src/
│   └── index.ts          # Main Worker entry point
├── wrangler.toml         # Cloudflare Workers configuration
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Features (Coming Soon)

- Lawn maintenance scheduling
- Weather-based recommendations
- Grass health tracking
- Seasonal care reminders
- Lawn analytics dashboard

## License

MIT

## Support

For issues or feature requests, please open an issue on GitHub.
