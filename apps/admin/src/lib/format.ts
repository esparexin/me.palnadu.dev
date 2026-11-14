/** Display formatting for the admin console. Deterministic and locale-pinned. */
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

export const formatDate = (iso: string): string => dateFormatter.format(new Date(iso));

export const formatDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso));

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** A human label for an audit action or enum value without restating the enum. */
export const humanize = (value: string): string => {
  const words = value.replace(/[_.]+/gu, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
