import {
  cloneElement,
  isValidElement,
  type AriaAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import {cn} from '../lib/cn.js';

const FIELD_CLASS =
  'w-full min-h-10 rounded-md border border-border-default bg-surface px-3 py-2 ' +
  'text-body-sm text-text-primary placeholder:text-text-tertiary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

const FIELD_INVALID_CLASS = 'border-danger focus-visible:outline-danger';

interface FieldControlProps {
  'aria-describedby'?: string;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
}

/**
 * A field with a real label. The label is always rendered and bound by id; the
 * control is wired to its hint or error with aria-describedby, and an error marks
 * it invalid (UI_UX_STANDARDS 4). This happens here rather than in every form so a
 * new field cannot silently omit the relationships.
 */
export interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  children: ReactNode;
}

export const Field = ({id, label, hint, error, children}: FieldProps) => {
  const describedBy =
    error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined;
  const control = isValidElement<FieldControlProps>(children)
    ? cloneElement(children, {
        ...(describedBy === undefined
          ? {}
          : {
              'aria-describedby': [children.props['aria-describedby'], describedBy]
                .filter((value): value is string => value !== undefined && value.length > 0)
                .join(' '),
            }),
        ...(error === undefined ? {} : {'aria-invalid': true}),
      })
    : children;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-body-sm font-medium text-text-primary">
        {label}
      </label>
      {control}
      {hint !== undefined && !error && (
        <p id={`${id}-hint`} className="text-meta text-text-tertiary">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={`${id}-error`} className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const TextInput = ({className, invalid = false, ...rest}: TextInputProps) => (
  <input
    className={cn(FIELD_CLASS, invalid && FIELD_INVALID_CLASS, className)}
    aria-invalid={invalid || undefined}
    {...rest}
  />
);

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = ({className, invalid = false, ...rest}: TextareaProps) => (
  <textarea
    className={cn(
      FIELD_CLASS,
      'min-h-48 resize-y font-mono text-meta',
      invalid && FIELD_INVALID_CLASS,
      className,
    )}
    aria-invalid={invalid || undefined}
    {...rest}
  />
);

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = ({className, invalid = false, ...rest}: SelectProps) => (
  <select
    className={cn(FIELD_CLASS, 'cursor-pointer', invalid && FIELD_INVALID_CLASS, className)}
    aria-invalid={invalid || undefined}
    {...rest}
  />
);
