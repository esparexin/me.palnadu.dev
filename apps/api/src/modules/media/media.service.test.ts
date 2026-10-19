import {describe, expect, it} from 'vitest';
import {signParams} from './media.service.js';

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
