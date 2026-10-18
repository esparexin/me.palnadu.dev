/**
 * Class-name joiner. Small and local: a dependency here would be one more thing
 * to audit, and the only behaviour needed is dropping falsy values.
 */
export type ClassValue = string | false | null | undefined;

export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');
