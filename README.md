# NebulaStream

NebulaStream is a production-ready, type-safe monorepo for building streaming platform services and apps.

**Structure**
- `apps/`: End-user applications.
- `services/`: Backend services and APIs.
- `packages/`: Shared libraries and cross-cutting utilities.
- `infra/`: Infrastructure and deployment assets.
- `docs/`: Architecture and developer documentation.

**Architecture**
- Clean architecture boundaries are enforced in service code: `domain` -> `application` -> `interfaces`/`infrastructure`.
- Shared, stable contracts live in `packages/` and are imported via workspace dependencies.
- TypeScript `strict` mode and branded types in `@nebula/core` provide strong typing at boundaries.

**Getting Started**
```bash
npm install
npm run build
```

**Run the API service**
```bash
npm run --workspace @nebula/api start
```

**Run the console app**
```bash
npm run --workspace @nebula/console start
```

**Documentation**
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/DECISIONS.md`
