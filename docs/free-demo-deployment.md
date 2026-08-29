# Free public demo deployment

This guide publishes CampusConnect as a free public **demo**, not a production environment. The free services sleep, have strict database and Redis limits, and cannot scale to the intended production capacity.

## Architecture

Deploy the `docker/render-free-demo.Dockerfile` image as one Render Web Service. It serves the Vite client and the Express API from the same HTTPS origin. That preserves the existing strict refresh-cookie, CSRF, and Socket.io security model without widening CORS or weakening cookie settings.

Use a MongoDB Atlas Free cluster and an Upstash Free Redis database. Do not deploy the local MongoDB or Redis Docker containers to Render.

## 1. Create the data services

1. In MongoDB Atlas, create a Free cluster, create a database user, and copy its `mongodb+srv://` connection string.
2. Add the Render service's outbound IP address to the Atlas network access list when Render shows it. For a temporary demo, Atlas may require allowing access more broadly; restrict it again before any real launch.
3. In Upstash, create a Redis database and copy its TLS connection URL. It must begin with `rediss://`.

## 2. Create the Render service

1. In Render, select **New → Web Service** and connect `vivek2875/CampusConnect`.
2. Select the `main` branch, the closest available region to your users, and the **Free** instance type.
3. Set the Dockerfile path to `docker/render-free-demo.Dockerfile` and leave the start command empty.
4. Set the health-check path to `/health/ready`.
5. Add the environment variables below as Render secrets, then deploy.

```text
NODE_ENV=production
PORT=10000
CLIENT_ORIGIN=https://YOUR-SERVICE.onrender.com
COOKIE_SECURE=true
TRUST_PROXY_HOPS=1
INITIALIZE_DATABASE_ON_START=true

MONGODB_URI=mongodb+srv://DATABASE_USER:DATABASE_PASSWORD@YOUR_CLUSTER/campusconnect?retryWrites=true&w=majority
REDIS_URL=rediss://default:REDIS_PASSWORD@YOUR_REDIS_HOST:PORT

JWT_ACCESS_SECRET=<unique random value, at least 32 characters>
REFRESH_TOKEN_PEPPER=<different unique random value, at least 32 characters>
EVENT_TICKET_SECRET=<different unique random value, at least 32 characters>

DEFAULT_TENANT_SLUG=campusconnect-demo
SEED_TENANT_NAME=CampusConnect Demo Campus
SEED_TENANT_DOMAIN=your-college.edu

SMTP_URL=<SMTP provider URL that supports port 2525>
MAIL_FROM=CampusConnect <verified-sender@your-provider.example>
```

`SEED_TENANT_DOMAIN` controls who can register. Do not use `gmail.com` for a real campus because it allows every Gmail account. For a personal demo, use an email domain you control or update the tenant through an administrator workflow later.

The Render Free plan blocks SMTP ports 25, 465, and 587. Gmail SMTP therefore cannot deliver verification messages there. Use an SMTP provider that supports port 2525 for the demo, or temporarily keep email verification links in application logs. Never add SMTP credentials to GitHub.

Cloudinary, Gemini, and web-push settings are optional. If enabled, add their existing environment variables in Render as secrets. Configure each integration fully or leave it unset.

## 3. Initialise the database

Keep `INITIALIZE_DATABASE_ON_START=true` for this free demo. The service creates the configured tenant if missing and lets Mongoose build the model indexes at startup. It is intentionally disabled by default and should be removed for a real production deployment, where indexes are created as a controlled release task.

## Free-tier limitations

- Render can sleep an inactive free web service; the first request after it sleeps may be slow.
- MongoDB Atlas Free has limited storage and throughput.
- Upstash Free has daily command limits. Redis backs rate limiting, sessions, and Socket.io; the chat service is consequently for demonstration use only.
- A free `onrender.com` address is sufficient for a demo. A custom domain normally costs money and is needed before a real launch.
