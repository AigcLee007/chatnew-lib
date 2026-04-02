import { describe, it, expect } from 'vitest';

describe('Sanity Check', () => {
  it('should pass basic assertion', () => {
    expect(1).toBe(1);
  });

  it('should handle basic math', () => {
    expect(2 + 2).toBe(4);
  });

  it('should handle string operations', () => {
    expect('hello'.toUpperCase()).toBe('HELLO');
  });
});
