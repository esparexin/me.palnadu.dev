import {ExperienceCreateSchema, type ExperienceCreateInput} from '@me-palnadu/contracts';

export const auditFor = (entityId: string) => ({
  actorId: '000000000000000000000001',
  action: 'experience_update' as const,
  entityType: 'experience' as const,
  entityId,
});

export const baseExperienceRecord = (
  overrides: Partial<ExperienceCreateInput> = {},
): ExperienceCreateInput => {
  const candidate: Record<string, unknown> = {
    slug: 'example-org-endpoint-engineer',
    org: 'Example Organisation',
    title: 'Endpoint Engineer',
    location: 'Remote',
    startDate: '2023-04',
    endDate: '2026-01',
    current: false,
    kind: 'full_time',
    summary: 'Placeholder summary used only in integration tests.',
    highlights: ['Placeholder highlight'],
    tech: ['Jamf Pro', 'Intune'],
    sortIndex: 0,
    published: true,
    ...overrides,
  };

  if (candidate['current'] === true) {
    delete candidate['endDate'];
  } else if (candidate['endDate'] === undefined) {
    candidate['endDate'] = '2026-01';
  }

  const parsed = ExperienceCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `fixture is not a valid contract value: ${JSON.stringify(parsed.error.issues)}`,
    );
  }
  return parsed.data;
};
