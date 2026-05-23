import { describe, it, expect } from 'vitest';
import { deepMerge } from '../utils';

describe('deepMerge', () => {
  it('merges disjoint objects', () => {
    const result = deepMerge([
      { a: { b: '1' } },
      { a: { c: '2' } },
    ]);
    expect(result).toEqual({ a: { b: '1', c: '2' } });
  });

  it('throws on value collision', () => {
    expect(() =>
      deepMerge([
        { a: { b: '1' } },
        { a: { b: '2' } },
      ])
    ).toThrow('Collision detected at key path: a.b');
  });

  it('does not throw on identical values', () => {
    expect(() =>
      deepMerge([
        { a: { b: 'same' } },
        { a: { b: 'same' } },
      ])
    ).not.toThrow();
  });

  it('handles arrays as leaf values', () => {
    const result = deepMerge([
      { list: ['a', 'b'] },
      { other: 'x' },
    ]);
    expect(result).toEqual({ list: ['a', 'b'], other: 'x' });
  });
});
