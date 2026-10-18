/**
 * @me-palnadu/ui
 *
 * Accessible React primitives shared by both applications (ARCHITECTURE.md 4).
 * This package must not import a router: a primitive that needs `next/link` or
 * `next/navigation` belongs in the app, not here.
 */
export { Button, ButtonLink, type ButtonProps, type ButtonLinkProps, type ButtonVariant, type ButtonSize } from './components/button.js';
export { Field, TextInput, type FieldProps, type TextInputProps } from './components/field.js';
export { Container, SectionHeading } from './components/layout.js';
export { cn, type ClassValue } from './lib/cn.js';