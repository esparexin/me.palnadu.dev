/**
 * A Phase 3 scaffold surface.
 *
 * Routes exist so that navigation never leads to a 404 and so that link checks
 * are meaningful, and each one states plainly what will live there and in which
 * phase. Inventing placeholder content to "fill" a route would violate the
 * content-integrity rule in AGENTS.md section 4, so nothing fictional is shown.
 */
export const PhaseNotice = ({
  phase,
  contents,
}: {
  phase: string;
  contents: readonly string[];
}) => (
  <div className="mt-10 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-6">
    <p className="text-meta font-semibold uppercase tracking-widest text-text-tertiary">
      Scheduled for {phase}
    </p>
    <ul className="flex list-disc flex-col gap-2 pl-5 text-body-sm text-text-secondary">
      {contents.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </div>
);