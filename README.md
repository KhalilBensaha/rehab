# Delivery Management System

A Next.js dashboard for managing deliveries, products, companies, workers, and treasury analytics. Includes OCR-powered bulk product import (PDF/image) using Anthropic Claude.

## Features

- Product stock management (create, filter, status updates)
- Bulk import from PDF/image with OCR, preview, and duplicate handling
- Worker management (profiles, certificates, commissions)
- Assign products to workers, mark as delivered, and detach
- Sheets view for worker assignments
- Treasure dashboard for delivered-only revenue/benefit stats
- Multi-language UI (English, French, Arabic)
- Supabase integration (auth, database, storage)

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Supabase (Auth, DB, Storage)
- Tailwind CSS + shadcn/ui components
- Anthropic Claude API for OCR

## Project Structure

- app/ – pages and API routes
- components/ – UI and layout components
- lib/ – auth, i18n, store, Supabase utilities
- public/ – static assets
- styles/ – global styles

## Requirements

- Node.js 18+
- pnpm or npm
- Supabase project
- Anthropic API key (for OCR import)

## Environment Variables

Create .env.local:

- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_ANON_KEY=
- SUPABASE_SERVICE_ROLE_KEY=
- ANTHROPIC_API_KEY=
- CLAUDE_OCR_MODEL= (optional, default: claude-3-5-sonnet-latest)
- CLAUDE_OCR_FALLBACK_MODEL= (optional, default: claude-3-haiku-20240307)

## Install

```bash
npm install
```

## Run (Development)

```bash
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Supabase Setup

- Tables used: products, companies, delivery_workers, profiles
- Storage bucket: workers (or set NEXT_PUBLIC_SUPABASE_WORKERS_BUCKET)
- Ensure products.id is unique to prevent duplicates

## OCR Import Flow

1. Select company
2. Upload PDF/image
3. Extract items (Claude OCR)
4. Review/ edit extracted rows
5. Add all (duplicates are skipped)

## Duplicate Handling

- Single add: shows popup if ID already exists
- Bulk add: duplicates are skipped and a popup shows count
- Server-side: bulk insert uses upsert ignoreDuplicates

## Notes

- Login uses Supabase Auth; session is restored on refresh
- Treasure metrics only count delivered products

## License

Internal use
