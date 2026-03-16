# AI News Reporter

This project runs a daily AI news reporter agent and can post output to Google Chat via webhook.

## Environment Setup

1. Copy `.env.example` to `.env.local`.
2. Fill all required values:

```bash
OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...
FIRECRAWL_API_URL=https://api.firecrawl.dev/v1/search
CRON_SECRET=...
CHAT_WEBHOOK_URL=...
```

Notes:
- `FIRECRAWL_API_URL` can stay as default unless you are using a proxy.
- If `CRON_SECRET` is set, the cron route must receive `Authorization: Bearer <CRON_SECRET>`.
- If `CHAT_WEBHOOK_URL` is empty, the report is generated but not posted.

## Run Locally

```bash
npm install
npm run dev
```

## Trigger the Daily Reporter

Route:

```text
GET /reporter/cron/daily-tools
```

Example request:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/reporter/cron/daily-tools
```

## Firecrawl Integration

The reporter now uses Firecrawl search instead of LangSearch to provide fresher web context for AI news generation.
