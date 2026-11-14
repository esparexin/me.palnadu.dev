import {computeReadingTime} from '@me-palnadu/shared';

const DASH = /[_-]+/gu;

export const humanize = (value: string): string => {
  const words = value.replace(DASH, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** Publication is an instant, not a calendar date; render it in UTC for everyone. */
export const formatPublished = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso));

export const readingTime = computeReadingTime;
