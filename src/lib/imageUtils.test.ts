import { describe, it, expect } from 'vitest';
import { base64ToBlob } from './imageUtils';

// A minimal 1x1 red pixel JPEG in base64
const TINY_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=';

describe('base64ToBlob', () => {
  it('returns a Blob with the correct MIME type', () => {
    const blob = base64ToBlob(TINY_JPEG, 'image/jpeg');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/jpeg');
  });

  it('returns a non-empty Blob', () => {
    const blob = base64ToBlob(TINY_JPEG, 'image/jpeg');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('produces consistent output for the same input', () => {
    const blob1 = base64ToBlob(TINY_JPEG, 'image/jpeg');
    const blob2 = base64ToBlob(TINY_JPEG, 'image/jpeg');
    expect(blob1.size).toBe(blob2.size);
  });

  it('respects the provided MIME type', () => {
    const blob = base64ToBlob(TINY_JPEG, 'image/png');
    expect(blob.type).toBe('image/png');
  });
});
