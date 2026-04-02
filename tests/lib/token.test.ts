import { describe, it, expect } from 'vitest';
import { countTokens } from '../../lib/token';

describe('countTokens', () => {
  it('should return 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('should return 0 for null/undefined input', () => {
    expect(countTokens(null as unknown as string)).toBe(0);
    expect(countTokens(undefined as unknown as string)).toBe(0);
  });

  it('should count tokens for simple English text', () => {
    const result = countTokens('Hello world');
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(10); // "Hello world" should be ~2 tokens
  });

  it('should count tokens for Chinese text', () => {
    const result = countTokens('你好世界');
    expect(result).toBeGreaterThan(0);
  });

  it('should count tokens for mixed content', () => {
    const result = countTokens('Hello 你好 World 世界');
    expect(result).toBeGreaterThan(0);
  });

  it('should handle code snippets', () => {
    const code = `function hello() {
      console.log("Hello, World!");
    }`;
    const result = countTokens(code);
    expect(result).toBeGreaterThan(5);
  });

  it('should handle long text', () => {
    const longText = 'This is a test sentence. '.repeat(100);
    const result = countTokens(longText);
    expect(result).toBeGreaterThan(100);
  });

  it('should handle special characters', () => {
    const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const result = countTokens(specialChars);
    expect(result).toBeGreaterThan(0);
  });

  it('should handle whitespace-only strings', () => {
    const result = countTokens('   \n\t  ');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should handle emoji', () => {
    const result = countTokens('Hello 👋 World 🌍');
    expect(result).toBeGreaterThan(0);
  });
});
