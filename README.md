# কৃষি পূর্বাভাস ও বাজার সংযোগ কেন্দ্র

Bangladesh-first, Bangla-language agricultural forecasting and market-linkage platform for farmers, buyers, field workers, and administrators.

## Project structure

```text
apps/
  api/                 Express + TypeScript API, Socket.IO, and Prisma
    prisma/            PostgreSQL data model and migrations
    src/               API source
  mobile/              Expo app for Android and the web
package.json           npm workspace scripts
```

The mobile app provides Bangla-first dashboard and operational modules for farmer, crop, forecast, buyer, collection, finance, and report workflows. User-entered records and endpoint settings are stored on-device with AsyncStorage. The API currently provides a health endpoint and the Prisma data model; production authentication, provider integrations, and data-backed weather/market routes still need to be configured before production use.

## Requirements

- Node.js 22.12 or newer (Node 24 LTS recommended)
- npm 10 or newer
- PostgreSQL 15 or newer

## Local setup

1. Install workspace dependencies:

   ```sh
   npm install
   ```

2. Create `apps/api/.env` from `apps/api/.env.example`, then set a PostgreSQL connection string and independent, random JWT secrets. The OTP provider is configured as `console` for local development only. Create `apps/mobile/.env` from `apps/mobile/.env.example` and set the API URL for your environment. For a physical phone, use your computer's LAN IP or a deployed HTTPS URL instead of `localhost`.

3. Generate the Prisma client and create the local database schema:

   ```sh
   npm run db:generate
   npm run db:migrate
   ```

   `db:migrate` runs Prisma's development migration workflow and prompts for a migration name.

4. Start the API and Expo app in separate terminals:

   ```sh
   npm run dev:api
   npm run dev:mobile
   ```

   To serve the app in a browser, use `npm run dev:web`. The API health check is at `http://localhost:4000/api/health`.
   Run these commands from the repository root; prefer `npm run dev:mobile` over starting Expo from inside a different folder so the correct app config and Expo Router entry are used.

## Database and schema

The Prisma schema is in `apps/api/prisma/schema.prisma`. It includes normalized records for accounts and phone OTP challenges, Bangladesh administrative areas, crops and farmer crop plans, buyer demand, forecasts and observed market prices, farmer-buyer matches, collection intake and storage movements, fee calculations, notifications, and engagement analytics.

After changing the schema, regenerate the client and create a migration:

```sh
npm run db:generate
npm run db:migrate
```

Use `npm run db:deploy` to apply committed migrations in a deployment environment. Never use development migrations against a production database.

## Checks and builds

```sh
npm run typecheck
npm run build
```

The mobile package builds a static web export with Expo. Its dashboard totals and chart are calculated from locally entered data. Crop forecast uses a three-value moving average and is not a guaranteed prediction. API endpoint settings are stored on-device; provider secrets must remain in `apps/api/.env` and must never use `EXPO_PUBLIC_*` variables.

The mobile workflow currently stores data locally and does not send SMS, WhatsApp, or voice messages. Dashboard and reports can be filtered by an upazila already entered in a record. Bengali numerals are accepted in numeric fields and normalized before calculations. Matching uses exact crop-name matches between farmer and buyer entries. Weather and market data are not fabricated; configure a real endpoint before expecting live values.

## Deployment outline

- **API and database:** deploy `apps/api` as a Node service on Railway or Render and provision PostgreSQL. Set `DATABASE_URL`, `PORT` (or the platform-provided port), JWT secrets, and provider credentials as platform secrets. Run `npm run db:deploy` as the release/deploy migration step.
- **Web app:** configure Vercel with the repository root, install command `npm install`, build command `npm run build:web --workspace @agri-link/mobile`, and output directory `apps/mobile/dist`. Set `EXPO_PUBLIC_API_URL` to the deployed API origin and rebuild after changing it.
- **Android:** build the Expo project with EAS Build after configuring the app identifier and signing credentials. Do not commit signing keys or `.env` files.
- **Operations:** use HTTPS, restrict CORS to deployed origins, set rate limits and OTP delivery credentials, and configure database backups and monitoring before production traffic.

## Localization and privacy notes

User-facing copy should be authored in Bangla and use Bengali-capable system fonts. Phone numbers should be normalized to E.164 format (for example `+8801...`) before persistence. Store OTP hashes rather than plaintext codes, keep secrets out of the client bundle, and collect only the location and farm data needed to provide the service.
