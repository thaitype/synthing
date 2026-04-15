import { describe, it, expect } from 'vitest';
import { ResolutionError } from './errors.js';

describe('ResolutionError', () => {
  it('has the correct name', () => {
    const err = new ResolutionError('port', 'missing');
    expect(err.name).toBe('ResolutionError');
  });

  it('is an instance of Error', () => {
    const err = new ResolutionError('port', 'missing');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of ResolutionError', () => {
    const err = new ResolutionError('port', 'missing');
    expect(err).toBeInstanceOf(ResolutionError);
  });

  it('sets key and reason', () => {
    const err = new ResolutionError('app_name', 'type_mismatch');
    expect(err.key).toBe('app_name');
    expect(err.reason).toBe('type_mismatch');
  });

  it('generates a default message when none is provided', () => {
    const err = new ResolutionError('db_password', 'connector_error');
    expect(err.message).toContain('db_password');
    expect(err.message).toContain('connector_error');
  });

  it('uses a custom message when provided', () => {
    const err = new ResolutionError('port', 'missing', { message: 'Custom message' });
    expect(err.message).toBe('Custom message');
  });

  it('supports failures array for batch errors', () => {
    const failures = [
      { key: 'port', reason: 'missing' },
      { key: 'host', reason: 'type_mismatch' },
    ];
    const err = new ResolutionError('port', 'missing', { failures });
    expect(err.failures).toEqual(failures);
  });

  it('has undefined failures when not provided', () => {
    const err = new ResolutionError('port', 'missing');
    expect(err.failures).toBeUndefined();
  });

  it('supports all reason values', () => {
    const reasons = ['missing', 'type_mismatch', 'connector_error'] as const;
    for (const reason of reasons) {
      const err = new ResolutionError('key', reason);
      expect(err.reason).toBe(reason);
    }
  });

  it('supports cause option', () => {
    const cause = new Error('original error');
    const err = new ResolutionError('port', 'connector_error', { cause });
    expect((err as unknown as { cause: unknown }).cause).toBe(cause);
  });
});
