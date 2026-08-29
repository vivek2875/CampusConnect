# CampusConnect

CampusConnect is a tenant-aware campus platform built as a modular monolith. It includes secure identity, Marketplace, Complaint Management, Lost & Found, Events, Notices, Chat, Notifications, an AI assistant, and an operations dashboard, with a framework-free web client.

## Architecture decisions

- **Vanilla frontend:** HTML, CSS, and ES modules provide a lightweight, accessible client with no framework lock-in. Vite is used only for local development and optimized builds.
- **Modular backend:** feature modules own their domain, application, infrastructure, and presentation code. Shared code contains cross-cutting infrastructure only.
- **Multi-tenancy:** records carry a tenant reference and compound indexes make tenant-scoped lookups efficient.
- **Auth security:** short-lived access JWTs remain in memory; rotated opaque refresh tokens are hashed at rest and stored in HTTP-only cookies.
- **Redis:** Redis backs distributed rate limiting, authorization-state caching, and the Socket.io adapter so chat can scale across API replicas.
- **AI as advisory:** Gemini enriches complaint triage, pricing, and campus answers when configured; deterministic fallbacks keep core workflows available without an AI provider.

List endpoints use cursor pagination. For example, `GET /api/v1/auth/sessions?limit=20&cursor=…` returns a `meta.nextCursor` when another page exists.

## Deployment

`docker-compose.yml` is the local integration environment: MongoDB runs as a replica set because event registration and complaint updates use transactions, Redis is persistent, and Nginx exposes the web app, API, and WebSocket upgrade path on port 80.

Use `/health/live` for a process liveness probe and `/health/ready` for a dependency readiness probe. Index creation is deliberately an explicit release task in production, avoiding startup index-building latency on every API replica.

For a Render development environment, deploy the API Docker image and a static web service, point both at managed Redis and MongoDB Atlas, then set `CLIENT_ORIGIN`, `COOKIE_SECURE=true`, and the secrets in Render’s encrypted environment settings. Do not deploy the bundled MongoDB container to production.

For AWS production, run stateless API replicas behind an ALB (ECS/Fargate or EKS), use ElastiCache Redis and MongoDB Atlas or a MongoDB-compatible managed cluster with transaction support, terminate TLS at the ALB, and keep Cloudinary, SMTP, and Gemini keys in Secrets Manager. Socket.io requires sticky sessions at the load balancer or, preferably, its included Redis adapter across replicas. The supplied GitHub Actions workflow runs linting, tests, and production builds on every pull request and protected-branch push.

For a zero-cost public demonstration, follow [the free demo deployment guide](docs/free-demo-deployment.md). It packages the existing web client and API as a single Render service so the current cookie and WebSocket security design remains intact. It is deliberately not a production deployment path.
