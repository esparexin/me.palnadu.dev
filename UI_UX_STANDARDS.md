# UI_UX_STANDARDS.md

The approved design direction, component rules, accessibility requirements, and
interaction specifications for both Next.js applications. Visual values live in
`packages/design-tokens`; this document defines them and the rules around them.

## 1. Design direction

White background, generous whitespace, restrained motion, high-contrast type, one accent
colour. Restraint is the aesthetic: a surface earns its border or shadow by carrying
meaning, not decoration. The site must feel authored, not templated, and must never
look like a stock template with a logo swapped in.

Non-negotiables:

- White (`#ffffff`) page background. No gradients behind body copy, no glassmorphism,
  no neon.
- System font stack, so the site renders in the platform's own typeface on Apple
  platforms and a close match elsewhere.
- One accent colour, used for primary actions, the active timeline node, and focus
  emphasis. Nothing else.
- Motion is short, eased, and optional. It never blocks content.

## 2. Tokens

Authored in `packages/design-tokens`, consumed through the shared Tailwind preset. No
app defines, overrides, or hardcodes a visual value.

### 2.1 Colour

| Token                                     | Value                                         | Use                                          |
| ----------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `surface`                                 | `#ffffff`                                     | Page and card background                     |
| `surface-subtle`                          | `#f5f5f7`                                     | Section alternation, hover fill, code blocks |
| `surface-muted`                           | `#e8e8ed`                                     | Dividers, track rails                        |
| `text-primary`                            | `#1d1d1f`                                     | Headings and body                            |
| `text-secondary`                          | `#424245`                                     | Supporting copy                              |
| `text-tertiary`                           | `#6e6e73`                                     | Meta, captions, timestamps                   |
| `text-inverse`                            | `#ffffff`                                     | Text on accent or dark surface               |
| `accent`                                  | `#0071e3`                                     | Primary CTA, active state, links             |
| `accent-hover`                            | `#0077ed`                                     | Hover/active of accent                       |
| `accent-subtle`                           | `#e8f2fe`                                     | Selected row, chip background                |
| `border`                                  | `#d2d2d7`                                     | Input and card borders                       |
| `border-subtle`                           | `#e8e8ed`                                     | Hairline dividers                            |
| `focus`                                   | `#0071e3`                                     | Focus ring                                   |
| `success` / `warning` / `danger` / `info` | `#1d8a4e` / `#b25000` / `#c8102e` / `#0b6bcb` | Status only, never decoration                |

Rules:

- Every pair used for text meets **4.5:1** against its actual background; large text
  (≥24px, or ≥18.66px bold) and UI boundaries meet **3:1**.
- Status colour is never the only signal — pair it with text or an icon.
- No raw palette utility and no arbitrary colour value in any file (§ `AGENTS.md` §3).

### 2.2 Typography

Font stack:

```
-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif
```

| Token     | Size / line-height | Weight | Tracking          | Use                     |
| --------- | ------------------ | ------ | ----------------- | ----------------------- |
| `display` | 56 / 60            | 600    | -0.02em           | Hero only, one per page |
| `h1`      | 40 / 46            | 600    | -0.02em           | Page title              |
| `h2`      | 28 / 34            | 600    | -0.015em          | Section title           |
| `h3`      | 21 / 28            | 600    | -0.01em           | Card title              |
| `lead`    | 21 / 30            | 400    | -0.01em           | Intro paragraph         |
| `body`    | 17 / 27            | 400    | 0                 | Body copy               |
| `body-sm` | 15 / 23            | 400    | 0                 | Dense body, list items  |
| `meta`    | 13 / 18            | 500    | 0.01em            | Dates, tags, captions   |
| `eyebrow` | 12 / 16            | 600    | 0.08em, uppercase | Section eyebrow         |

Rules:

- Type-size floor: 12px, permitted **only** for the uppercase, letter-spaced `eyebrow`
  label. Body-adjacent text is `meta` (13px) at minimum, and body copy is `body`
  (17px). `text-[11px]` and `text-[10px]` are banned outright.
- Body measure 60–75 characters; paragraphs over `body` width are wrapped in
  `Container` with a `measure` constraint.
- Exactly one `h1` per route; heading levels never skip a level.
- Tabular numerals (`font-variant-numeric: tabular-nums`) for dates, metrics, and
  durations.

### 2.3 Spacing, radius, elevation

- Spacing scale: `0 2 4 8 12 16 20 24 32 40 48 64 80 96 128`. Use scale steps only.
- Layout rhythm: 8px base. Vertical section padding 64px mobile, 96px desktop.
- Radius: `sm 6`, `md 8`, `lg 12`, `xl 16`, `2xl 20`, `pill 999`.
- Elevation is subtle and single-layer: `sm = 0 1px 2px rgb(0 0 0 / 0.04)`,
  `md = 0 8px 30px rgb(0 0 0 / 0.07)`, `lg = 0 20px 60px rgb(0 0 0 / 0.10)`.
  Cards at rest have **no** shadow; they gain one on hover or when raised by an
  explicit action.
- Container: max width 1120px, horizontal gutter 20px mobile, 32px ≥768px, 40px
  ≥1280px.
- Borders: 1px `border-subtle` for dividers, `border` for inputs and cards.

### 2.4 Motion

| Token           | Duration | Easing                           | Use                            |
| --------------- | -------- | -------------------------------- | ------------------------------ |
| `duration-fast` | 120ms    | `cubic-bezier(0.4, 0, 0.2, 1)`   | Hover, focus, colour           |
| `duration-base` | 200ms    | `cubic-bezier(0.4, 0, 0.2, 1)`   | Expand, fade, tooltip          |
| `duration-slow` | 320ms    | `cubic-bezier(0.32, 0.72, 0, 1)` | Drawer, panel, page transition |
| `ease-out`      | —        | `cubic-bezier(0.32, 0.72, 0, 1)` | Entrances                      |
| `ease-in-out`   | —        | `cubic-bezier(0.65, 0, 0.35, 1)` | Reversible transitions         |

Rules:

- Animate only `transform` and `opacity` for layout-affecting motion. Animating
  `width`, `height`, `top`, or `left` is banned.
- No entrance animation delays beyond 120ms; no animation longer than 320ms except a
  deliberate `duration-slow` drawer.
- Infinite or looping animation is banned on content.
- **`prefers-reduced-motion: reduce`**: all transitions and animations collapse to
  ≤0.01ms; parallax, autoplay, and swipe-snap momentum are disabled; state changes are
  conveyed by the DOM and focus order, not by movement. The reduced-motion path must
  remain fully usable, which is why every gesture in §7 has a button equivalent.

### 2.5 Breakpoints and z-index

Mobile-first. `sm 640`, `md 768`, `lg 1024`, `xl 1280`. Layout is designed for 320px,
verified at 375, 768, 1024, and 1440.

z-index scale: `base 0`, `sticky-header 100`, `fab 200`, `fab-panel 210`, `dialog 300`,
`toast 400`. Any z-index outside this scale is a defect.

## 3. Responsive rules

- No horizontal overflow at any width from 320px. `overflow-x: hidden` is **banned**
  as a fix; it hides the offending element instead of fixing it.
- Fluid type uses `clamp()` with token bounds, never a fixed px that breaks at 320px.
- Grids collapse `3 → 2 → 1`; the primary content column never exceeds
  `max-width: 720px` for prose.
- Content order in the DOM is the visual order at every breakpoint. Visual reordering
  that changes meaning is banned.
- The floating menu exists below `lg` only; the desktop header navigation exists at
  `lg` and up. Both are in the DOM with correct `hidden` state for their breakpoint;
  neither is removed via JavaScript.

## 4. Components

Primitives live in `packages/ui` and are the only implementation. Applications
compose; they do not re-implement.

`Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Dialog`,
`Popover`, `Tabs`, `Card`, `Badge`, `SectionHeading`, `Container`, `Prose`, `Skeleton`,
`Toast`, `FloatingMenu` (composition built from the primitives, not a primitive).

| Component                     | Requirement                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`                      | Three variants: primary (filled accent), secondary (outline), tertiary (text). Three sizes: `sm` 32px, `md` 40px, `lg` 48px. Min target 44×44 for anything primary |
| `Input`, `Textarea`, `Select` | Always a real `<label>` bound by id, visible placeholder only as a format hint, error text linked with `aria-describedby`, `aria-invalid` on error                 |
| `Dialog`                      | Focus trap, `Escape` to close, focus returns to the trigger, `role="dialog"` + `aria-modal="true"`                                                                 |
| `Popover`                     | Non-modal, dismisses on outside pointerdown and `Escape`, no scroll lock                                                                                           |
| `Card`                        | Entire card clickable ⇒ it is a `<button>` or a single `<a>`; never a `<div>` with an `onClick`                                                                    |
| `Skeleton`                    | Mirrors final layout dimensions; never a spinner for content                                                                                                       |
| `Prose`                       | The only renderer of rich content; `h2`–`h4`, lists, code, tables. Raw HTML injection is banned                                                                    |

## 5. Content layout rules

- One clear purpose per viewport. The hero communicates identity, role, and two
  actions.
- Long pages use section rhythm (title, supporting line, content) rather than padding
  for its own sake.
- Tables of contents or quick-jump links only when a page exceeds roughly five
  sections.
- Images: explicit dimensions, `alt` describing purpose (empty `alt` for decorative),
  lazy below the fold, eager + `fetchpriority="high"` only for the hero image.
- Empty states state what is missing and what to do next. Error states say what failed
  and offer a retry.

## 6. Accessibility (WCAG 2.2 AA)

Automated checks are necessary and not sufficient; manual keyboard and screen-reader
verification is required at the Manual Verification Gate.

| Criterion                    | Requirement                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| 1.3.1 Info and relationships | Semantic elements; headings in order; lists for lists; `alt` present       |
| 1.4.3 Contrast               | 4.5:1 text, 3:1 large text and UI boundaries                               |
| 1.4.4 Resize text            | Legible at 200% zoom without loss                                          |
| 1.4.10 Reflow                | No two-dimensional scrolling at 320px width                                |
| 1.4.11 Non-text contrast     | 3:1 for focus rings, borders that convey state, control outlines           |
| 1.4.12 Text spacing          | No clipping when the user overrides line height, spacing                   |
| 2.1.1 / 2.1.2 Keyboard       | Every interactive element operable; no keyboard trap except a modal dialog |
| 2.4.1 Bypass blocks          | A "Skip to content" link is the first focusable element                    |
| 2.4.3 Focus order            | Order follows DOM order; no positive `tabindex`                            |
| 2.4.7 Focus visible          | 2px `focus` ring with 3:1 contrast, offset, never `outline: none`          |
| 2.4.11 Focus not obscured    | Sticky header and floating menu must never cover the focused element       |
| 2.5.5 Target size            | Minimum 24×24 CSS px; 44×44 for primary actions                            |
| 2.5.7 Dragging movements     | Every swipe/drag has a single-pointer button equivalent                    |
| 2.5.8 Target size (minimum)  | Same as 2.5.5, enforced as AA in WCAG 2.2                                  |
| 3.2.3 Consistent navigation  | Navigation order is identical on every page                                |
| 4.1.2 Name, role, value      | Every control has an accessible name and correct state                     |

Additional rules:

- Every icon-only control has `aria-label`. Decorative icons are `aria-hidden`.
- Focus is never removed without a replacement; `:focus-visible` styles exist for all
  interactive elements.
- `lang="en"` on `<html>`; time, date, and duration are rendered through
  `packages/shared` formatters so wording is identical everywhere.
- Motion, autoplay, and parallax respect `prefers-reduced-motion`.
- Images of text are banned; text is real text.

## 7. Interaction specifications

### 7.1 Primary CTAs

- The hero contains exactly two CTAs, in this order: **View Resume** (primary, filled
  accent) and **Explore Experience** (secondary, outline). No third hero CTA and no
  duplicate of either within the first viewport.
- Section and navigation CTAs exist for **Experience**, **Projects**, **Knowledge Hub**,
  and **Contact**. Each is a single link; one primary CTA per section maximum.
- Duplicate CTAs pointing at the same destination within a single viewport are a
  defect and are removed.
- Destructive or administrative actions are never styled as the primary CTA of a
  content page.

### 7.2 Floating menu (below `lg`)

A menu button fixed to the right edge, vertically centred.

| Property      | Value                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Position      | `position: fixed; right: 16px; top: 50%; transform: translateY(-50%)`                                                                                       |
| Size          | 48×48, radius `pill`                                                                                                                                        |
| Appearance    | `surface` at 96% with `border` and `md` shadow, accent glyph                                                                                                |
| Behaviour     | `z-index: fab` (200). Hidden at `lg` and above                                                                                                              |
| Markup        | `<button>` with `aria-expanded`, `aria-controls="floating-nav-panel"`, `aria-label="Open navigation menu"`                                                  |
| Toggle        | Activating the button opens when closed and closes when open                                                                                                |
| Panel         | `id="floating-nav-panel"`, `role="dialog"`, `aria-label="Site navigation"`, `z-index: fab-panel` (210), width ≤ 280px, origin bottom-right, `duration-slow` |
| Panel content | A visible close control, then Experience, Projects, Knowledge Hub, FAQ, Resume, Contact                                                                     |

Close conditions — **all four are mandatory**:

1. **Outside tap.** A `pointerdown` outside both the panel and the trigger closes it.
   Implemented as a document-level listener registered while open and removed on
   close, so it never leaks.
2. **Navigation selection.** Selecting any item closes it, then the selection is
   followed (close first, navigate second — never both in a way that traps focus).
3. **Close control.** The panel's explicit close button closes it.
4. **`Escape`.** Closes it and returns focus to the trigger.

Additional rules:

- **The panel is non-modal.** It does not lock body scroll, does not dim the page, and
  does not use `aria-modal`. Background scrolling continues normally.
- Opening moves focus to the first navigation item. Closing always returns focus to
  the trigger button.
- Focus is contained only by the panel while it is open, and only for keyboard users
  pressing `Tab` past the last item.
- The panel closes on viewport resize past `lg`, which removes it from the layout.
- The trigger never covers a focused element (2.4.11): the page reserves scroll
  padding, or the trigger is hidden when it would overlap.
- `aria-expanded` reflects the real state on every transition.

### 7.3 Experience timeline

Data is ordered by `compareExperience` from `packages/shared` — newest first. The API
returns it; the UI never re-sorts.

**Desktop (`lg` and up): horizontal timeline**

- A horizontal rail with one node per entry, `text-primary` when inactive, `accent`
  when selected, connected by a `surface-muted` line.
- Hovering a node **previews**: a compact card with organisation, title, dates, and up
  to three highlights. Preview appears after 120ms and dismisses on pointer leave,
  `Escape`, or scroll.
- Clicking or pressing `Enter`/`Space` on a node **selects** the entry and opens the
  detail popup. Selection is single and exclusive; it is reflected with
  `aria-current="true"`.
- The popup has its **own scroll context**: `max-height: min(70vh, 640px)`,
  `overflow-y: auto`, `role="region"`, `aria-label`, `tabindex="0"` so it is keyboard
  scrollable. Scrolling inside the popup must never scroll the page behind it.
- The timeline container itself scrolls horizontally with `overflow-x: auto` when the
  node count exceeds the available width, with visible-but-subtle scroll affordance;
  it does not wrap, and it never overflows the page.
- Arrow keys move between nodes; `Home`/`End` jump to the first and last.

**Mobile (below `lg`): bottom-to-top swipeable slider**

- One experience per view, presented as a slider whose motion runs bottom-to-top.
- **Swipe up reveals a newer experience; swipe down reveals an earlier one.** The
  newest entry is the initial view.
- **Gesture ownership is explicit.** Pointer Events with a directional lock: the
  gesture is claimed only when it begins inside the slider's hit area, is more
  vertical than horizontal, and exceeds a velocity threshold. Any other pointer
  sequence is released to native page scrolling. The slider never calls
  `preventDefault` on a non-owned gesture.
- The slider never scrolls the page, and the page never scrolls the slider.
- **Visible navigation controls are mandatory:** an "Earlier" control, a "Newer"
  control, and a position indicator (`3 of 7`). These are the accessible equivalent
  required by WCAG 2.5.7 and are the only means of navigation under reduced motion.
- Keyboard: `ArrowUp` newer, `ArrowDown` earlier, `Home`/`End` ends of the timeline.
- Changes cross-fade with `duration-base`; under reduced motion the swap is
  instantaneous.
- A short label announces the entry (`aria-live="polite"`): organisation and title.
- Content inside each view is vertically scrollable if it exceeds the viewport; it
  never overflows horizontally.

### 7.4 Knowledge Hub and other lists

- Cards are links; the whole card is the target; no nested interactive elements.
- Filters are real buttons with `aria-pressed`, not styled links.
- An article body is rendered by `Prose`; headings inside an article start at `h2`
  because the page title is `h1`.

### 7.5 Forms

- One column, `md` width maximum, labels above fields, errors below with
  `aria-describedby`.
- Validation on blur and on submit; errors are announced via a summary with
  `role="alert"` and focus moves to it.
- Submit is disabled only while in flight, never because the form is "incomplete".
- Success and failure are stated in text, not by colour alone.

## 8. Documented exceptions to the visual rules

| Exception                                               | Condition                                                                            | Requirement                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Inline `style` for a CSS custom property                | Setting a token value sourced from contracts data (for example a per-article accent) | The value must come from a token or contracts enum, never a literal             |
| `!important`                                            | A third-party stylesheet cannot be overridden otherwise                              | Comment naming the library and the reason; removed when the library is replaced |
| Arbitrary value                                         | A token does not exist and no semantic need can be defined                           | Add a token instead; a literal is not acceptable                                |
| `overflow-x: hidden` on a specific fixed-position layer | Never                                                                                | Fix the offending element                                                       |

## 9. Design review checklist

- [ ] Every colour, size, radius, shadow, and duration comes from a token.
- [ ] No banned palette utility, arbitrary value, `!important`, or inline visual style.
- [ ] Contrast verified against the actual background, including hover and focus.
- [ ] One `h1`, ordered headings, landmarks, skip link, `lang` set.
- [ ] Full keyboard path, visible focus, no trap outside dialogs.
- [ ] Reduced-motion path works with no reliance on animation.
- [ ] No horizontal overflow at 320px; no content hidden behind the floating menu.
- [ ] Floating menu: opens, outside-tap close, nav close, close control, `Escape`
      close, focus return — all verified in the browser.
- [ ] Timeline: desktop hover preview, click popup with independent scroll, arrow-key
      navigation; mobile swipe up/down with visible controls.
- [ ] Required CTAs present exactly where specified, with no duplicates in a viewport.
- [ ] Axe/Playwright accessibility run is clean for changed routes.
