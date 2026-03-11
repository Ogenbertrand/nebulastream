# Decisions

**2026-03-11: TypeScript monorepo with workspace references**
- TypeScript `strict` mode is required for type safety.
- Project references enable fast, incremental builds and clear dependency direction.
- Workspaces keep shared packages linked without publishing during development.

**2026-03-11: Clean architecture for services**
- Service code is split into `domain`, `application`, `interfaces`, and `infrastructure`.
- Domain rules stay framework-agnostic to support long-term maintainability.
