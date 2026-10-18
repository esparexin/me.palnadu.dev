# CODING_STANDARDS.md

Language, naming, import, error-handling, and forbidden-pattern rules for all
TypeScript in this repository. Lint rules named here are introduced with the toolchain
(gate 1) and are the mechanical form of this document.

## 1. TypeScript

Required compiler options in every package and app:

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "noPropertyAccessFromIndexSignature": true,
  "verbatimModuleSyntax": true,
  "isolatedModules": true,
  "forceConsistentCasingInFileNames": true,
  "skipLibCheck": true,
}
```

Hard requirements:

- **No `any`.** Not for parameters, not for returns, not for casts. Use `unknown` plus
  narrowing, or a precise generic.
- **No `@ts-ignore`.** `@ts-expect-error` requires a linked issue **and** an adjacent
  comment naming why the type is genuinely wrong. Both are lint errors otherwise.
- **No non-null assertion `!`** outside of tests and framework-narrowing cases where a
  preceding check guarantees it.
- **No floating promises.** `void` an intentionally un-awaited promise explicitly.
- Prefer `satisfies` over `as` for object literals, and `as const` for literal unions.
- Discriminated unions over optional-field bags for request payloads.

## 2. Naming

| Kind                 | Convention                                                      | Example                           |
| -------------------- | --------------------------------------------------------------- | --------------------------------- |
| Files                | `kebab-case.ts(x)`                                              | `experience-card.tsx`             |
| Components           | `PascalCase`, file name matches component                       | `ExperienceCard`                  |
| Types / schemas      | `PascalCase`, `Schema` suffix for Zod                           | `ExperienceCreateSchema`          |
| Functions, variables | `camelCase`                                                     | `computeTenure`                   |
| Hooks                | `useX`                                                          | `useExperienceTimeline`           |
| React contexts       | `PascalCase` + `Context`                                        | `SessionContext`                  |
| Constants            | `UPPER_SNAKE_CASE`                                              | `ARTICLE_STATUSES`                |
| Booleans             | `is`/`has`/`can`/`should` prefix                                | `isPublished`, `canEdit`          |
| Event handlers       | `handle` prefix                                                 | `handleNavSelect`                 |
| Props                | `handle` prefix for callbacks                                   | `onSelect`, `handleSelect`        |
| CSS classes          | token utility names only                                        | `text-body` (never `text-[11px]`) |
| Test files           | `*.test.ts(x)` colocated; `*.spec.ts(x)` for e2e in `tests/e2e` |                                   |

Files export the primary symbol by name. `export default` is allowed only for Next.js
`page.tsx`, `layout.tsx`, `route.ts`, and error/not-found boundaries.

## 3. Imports

- Type-only imports use `import type`. With `verbatimModuleSyntax` this is enforced by
  the compiler, not by convention.
- Cross-package imports use the package name (`@repo/contracts`). Relative paths do not
  cross a package boundary.
- Within an app or package, the `@/` alias maps to that workspace's `src/`. `@/`
  never resolves outside its own workspace.
- Import order: external packages → `@repo/*` → `@/` → relative. Enforced by lint.
- **No barrel files** (`index.ts` re-exporting siblings) outside a package's single
  public entry point. Barrels are what make cycles and bundle bloat hard to see.
- No dynamic `import()` of a string that no static import can resolve. Dynamic import
  is allowed only for genuine code splitting and must appear in the Knip entry list.

## 4. Error handling

**`apps/api`**

- Business failures throw `ApiError` with a code from `packages/contracts`. The global
  exception filter maps it to the contract error envelope; nothing else writes the
  response body.
- Status codes come from the contract error-code map. A handler never invents a code.
- `catch` blocks either handle the error or rethrow. An empty `catch`, a bare
  `catch {}`, or a `catch` that only logs and continues, is a lint error.
- Unexpected errors are logged with a request id and returned as an opaque
  `INTERNAL_ERROR`. Internal messages, stack traces, and driver errors never reach a
  client.
- Every write path performs its work in a transaction where it spans more than one
  document.

**`apps/web` and `apps/admin`**

- Route-level `error.tsx` boundaries handle failures; components do not invent their
  own global handlers.
- Expected states (empty, loading, error, offline) are explicit UI states, not
  exceptions.
- A failed fetch surfaces a real message. No silent `catch` that renders an empty list
  and hides an outage.

## 5. Logging

- Use the structured logger (`pino` in `api`, `next-logger`-equivalent or a minimal
  adapter in the Next.js apps). `console.log` is banned in shipped application code;
  `console.error`/`console.warn` are permitted only in error boundaries and `scripts/`.
- Log shape is `{ level, message, requestId, actorId?, route?, durationMs?, ...fields }`.
- **Secrets and personal data are never logged.** Contact message bodies, OAuth tokens,
  cookies, and connection strings are redacted at the logger, not at the call site.
- Log levels: `error` needs action, `warn` is a recoverable anomaly, `info` is a
  lifecycle event, `debug` is off in production.

## 6. Formatting

| Setting         | Value                                   |
| --------------- | --------------------------------------- |
| Indent          | 2 spaces, spaces only (tabs are errors) |
| Print width     | 100                                     |
| Semicolons      | Always                                  |
| Quotes          | Single                                  |
| Trailing comma  | All (ES5-safe multi-line)               |
| Bracket spacing | No (`{ foo }`)                          |
| Line ending     | LF, final newline required              |

The committed `.prettierrc` and ESLint flat config land with the toolchain PR; the
values above are the contract they must encode. Editor-level enforcement comes from
`.editorconfig`, which is already committed.

## 7. Forbidden patterns

| Pattern                                                                   | Rule                       | Why                                                     |
| ------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------- |
| `bg-[#fff]`, `text-[#000]`, `style={{ color }}`                           | Banned                     | Tokens are the only source of visual values             |
| `p-[13px]`, `rounded-[7px]`, `shadow-[...]`                               | Banned when a token exists | Same                                                    |
| `text-[11px]`, `text-[10px]`                                              | Banned outright            | Not accessible at any viewport                          |
| `!important`, inline visual `style`                                       | Banned                     | Unmaintainable; exceptions in `UI_UX_STANDARDS.md` §7   |
| Raw `<input>`, `<select>`, `<button>` in `apps/admin`                     | Banned                     | Use `packages/ui` primitives                            |
| `slate-*`, `gray-*`, `zinc-*`, `red-*`, `blue-*`, `emerald-*`, `purple-*` | Banned                     | Raw palette utilities                                   |
| `console.log` in app code                                                 | Banned                     | Structured logging instead                              |
| Prisma / Mongo import outside `apps/api`                                  | Banned                     | Persistence is the API's job                            |
| `NEXT_PUBLIC_*` holding a non-public value                                | Banned                     | Anything `NEXT_PUBLIC_` is public                       |
| `fetch` to the database                                                   | Banned                     | Same as the Prisma rule                                 |
| `Math.random()` in a render path                                          | Banned                     | Causes hydration mismatch                               |
| `dangerouslySetInnerHTML`                                                 | Banned                     | If genuinely required, it takes sanitization and an ADR |
| `setTimeout` for visual sequencing longer than 400ms                      | Banned                     | Use a transition or `prefers-reduced-motion`            |
| `alert()`, `confirm()`                                                    | Banned                     | Use `packages/ui` dialogs                               |

## 8. Comments

Comments explain **why**, never what. A comment restating the code is deleted. A
comment justifying a deviation from this document, a lint suppression, or a subtle
boundary decision must name the rule it relates to and, where applicable, the issue.

```ts
// Cast is safe: guarded by the allowlist check in AuthGuard above (SECURITY.md §4).
```

## 9. Tests are part of the change

- New behaviour ships with a test at the layer defined in `TESTING.md`.
- A bug fix ships with a test that fails before the fix. The PR states the failing
  test name and its output before and after.
- Tests are deterministic: no network, no wall-clock dependency (inject a clock), no
  randomness without a fixed seed, no reliance on execution order.
- `test.only` is banned; `.skip` requires a linked issue.

## 10. Review checklist

Before requesting review, confirm:

- [ ] No new `any`, suppression, or non-null assertion outside tests.
- [ ] Every new shared concept exists once, in the owning path (§ SSOT precedence).
- [ ] No import crosses a package boundary against the matrix in `ARCHITECTURE.md` §3.
- [ ] No token literal; no banned utility from §7.
- [ ] Errors are typed at the boundary; no empty `catch`.
- [ ] Tests cover the new behaviour and pass locally, with output pasted in the PR.
- [ ] Documentation changed where behaviour or contracts changed.
