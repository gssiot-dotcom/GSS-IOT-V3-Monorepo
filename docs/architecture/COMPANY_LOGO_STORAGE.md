# Company Logo Storage

## Status and scope

This document defines the implemented provider-neutral storage boundary for the optional
`Company.logoKey` asset. It applies only to company logos. Report export storage remains an
independent subsystem and building-plan provider selection remains an `OPEN_DECISION`.

No logo key, local path, bucket name, provider URL or presigned URL is exposed through an API
contract. `CompanyRecord.hasLogo` is the only storage-state hint returned with company metadata.

## Provider matrix

| Environment | Default provider | Required configuration                                      |
| ----------- | ---------------- | ----------------------------------------------------------- |
| test        | `memory`         | none                                                        |
| development | `local`          | `ASSET_LOCAL_STORAGE_DIR`, default `.data/assets`           |
| production  | `s3`             | private bucket, region and credentials through `ASSET_S3_*` |

`ASSET_STORAGE_PROVIDER=memory|local|s3` may be selected explicitly outside production.
Production startup rejects any provider other than `s3` and rejects missing S3 bucket, region,
access-key or secret-key configuration. S3-compatible endpoints and path-style access are
supported for private infrastructure; production credentials and deployment remain operational
work, not an implementation claim.

## Object identity and validation

Logo objects use this server-generated namespace:

```txt
company-logos/{companyId}/{uuid}.{png|jpg|webp}
```

The storage boundary rejects absolute paths, backslashes, NUL bytes, `..`, foreign namespaces and
keys that do not match the expected company-logo shape. Company reads and deletes additionally
verify that the key prefix matches the server-derived company ID.

Uploads are server-mediated multipart requests using field `logo`. The maximum body is 2 MiB.
Only PNG, JPEG and WebP magic bytes are accepted; declared MIME type and filename extension are
not trusted. Empty, malformed and SVG files are rejected with a client error.

## Authorization and API surface

| Endpoint                                  | Authorization                                                               |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `GET /company/branding/logo`              | every authenticated active Company user; company derived from the principal |
| `PUT /company/settings/logo`              | `settings.company.manage`                                                   |
| `DELETE /company/settings/logo`           | `settings.company.manage`                                                   |
| `GET /admin/companies/:companyId/logo`    | `companies.view`                                                            |
| `PUT /admin/companies/:companyId/logo`    | `companies.update`                                                          |
| `DELETE /admin/companies/:companyId/logo` | `companies.update`                                                          |

Reads are streamed by the API with the stored content type, `X-Content-Type-Options: nosniff`, a
content hash ETag and private revalidation caching. Missing metadata or objects return 404. The
backend guards remain the security boundary; sidebar and button checks are presentation only.

## Replacement and removal lifecycle

Replacement follows this order:

1. validate content and create a new server-generated key;
2. write the new private object;
3. transactionally update `Company.logoKey` and record a safe audit event;
4. if the transaction fails, delete the new object and rethrow;
5. after commit, best-effort delete the superseded object and log an opaque warning on failure.

Removal transactionally clears `Company.logoKey` and records an audit event before best-effort
object deletion. Repeated removal is idempotent. Audit values expose `hasLogo` and content type,
not storage keys.

## Web object URL lifecycle

The web client fetches logo bytes with the authenticated API helper and creates a browser object
URL. Replacing, removing, changing session/path and unmounting revoke superseded URLs. Company
Settings refreshes the shared Company branding context after mutations, so the sidebar updates
without a page reload. Selected-file previews own a separate object URL and revoke it on cancel,
replacement and unmount.
