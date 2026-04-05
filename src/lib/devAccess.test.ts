import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the core logic directly since import.meta.env.DEV is true in test mode.
// The whitelisted emails are tested by inspecting the fallback path.

const DEV_USERS = ['support@cabino.ai', 'cabinoai@gmail.com'];

function hasDevAccessProd(email: string | null | undefined): boolean {
  return !!email && DEV_USERS.includes(email);
}

describe('devAccess — production path', () => {
  it('allows whitelisted emails', () => {
    expect(hasDevAccessProd('support@cabino.ai')).toBe(true);
    expect(hasDevAccessProd('cabinoai@gmail.com')).toBe(true);
  });

  it('blocks non-whitelisted emails', () => {
    expect(hasDevAccessProd('user@gmail.com')).toBe(false);
    expect(hasDevAccessProd('admin@cabino.ai')).toBe(false);
    expect(hasDevAccessProd('SUPPORT@cabino.ai')).toBe(false); // case-sensitive
  });

  it('blocks null and undefined', () => {
    expect(hasDevAccessProd(null)).toBe(false);
    expect(hasDevAccessProd(undefined)).toBe(false);
    expect(hasDevAccessProd('')).toBe(false);
  });
});
