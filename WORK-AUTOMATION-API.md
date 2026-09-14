# Work Automation API

## Purpose

The Work API is served by /.netlify/functions/work-admin. It uses the existing Git-backed content files, so the current admin UI and the API see the same data. It does not access finance or appointments.

## Required Netlify secrets

- WORK_ADMIN_GITHUB_TOKEN: a GitHub fine-grained token limited to this repository and Contents read/write.
- WORK_ADMIN_TOKENS_JSON: token hashes and explicit permission scopes.
- WORK_ADMIN_ALLOWED_ORIGINS: comma-separated browser origins.
- WORK_ADMIN_REPOSITORY=elciadmin/veteriner-klinik-sitesi
- WORK_ADMIN_BRANCH=main
- WORK_ADMIN_RATE_LIMIT=60

Never store plaintext API tokens in source. Work sends a plaintext bearer token; Netlify stores only its SHA-256 hash. Revoke a Work token by removing its hash from WORK_ADMIN_TOKENS_JSON and redeploying.

Example token configuration:

    [{"id":"work-production","tokenHash":"SHA256_HEX","permissions":["content:read","content:create","content:update","content:publish","content:schedule","content:unpublish","content:trash","content:restore","media:read","media:create","deployment:read","audit:read"]}]

The normal Work token deliberately has no content:permanent-delete permission.

## Actions

Read actions use GET; mutations use POST with Authorization: Bearer TOKEN.

| Action | Scope | Description |
|---|---|---|
| list, get | content:read | Includes current SHA/version |
| create | content:create | Creates a draft |
| update | content:update | Requires current SHA for writes |
| publish | content:publish | Makes content live |
| schedule | content:schedule | Use ISO-8601 with Europe/Istanbul offset |
| unpublish | content:unpublish | Keeps content, removes it from display |
| trash | content:trash | Sets published false and trashed true |
| restore | content:restore | Returns as unpublished draft |
| permanentDeleteChallenge, permanentDelete | content:permanent-delete | Separate two-step high-risk deletion |
| mediaList, mediaCreate | media scopes | Media listing/upload; image files only, 5 MB maximum |
| verify | deployment:read | Checks generated production content manifest |
| audit | audit:read | Non-patient-data audit log |

Collection types: blog, announcements, faq, reviews, instagram.
Shared documents: services, stories, homeSelections, homeReviews, blogDesign.

Example create request:

    {"action":"create","type":"blog","id":"work-api-test-blog","data":{"title":"WORK-API-TEST-BLOG","summary":"Test content only.","content":"Test content only."}}

Example schedule request:

    {"action":"schedule","type":"blog","id":"work-api-test-planli","sha":"CURRENT_SHA","publishAt":"2026-09-15T10:00:00+03:00"}

## Security behavior

The API fails closed if GitHub credentials or token configuration are absent. Missing/invalid token is 401; missing scope is 403; invalid type/schema/path is 400; stale SHA is 409; rate limit is 429. Browser Origins are rejected if supplied but not allowlisted; server-to-server Work calls may omit Origin and must always use a bearer token.

Every mutation writes a prior-state backup and audit event to Netlify Blobs. Git paths are allowlisted, path traversal is rejected, and the GitHub credential remains inside Netlify. API mutations create ordinary Git commits and use the existing Netlify deploy pipeline.

For permanent delete, the record must already be trashed; a privileged, separate token requests a five-minute challenge; the caller must return the challenge, one-time token, and exact confirmation phrase. The normal Work token is always denied.

## Test protocol

Use only WORK-API-TEST-* content. Test create, get, update, publish, verify, unpublish, schedule, trash, restore and trash. Verify normal Work token permanent delete is 403. Use a separate high-risk token only to remove test records. Never use real content for test data.
