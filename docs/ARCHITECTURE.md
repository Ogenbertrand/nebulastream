# Architecture

NebulaStream follows clean architecture to keep business logic independent from frameworks and infrastructure.

**Service Layers**
- `domain`: Enterprise rules and immutable business types.
- `application`: Use cases and orchestration logic.
- `interfaces`: Delivery mechanisms such as HTTP handlers.
- `infrastructure`: External integrations and persistence.

**Dependency Rules**
- `domain` depends on nothing else in the service.
- `application` depends only on `domain` and shared packages.
- `interfaces` depends on `application` and `domain`.
- `infrastructure` depends on `domain` and `application`.

**Shared Packages**
- `@nebula/core` provides typed utilities, Result handling, and core interfaces.
