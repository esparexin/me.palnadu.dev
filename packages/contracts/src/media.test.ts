import {describe, expect, it} from 'vitest';
import {MediaRegisterSchema, MediaSignResponseSchema} from './index.js';

describe('media contract', () => {
  const asset = {
    publicId: 'me-palnadu/knowledge/example',
    secureUrl: 'https://res.cloudinary.com/example/image/upload/example.webp',
    format: 'webp',
    resourceType: 'image',
    bytes: 123_456,
    width: 1200,
    height: 800,
    originalFilename: 'example.webp',
  };

  it('accepts a registered image asset', () => {
    expect(MediaRegisterSchema.safeParse(asset).success).toBe(true);
  });

  it('rejects a format outside the accepted list', () => {
    expect(MediaRegisterSchema.safeParse({...asset, format: 'svg'}).success).toBe(false);
  });

  it('rejects an asset above the size ceiling', () => {
    expect(MediaRegisterSchema.safeParse({...asset, bytes: 20 * 1024 * 1024}).success).toBe(false);
  });

  it('requires every field a signature response needs', () => {
    expect(
      MediaSignResponseSchema.safeParse({
        signature: 'abc',
        timestamp: 1,
        apiKey: 'key',
        cloudName: 'cloud',
        folder: 'me-palnadu',
        uploadUrl: 'https://api.cloudinary.com/v1_1/cloud/image/upload',
        allowedFormats: ['jpg'],
      }).success,
    ).toBe(true);
  });
});
