# What We Watchin?

A wheel for picking what the group watches. Everyone adds a few shows, someone locks the list, and you spin until one show is left. Then the room finds out who put the winner on the list.

No accounts. A short link is the invite.

## Vercel

1. Import this GitHub repo in Vercel (the Hobby plan is enough).
2. Open the project, then Storage, and create a Postgres database. Pick Neon. Vercel adds `DATABASE_URL` and `POSTGRES_URL` to the project. Connect that database to Production (and Preview, if you want preview links to work).
3. Deploy. The tables create themselves the first time someone opens the site.
4. Optional: if you want to create the tables by hand first, set `DATABASE_URL` and run `npm run db:setup`. You do not need this for a normal Vercel deploy.

The first visit after a quiet stretch can take a few seconds while the free database wakes up.

Use the pooled Postgres URL if Vercel shows both a pooled string and a direct one. `POSTGRES_URL` is preferred when it is set, and `DATABASE_URL` is the fallback.

## Local

You need Node 20+ and Postgres.

```bash
docker compose up -d
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

`docker compose` starts Postgres with the URL in `.env.example`. Any other Postgres is fine if `DATABASE_URL` or `POSTGRES_URL` points at it.

## Tests

Unit and database tests:

```bash
npm test
```

Browser smoke test (needs Postgres, and Chromium):

```bash
npx playwright install chromium
npm run test:e2e
```

## How a night works

- Someone starts a night and texts the link, like `/s/k7f2`.
- Each person enters a name on their phone. The name sticks on that device.
- Each person adds up to 3 shows. Titles show up on the wheel for everyone. Who added them stays hidden.
- You can remove your own shows until somebody hits Lock it in.
- Anyone can spin. The server picks the show that comes off, so two taps at once cannot knock out two different shows.
- The wheel lands on that pick, then redraws with whatever is left.
- The last show wins. The page then shows who added it, plus the full elimination order.
- Past nights lists finished sessions.
