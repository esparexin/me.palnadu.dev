import {HttpException} from '@nestjs/common';
import {ERROR_CODES, type ErrorCode} from '@me-palnadu/contracts';

/**
 * The only error type a controller throws for a business failure.
 *
 * The exception filter turns it into the single error envelope defined in
 * @me-palnadu/contracts, so a client never has to parse two error shapes
 * (CODING_STANDARDS.md section 4). The HTTP status is derived from the contract
 * error code, never chosen independently, which is what keeps the mapping
 * impossible to drift.
 */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export interface ApiErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends HttpException {
  readonly code: ErrorCode;
  readonly details: ApiErrorDetail[] | undefined;

  constructor(code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message, STATUS_BY_CODE[code]);
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string): ApiError {
    return new ApiError('BAD_REQUEST', message);
  }

  static validationFailed(message: string, details?: ApiErrorDetail[]): ApiError {
    return new ApiError('VALIDATION_FAILED', message, details);
  }

  /**
   * Absent or unusable credentials.
   *
   * A missing `Authorization` header is an authentication failure, not a malformed
   * request body. Reporting it as 422 would tell a client to fix a body it never sent,
   * and would make the status code useless for deciding whether to re-authenticate.
   */
  static unauthenticated(message: string, details?: ApiErrorDetail[]): ApiError {
    return new ApiError('UNAUTHENTICATED', message, details);
  }

  static notFound(message: string): ApiError {
    return new ApiError('NOT_FOUND', message);
  }

  static conflict(message: string): ApiError {
    return new ApiError('CONFLICT', message);
  }

  static payloadTooLarge(message: string): ApiError {
    return new ApiError('PAYLOAD_TOO_LARGE', message);
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError('INTERNAL_ERROR', message);
  }
}

export const statusForErrorCode = (code: ErrorCode): number => STATUS_BY_CODE[code];
export const contractErrorCodes: readonly ErrorCode[] = ERROR_CODES;
