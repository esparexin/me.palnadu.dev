import type {ArgumentMetadata, PipeTransform} from '@nestjs/common';
import type {ZodType} from 'zod';
import {ApiError, type ApiErrorDetail} from './api-error.js';

/**
 * Validation at the API boundary, using the canonical contracts (SSOT_POLICY 4).
 *
 * The pipe never coerces a shape into something the schema did not allow: unknown
 * keys are stripped by Zod's default object behaviour and rejected here, so a
 * client cannot smuggle a field into a persisted document (SECURITY.md 3).
 */
export class ZodValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // `metadata` is required by the PipeTransform interface but carries nothing this
    // pipe needs: the schema is bound in the constructor, so the shape being
    // validated is already known. Referencing it keeps the signature honest rather
    // than relying on an unused-argument convention.
    void metadata;
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details: ApiErrorDetail[] = result.error.issues.map((issue) => ({
      path: issue.path.length === 0 ? '(root)' : issue.path.map(String).join('.'),
      message: issue.message,
    }));
    throw ApiError.validationFailed('The request body failed validation.', details);
  }
}
