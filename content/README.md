# content/

Approved seed content and reference material for the portfolio and Knowledge Hub.

**This directory is never a live content store.** MongoDB is the single source of
truth for published content (ARCHITECTURE.md section 8); the admin application is the
only supported authoring path. Files here are applied by an explicit, idempotent
import command that runs against staging before production, updates only records
whose `slug` matches an existing document, never creates or deletes records
implicitly, and writes a `content.import` audit entry.

Content integrity rules that apply to anything committed here:

- **Never invent** employers, job titles, employment dates, certifications,
  achievements, clients, or metrics (AGENTS.md section 4).
- Unverified material is seeded as `draft` and stays draft until reviewed.
- Fixtures use `example.com` addresses and placeholder copy, never real personal data.
- Every file is validated against `packages/contracts` before import, so a shape
  that drifts from the contracts fails at the gate rather than in the database.

The import command itself is implemented in a later phase; until it exists, this
directory holds reference material only and the API reads nothing from it.
