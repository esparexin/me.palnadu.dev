import {describe, expect, it} from 'vitest';
import {isDeploymentAsset, signParams} from './media.service.js';

const asset = {
  cloudName: 'test-cloud',
  folder: 'me-palnadu/media',
  publicId: 'me-palnadu/media/verified-claim',
  secureUrl:
    'https://res.cloudinary.com/test-cloud/image/upload/v1/me-palnadu/media/verified-claim.png',
  format: 'png' as const,
  resourceType: 'image' as const,
};

describe('media registration ownership', () => {
  it('accepts a URL that resolves to the submitted public id', () => {
    expect(isDeploymentAsset(asset)).toBe(true);
    expect(isDeploymentAsset({...asset, secureUrl: `${asset.secureUrl}?v=2`})).toBe(false);
  });

  it('refuses a URL whose public id differs from the submitted id', () => {
    expect(
      isDeploymentAsset({
        ...asset,
        secureUrl:
          'https://res.cloudinary.com/test-cloud/image/upload/v1/me-palnadu/media/different.png',
      }),
    ).toBe(false);
  });

  it('refuses another cloud, resource type, or format', () => {
    expect(
      isDeploymentAsset({
        ...asset,
        secureUrl:
          'https://res.cloudinary.com/other-cloud/image/upload/v1/me-palnadu/media/verified-claim.png',
      }),
    ).toBe(false);
    expect(
      isDeploymentAsset({
        ...asset,
        secureUrl:
          'https://res.cloudinary.com/test-cloud/raw/upload/v1/me-palnadu/media/verified-claim.png',
      }),
    ).toBe(false);
    expect(
      isDeploymentAsset({
        ...asset,
        secureUrl:
          'https://res.cloudinary.com/test-cloud/image/upload/v1/me-palnadu/media/verified-claim.jpg',
      }),
    ).toBe(false);
  });

  it('refuses path traversal and public ids outside the upload folder', () => {
    expect(
      isDeploymentAsset({
        ...asset,
        publicId: 'me-palnadu/media/../verified-claim',
        secureUrl:
          'https://res.cloudinary.com/test-cloud/image/upload/v1/me-palnadu/media/../verified-claim.png',
      }),
    ).toBe(false);
    expect(
      isDeploymentAsset({
        ...asset,
        publicId: 'someone-else/verified-claim',
        secureUrl:
          'https://res.cloudinary.com/test-cloud/image/upload/v1/someone-else/verified-claim.png',
      }),
    ).toBe(false);
  });
});

/**
 * The Cloudinary signature is a security boundary: it is the only thing that
 * authorises an upload. These tests pin the documented recipe independently of
 * the code path that assembles the parameters.
 */
describe('Cloudinary request signing', () => {
  it('hashes sorted key=value pairs with the secret appended', () => {
    // Independently computed: sha1("a=1&b=2secret")
    expect(signParams({b: '2', a: '1'}, 'secret')).toBe('69021e767b8b2f38af0bcc5fcefee075eb2ec60d');
  });

  it('is independent of insertion order', () => {
    expect(signParams({folder: 'f', timestamp: '10', allowed_formats: 'jpg'}, 's')).toBe(
      signParams({timestamp: '10', allowed_formats: 'jpg', folder: 'f'}, 's'),
    );
  });

  it('changes when any signed parameter changes', () => {
    const base = signParams({folder: 'a', timestamp: '1'}, 'secret');
    expect(signParams({folder: 'b', timestamp: '1'}, 'secret')).not.toBe(base);
    expect(signParams({folder: 'a', timestamp: '2'}, 'secret')).not.toBe(base);
  });

  it('changes when the secret changes, even for identical parameters', () => {
    expect(signParams({folder: 'a', timestamp: '1'}, 'one')).not.toBe(
      signParams({folder: 'a', timestamp: '1'}, 'two'),
    );
  });
});
