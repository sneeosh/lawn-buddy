# Lawn Buddy - Copilot Instructions

## Project Overview

Lawn Buddy is a Cloudflare Workers application designed to help homeowners manage and maintain their lawn throughout the year.

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript
- **Build Tool**: Wrangler
- **Storage**: Cloudflare KV (optional)

## Development Guidelines

- Use TypeScript for type safety
- Follow REST API conventions for endpoints
- Implement proper error handling
- Add CORS headers as needed
- Test locally with `npm run dev` before deploying

## Common Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare Workers

## Project Structure Notes

- `/src` - Source code directory
- `wrangler.toml` - Cloudflare Workers configuration
- API endpoints should follow `/api/*` pattern
