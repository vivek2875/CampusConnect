# CampusConnect

CampusConnect is a tenant-aware campus platform built as a modular monolith. It includes secure identity, Marketplace, Complaint Management, Lost & Found, Events, Notices, Chat, Notifications, an AI assistant, and an operations dashboard, with a framework-free web client.

## Architecture decisions

- **Vanilla frontend:** HTML, CSS, and ES modules provide a lightweight, accessible client with no framework lock-in. Vite is used only for local development and optimized builds.
- **Modular backend:** feature modules own their domain, application, infrastructure, and presentation code. Shared code contains cross-cutting infrastructure only.
- **Multi-tenancy:** records carry a tenant reference and compound indexes make tenant-scoped lookups efficient.
- **Auth security:** short-lived access JWTs remain in memory; rotated opaque refresh tokens are hashed at rest and stored in HTTP-only cookies.
- **Redis:** Redis backs distributed rate limiting, authorization-state caching, and the Socket.io adapter so chat can scale across API replicas.
- **AI as advisory:** Gemini enriches complaint triage, pricing, and campus answers when configured; deterministic fallbacks keep core workflows available without an AI provider.
- **Recommendations:** Marketplace recommendations use recent likes and wishlists to prioritize the user’s most-engaged category, then fall back to the newest eligible listings. This is fast, explainable, and can later be replaced behind the application service with an embedding/vector ranker without changing its API.

## Local setup

1. Copy `.env.example` to `.env` and replace the access-token, refresh-token, and event-ticket secrets with random values of at least 32 characters.
2. Start MongoDB (as a replica set) and Redis, or use Docker Compose after adding `.env`.
3. Install dependencies with `pnpm install`.
4. Create the initial campus: `pnpm --filter @campusconnect/api seed:tenant`.
5. In any non-development deployment, run `pnpm --filter @campusconnect/api db:create-indexes` as a one-off release task.
6. Run the web client and API: `pnpm dev`.

The demo tenant accepts only the email domain configured by `SEED_TENANT_DOMAIN`. For local verification/reset flows without SMTP, email links are written to the API log; production requires `SMTP_URL`.

Browser push is optional. To enable it, generate a VAPID key pair (for example with `npx web-push generate-vapid-keys`) and configure all of `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`. Leave all three blank to disable push safely. The public web client registers its service worker only after an authenticated user explicitly chooses **Enable push**.

## Quality commands

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## API surface: authentication

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
GET  /api/v1/auth/me
PATCH /api/v1/auth/me
GET  /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/:sessionId
POST /api/v1/auth/verify-email
POST /api/v1/auth/resend-verification
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

List endpoints use cursor pagination. For example, `GET /api/v1/auth/sessions?limit=20&cursor=…` returns a `meta.nextCursor` when another page exists.

## Marketplace API

All Marketplace routes require an authenticated tenant context. Listing prices are stored as `amountMinor` (for example, ₹499.00 is `49900`) with the fixed initial currency `INR`.

```text
POST   /api/v1/marketplace/uploads/signature
GET    /api/v1/marketplace/listings
POST   /api/v1/marketplace/listings
GET    /api/v1/marketplace/listings/mine
GET    /api/v1/marketplace/listings/:listingId
PATCH  /api/v1/marketplace/listings/:listingId
DELETE /api/v1/marketplace/listings/:listingId
POST   /api/v1/marketplace/listings/:listingId/likes
DELETE /api/v1/marketplace/listings/:listingId/likes
POST   /api/v1/marketplace/listings/:listingId/wishlists
DELETE /api/v1/marketplace/listings/:listingId/wishlists
GET    /api/v1/marketplace/wishlist
GET    /api/v1/marketplace/recommendations
POST   /api/v1/marketplace/listings/:listingId/offers
GET    /api/v1/marketplace/offers
PATCH  /api/v1/marketplace/offers/:offerId
```

## Complaints API

Complaint records are auditable, tenant-scoped, and use cursor pagination. Gemini can provide advisory classification, priority, summary, and ETA when `GEMINI_API_KEY` is configured; the workflow falls back to deterministic rules when it is not.

```text
POST  /api/v1/uploads/signature
GET   /api/v1/complaints
POST  /api/v1/complaints
GET   /api/v1/complaints/:complaintId
GET   /api/v1/complaints/:complaintId/history
PATCH /api/v1/complaints/:complaintId/assign
PATCH /api/v1/complaints/:complaintId/status
```

## Campus modules API

All write endpoints require an access token and a matching CSRF header/cookie pair. List endpoints use a bounded cursor page (`limit` at most 50).

```text
# Lost & Found
POST  /api/v1/lost-found/uploads/signature
GET   /api/v1/lost-found/items
POST  /api/v1/lost-found/items
POST  /api/v1/lost-found/items/:itemId/claims
GET   /api/v1/lost-found/items/:itemId/claims
PATCH /api/v1/lost-found/claims/:claimId

# Events
GET   /api/v1/events
POST  /api/v1/events
POST  /api/v1/events/:eventId/registrations
POST  /api/v1/events/:eventId/check-in

# Notices, notifications, and chat
GET/POST /api/v1/notices
GET      /api/v1/notifications
PATCH    /api/v1/notifications/:notificationId/read
GET      /api/v1/notifications/push/config
POST     /api/v1/notifications/push/subscriptions
DELETE   /api/v1/notifications/push/subscriptions
GET/POST /api/v1/conversations
GET/POST /api/v1/conversations/:conversationId/messages
PATCH    /api/v1/conversations/:conversationId/read

# AI and operations
POST /api/v1/ai/assistant
POST /api/v1/ai/marketplace/price-estimate
GET  /api/v1/admin/dashboard
GET  /api/v1/admin/users
```

## Deployment

`docker-compose.yml` is the local integration environment: MongoDB runs as a replica set because event registration and complaint updates use transactions, Redis is persistent, and Nginx exposes the web app, API, and WebSocket upgrade path on port 80.

Use `/health/live` for a process liveness probe and `/health/ready` for a dependency readiness probe. Index creation is deliberately an explicit release task in production, avoiding startup index-building latency on every API replica.

For a Render development environment, deploy the API Docker image and a static web service, point both at managed Redis and MongoDB Atlas, then set `CLIENT_ORIGIN`, `COOKIE_SECURE=true`, and the secrets in Render’s encrypted environment settings. Do not deploy the bundled MongoDB container to production.

For AWS production, run stateless API replicas behind an ALB (ECS/Fargate or EKS), use ElastiCache Redis and MongoDB Atlas or a MongoDB-compatible managed cluster with transaction support, terminate TLS at the ALB, and keep Cloudinary, SMTP, and Gemini keys in Secrets Manager. Socket.io requires sticky sessions at the load balancer or, preferably, its included Redis adapter across replicas. The supplied GitHub Actions workflow runs linting, tests, and production builds on every pull request and protected-branch push.
