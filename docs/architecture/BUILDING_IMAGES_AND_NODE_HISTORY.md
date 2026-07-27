# Building Images and Node History Ranges

## Scope

This document records the post-lifecycle correction for private building `PLAN`/`REAL` images and
bounded Node sensor-history ranges. The RBAC blueprint remains authoritative.

## Private building images

Building images use the shared private-asset provider boundary extracted from Company Logo storage:

- `memory` in tests;
- local filesystem in development;
- private S3-compatible storage in production;
- the existing `ASSET_STORAGE_PROVIDER` and `ASSET_*` configuration.

Domain services generate keys in the form
`building-images/{companyId}/{buildingId}/{plan|real}/{uuid}.{extension}`. API responses expose only
an authenticated content endpoint; storage keys, local paths, buckets and provider configuration are
never public.

Uploads are multipart requests with `image` and `kind=PLAN|REAL`. PNG, JPEG and WebP are accepted
only when MIME type, extension and magic bytes agree. SVG, empty, disguised and files larger than
8 MiB are rejected. A building may contain at most four active PLAN and four active REAL images.
Concurrent uploads are serialized per building/kind with a PostgreSQL transaction advisory lock.

Admin endpoints require `building-plans.view` or `building-plans.manage`. Company endpoints require
the same permission plus backend company/building scope. Content responses use private cache
headers, ETag and `X-Content-Type-Options: nosniff`.

Deletion is durable:

1. set `PENDING_DELETE` and audit the request;
2. delete the provider object idempotently;
3. delete the database row and audit completion;
4. on provider failure, retain `DELETE_FAILED`, increment the attempt count, audit the failure and
   retry from the bounded background scanner.

The building foreign key is `ON DELETE RESTRICT`, and permanent-building deletion also treats image
rows as a blocker. A successful delete response therefore cannot leave a known image object behind
through a database cascade.

## API contract

```text
GET    /admin/buildings/:buildingId/images
POST   /admin/buildings/:buildingId/images
GET    /admin/building-images/:imageId/content
DELETE /admin/building-images/:imageId

GET    /company/buildings/:buildingId/images
POST   /company/buildings/:buildingId/images
GET    /company/building-images/:imageId/content
DELETE /company/building-images/:imageId
```

## Node history range contract

Both portals send `from` and `to` as ISO datetimes. The API requires `from < to`, permits at most 24
hours, applies `receivedAt >= from AND receivedAt < to`, and retains all existing permission and
Company scope checks. Table endpoints use page sizes 50 or 100 and descending order. Chart
endpoints use ascending order and return at most 500 deterministic, evenly distributed points,
including the range endpoints when present, plus raw/returned counts and a `sampled` flag.

The UI defaults to Hour/12 hours, also offers 1 and 24 hours, and converts a selected local calendar
day from local midnight/next midnight to a UTC half-open range. Future dates are disabled. A live
point is merged only when it belongs to the active range and no database point has the same
timestamp and values.

## Migration and rollout

Required production order:

1. back up the production database and private asset bucket;
2. run `prisma migrate deploy`, including the existing lifecycle migration before this building
   image migration;
3. confirm `prisma migrate status` reports no pending migrations;
4. deploy API;
5. deploy Web.

Do not deploy a generated Prisma Client that references lifecycle/image columns before migrations
complete. Do not use `prisma db push`. Rollback is forward-only: pause writes and retries, preserve
objects and deletion-state rows, restore from backup or ship a reviewed compensating migration.
