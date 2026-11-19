import { describe, it, expect } from 'vitest';
import bcrypt from 'bcrypt';
import { hashPassword, hashPasswordSync, verifyPassword } from './password-hash';

describe('hashPassword', () => {
  it('returns a bcrypt hash, not the plain password', async () => {
    const hash = await hashPassword('huong2000');
    expect(hash).not.toBe('huong2000');
    expect(hash).toMatch(/^\$2[aby]\$10\$.{53}$/); // 60 chars, cost 10
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('huong2000');
    const b = await hashPassword('huong2000');
    expect(a).not.toBe(b);
  });

  it('handles unicode passwords', async () => {
    const hash = await hashPassword('mậtKhẩu#2026');
    expect(await verifyPassword('mậtKhẩu#2026', hash)).toBe(true);
  });
});

describe('hashPasswordSync', () => {
  it('returns a valid bcrypt hash', () => {
    expect(hashPasswordSync('huong2000')).toMatch(/^\$2[aby]\$10\$.{53}$/);
  });

  it('is compatible with verifyPassword', async () => {
    const hash = hashPasswordSync('huong2000');
    expect(await verifyPassword('huong2000', hash)).toBe(true);
  });

  it('is compatible with hashes from the async version', async () => {
    const hash = await hashPassword('huong2000');
    expect(bcrypt.compareSync('huong2000', hash)).toBe(true);
  });
});

describe('verifyPassword', () => {
  it('accepts the correct password', async () => {
    const hash = await hashPassword('huong2000');
    expect(await verifyPassword('huong2000', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('huong2000');
    expect(await verifyPassword('huong2001', hash)).toBe(false);
  });

  it('is case sensitive', async () => {
    const hash = await hashPassword('Huong2000');
    expect(await verifyPassword('huong2000', hash)).toBe(false);
  });

  it('rejects an empty password against a real hash', async () => {
    const hash = await hashPassword('huong2000');
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('returns false for a placeholder that is not a real hash', async () => {
    expect(await verifyPassword('Bluemoon#2026', 'hashed_Bluemoon#2026')).toBe(false);
  });

  it('only uses the first 72 bytes (known bcrypt limit)', async () => {
    const long = 'a'.repeat(72);
    const hash = await hashPassword(long + 'X');
    expect(await verifyPassword(long + 'Y', hash)).toBe(true); // extra chars ignored
  });
});