# DDR Early Access Landing Page

Gated landing page for early governance testing requests.

## Setup

```bash
cd early-access
npm install
npm run dev
```

Open [http://localhost:3002](http://localhost:3002)

## Features

- **Gated Access Form** — Collects structured information to filter appropriate testers
- **Clear Framing** — Explains what this IS (governance testing) and what it IS NOT (feature beta)
- **Structured Tasks** — Outlines exactly what testers will be asked to do
- **Guarantees** — No PII required, read-only observability, deterministic replay, sealed authority

## Deployment

Deploy to Vercel, Netlify, or any Next.js-compatible host.

```bash
npm run build
```

## Form Submissions

Currently logs to console. To collect submissions:

1. **Airtable** — Add Airtable API integration
2. **Supabase** — Store in Supabase table
3. **Email** — Send via Resend/SendGrid
4. **Webhook** — POST to your backend

## Customization

Edit `src/app/page.tsx` to:
- Update form fields
- Change messaging
- Add/remove sections
- Modify styling
