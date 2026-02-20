# Grok Creative Studio Template

A minimal creative playground for generating images and video with [Grok AI](https://x.ai/) via [Vercel AI Gateway](https://vercel.com/docs/ai-gateway), built with Next.js and the [AI SDK](https://sdk.vercel.ai/).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fgrokcreativestudiotemplate&env=AI_GATEWAY_API_KEY&envDescription=Vercel%20AI%20Gateway%20API%20key&envLink=https%3A%2F%2Fvercel.com%2Fdocs%2Fai-gateway)

## Features

- Image generation with Grok Imagine via AI Gateway
- Video generation with Grok Imagine Video via AI Gateway
- Image and video editing (remix mode)
- Explore grid with 30 built-in seed generations
- Local text search (no external services needed)
- Works with just one environment variable (`AI_GATEWAY_API_KEY`)

## Getting Started

```bash
cp .env.example .env.local
# Add your AI_GATEWAY_API_KEY to .env.local

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AI_GATEWAY_API_KEY` | Yes | Vercel AI Gateway key ([docs](https://vercel.com/docs/ai-gateway)) |
| `DATABASE_URL` | No | Neon PostgreSQL connection string |
| `BLOB_READ_WRITE_TOKEN` | No | Vercel Blob storage token |
| `MUX_TOKEN_ID` | No | Mux video token ID |
| `MUX_TOKEN_SECRET` | No | Mux video token secret |
| `MIXEDBREAD_API_KEY` | No | Mixedbread vector search key |

## Feature Matrix

| Feature | `AI_GATEWAY_API_KEY` only | + `DATABASE_URL` | + All integrations |
|---|---|---|---|
| Explore grid | 30 seed items | DB-backed | DB-backed |
| Image generation | Base64 output | Persisted to DB | + Blob URLs + visual search |
| Video generation | Temporary URL | Persisted to DB | + HLS streaming (Mux) |
| Search | Local text filter | SQL ILIKE | + Visual search (Mixedbread) |
| Permanent URLs | No | No | Yes (Vercel Blob) |

## Database Setup

If you want persistent storage:

```bash
# Set DATABASE_URL in .env.local, then:
npm run db:setup   # Creates tables
npm run db:seed    # Populates with sample data
```

## Tech Stack

- [Next.js](https://nextjs.org) 16 with App Router
- [AI SDK](https://sdk.vercel.ai/) + [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)
- [Vercel Blob](https://vercel.com/docs/storage/blob) for file storage
- [Mux](https://mux.com) for video streaming
- [Neon](https://neon.tech) for PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) for styling
