import { describe, it, expect } from 'vitest';
import { add } from './calculator.js';

describe('calculator', () => {
  it('adds two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });
});
