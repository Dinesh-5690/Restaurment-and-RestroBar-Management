# DineFlow cloud deployment

This repository is prepared for a Vercel frontend, a Render free web service, and an external managed PostgreSQL database. The free Render service can sleep when idle; allow for cold starts.

## 1. Push the repository from your own account

Connect this repository to your GitHub account and push the source from your machine. Do not commit `.env` files, database URLs, passwords, or other credentials.

## 2. Create a managed PostgreSQL database

Create a database with your chosen provider and copy its connection URL. Keep the URL private and enter it only in Render's environment settings.

## 3. Deploy the backend on Render

Create a new Blueprint from the repository and select `render.yaml`. Set:

- `DATABASE_URL`: the managed PostgreSQL connection URL.
- `FRONTEND_URL`: temporarily use `http://localhost:3000`; replace it with the Vercel production URL in step 5.

The blueprint generates `JWT_SECRET`. It enables TypeORM schema synchronization for the first deployment to initialize a new database. After confirming the tables were created, set `DB_SYNCHRONIZE=false` in Render. Use migrations for future production schema changes.

## 4. Deploy the frontend on Vercel

Import the same repository and set the project root directory to `frontend`. Add these Production environment variables before deploying:

- `NEXT_PUBLIC_API_URL`: the Render backend origin, for example `https://dineflow-api.onrender.com`.
- `NEXT_PUBLIC_WS_URL`: the same Render backend origin.

The frontend adds `/api` to the API origin itself. Do not append `/api` to either value.

## 5. Finish CORS configuration

Copy the Vercel production URL into Render's `FRONTEND_URL` setting, then redeploy the backend. Preview deployment URLs are not automatically allowed; use the production URL or explicitly configure any additional trusted origins.

## Data and credentials

This setup creates a new PostgreSQL database. It does not copy local SQLite records or users. Migrate any records you need using a private, controlled process; do not upload `restaurant.db` through this repository or share its contents in chat. Change the seeded administrator password before inviting staff.
