/**
 * Phase 4.18b — skillIndex unit tests.
 *
 * Locks the path-traversal guard, slug normalisation, and the cache.
 * Skill files are committed under backend/skills/; the tests assume
 * the real on-disk file set.
 */

const path = require('path');
const fs = require('fs');
const skillIndex = require('../../services/skillIndex');

describe('skillIndex.normaliseSlug', () => {
  const ok = ['trade-sales', 'sovern-icp', 'brand-safety', 'a', 'a-b-c-1'];
  const bad = [
    '', '   ', null, undefined, 42,
    '../etc/passwd', 'a/b', 'a\\b', '..',
    '.hidden', '.', 'Foo Bar', 'FOO!',
    'a'.repeat(81),
    'foo\0bar',
  ];

  for (const slug of ok) {
    test(`accepts "${slug}"`, () => {
      expect(skillIndex.normaliseSlug(slug)).toBeTruthy();
    });
  }
  for (const slug of bad) {
    test(`refuses ${JSON.stringify(slug)}`, () => {
      expect(skillIndex.normaliseSlug(slug)).toBeNull();
    });
  }

  test('strips trailing .md', () => {
    expect(skillIndex.normaliseSlug('trade-sales.md')).toBe('trade-sales');
  });

  test('case-folds to lowercase', () => {
    expect(skillIndex.normaliseSlug('Trade-Sales')).toBe('trade-sales');
  });
});

describe('skillIndex.getIndex', () => {
  beforeEach(() => skillIndex._resetCache());

  test('returns an array with at least one known Sovern skill', () => {
    const idx = skillIndex.getIndex();
    expect(Array.isArray(idx)).toBe(true);
    expect(idx.length).toBeGreaterThan(0);
    const slugs = idx.map(s => s.slug);
    expect(slugs).toContain('sovern-icp');
    expect(slugs).toContain('brand-safety');
  });

  test('every entry has slug + oneLineDescription', () => {
    const idx = skillIndex.getIndex();
    for (const e of idx) {
      expect(typeof e.slug).toBe('string');
      expect(e.slug.length).toBeGreaterThan(0);
      expect(typeof e.oneLineDescription).toBe('string');
    }
  });

  test('sorted alphabetically by slug', () => {
    const idx = skillIndex.getIndex();
    const slugs = idx.map(e => e.slug);
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(sorted);
  });

  test('caches: second call returns the same array reference', () => {
    const first = skillIndex.getIndex();
    const second = skillIndex.getIndex();
    expect(second).toBe(first);
  });
});

describe('skillIndex.readSkill', () => {
  test('reads a known skill (sovern-icp)', () => {
    const res = skillIndex.readSkill('sovern-icp');
    expect(res.error).toBeUndefined();
    expect(res.slug).toBe('sovern-icp');
    expect(typeof res.content).toBe('string');
    expect(res.bytes).toBeGreaterThan(50);
  });

  test('refuses path traversal (../)', () => {
    const res = skillIndex.readSkill('../etc/passwd');
    expect(res.error).toBeTruthy();
    expect(res.content).toBeUndefined();
  });

  test('refuses absolute path', () => {
    const res = skillIndex.readSkill('/etc/passwd');
    expect(res.error).toBeTruthy();
  });

  test('refuses backslash separator', () => {
    const res = skillIndex.readSkill('foo\\bar');
    expect(res.error).toBeTruthy();
  });

  test('refuses NUL byte', () => {
    const res = skillIndex.readSkill('trade-sales\0.md');
    expect(res.error).toBeTruthy();
  });

  test('returns error for unknown slug (but no leak of FS shape)', () => {
    const res = skillIndex.readSkill('this-skill-does-not-exist-xyz');
    expect(res.error).toBeTruthy();
    expect(res.error).toMatch(/not found/i);
  });

  test('accepts trailing .md', () => {
    const res = skillIndex.readSkill('sovern-icp.md');
    expect(res.error).toBeUndefined();
    expect(res.slug).toBe('sovern-icp');
  });
});
