This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel with Supabase

To deploy this project to Vercel and connect it to a Supabase database, follow these steps:

1. Create a new project on [Supabase](https://supabase.com/).
2. In your Supabase project settings, go to **Database** and copy your **Connection String** (URI) and **Direct Connection String** (Session mode).
3. Push your project code to GitHub.
4. Import your project into Vercel.
5. In the Vercel deployment settings, add the following Environment Variables:
   - `DATABASE_URL`: Set this to the pooled connection string from Supabase (typically starts with `postgresql://` and connects to the port `6543` if using Supavisor).
   - `DIRECT_URL`: Set this to the direct, unpooled connection string from Supabase (typically uses port `5432`).
   - `AUTH_SECRET`: Set this to a random 32-character string for NextAuth session encryption (generate via `openssl rand -base64 32`).

6. Deploy the project. The build step (`prisma generate && next build`) will automatically generate the Prisma Client using the provided connection settings.
7. Run migrations using the Supabase CLI or Prisma if you have not set up the database schema yet.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Extension Governance

- Security checklist for new extension actions: `src/extensions/SECURITY_CHECKLIST.md`
- Standardized extension error handling: `src/extensions/ERROR_HANDLING.md`

## Design System & Standards

### Typography
- **Headings**: Use `font-serif` (mapped to **Lora**) for a premium, editorial feel.
- **UI/Functional**: Use `font-sans` (mapped to **Inter**) for clarity and accessibility.
- Configuration: `src/ui_engine/design-system.config.ts`.

### Refresh Protocol
- **DILARANG** menggunakan `window.location.reload()`.
- **Gunakan** `router.refresh()` dari `next/navigation` untuk revalidasi data tanpa memicu full page reload.

