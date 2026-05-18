/**
 * Phase 4.18f — voiceRuleLinter unit tests.
 *
 * Locks the three correction rules: country Title Case, no em-dash,
 * IronLite "powered by" → "with IronLite Core Technology". Each rule
 * has positive (correction applied) and negative (already correct,
 * no double-correction) cases.
 */

const { lint, lintEmailParts } = require('../../services/voiceRuleLinter');

describe('voiceRuleLinter.lint — country Title Case', () => {
  test('capitalises lowercase malaysia and china in body text', () => {
    const r = lint('We ship from our factories in malaysia and china.');
    expect(r.text).toBe('We ship from our factories in Malaysia and China.');
    expect(r.corrections.find(c => c.rule === 'country-title-case').count).toBe(2);
  });

  test('does not flag already-capitalised country names', () => {
    const r = lint('We ship from our factories in Malaysia and China.');
    expect(r.text).toBe('We ship from our factories in Malaysia and China.');
    expect(r.corrections).toEqual([]);
  });

  test('Title-cases multi-word country names', () => {
    const r = lint('Compliance check for saudi arabia and united arab emirates.');
    expect(r.text).toBe('Compliance check for Saudi Arabia and United Arab Emirates.');
    const fix = r.corrections.find(c => c.rule === 'country-title-case');
    expect(fix.count).toBe(2);
  });

  test('Title-cases country names appearing in subject lines', () => {
    const r = lint('Quotation for vietnam project Q3 2026');
    expect(r.text).toBe('Quotation for Vietnam project Q3 2026');
  });

  test('only fixes WHOLE WORD matches (avoid mid-word false positives)', () => {
    // "indianapolis" contains "india" — should not be corrupted.
    const r = lint('Trade show in Indianapolis next month.');
    expect(r.text).toBe('Trade show in Indianapolis next month.');
  });
});

describe('voiceRuleLinter.lint — IronLite phrasing', () => {
  test('rewrites "powered by IronLite" to "with IronLite Core Technology"', () => {
    const r = lint('Our flooring is powered by IronLite Core Technology.');
    expect(r.text).toBe('Our flooring is with IronLite Core Technology.');
    expect(r.corrections.find(c => c.rule === 'ironlite-phrasing').count).toBe(1);
  });

  test('rewrites "powered by IronLite Core" (without Technology) too', () => {
    const r = lint('Our flooring is powered by IronLite Core.');
    expect(r.text).toBe('Our flooring is with IronLite Core Technology.');
  });

  test('rewrites the case-insensitive "Powered by IronLite" variant', () => {
    const r = lint('Powered by IronLite. We make it.');
    expect(r.text).toBe('with IronLite Core Technology. We make it.');
  });

  test('does not touch correct "with IronLite Core Technology"', () => {
    const r = lint('Our SPC range is with IronLite Core Technology.');
    expect(r.text).toBe('Our SPC range is with IronLite Core Technology.');
    expect(r.corrections.find(c => c.rule === 'ironlite-phrasing')).toBeUndefined();
  });
});

describe('voiceRuleLinter.lint — em-dash removal', () => {
  test('replaces unicode em-dash with comma', () => {
    const r = lint('We ship FOB Klang — pickup at the port.');
    expect(r.text).toBe('We ship FOB Klang, pickup at the port.');
    expect(r.corrections.find(c => c.rule === 'no-em-dash').count).toBe(1);
  });

  test('replaces double-hyphen approximation with comma', () => {
    const r = lint('We ship FOB Klang -- pickup at the port.');
    expect(r.text).toBe('We ship FOB Klang, pickup at the port.');
  });

  test('collapses surrounding whitespace cleanly', () => {
    const r = lint('A—B'); // no spaces around em-dash
    expect(r.text).toBe('A, B');
  });
});

describe('voiceRuleLinter.lint — null tolerance', () => {
  test('returns empty string for null input', () => {
    expect(lint(null)).toEqual({ text: '', corrections: [] });
  });

  test('returns empty string for undefined input', () => {
    expect(lint(undefined)).toEqual({ text: '', corrections: [] });
  });

  test('returns the original string unchanged when no rules apply', () => {
    const r = lint('Hello World, ready for next steps.');
    expect(r.text).toBe('Hello World, ready for next steps.');
    expect(r.corrections).toEqual([]);
  });
});

describe('voiceRuleLinter.lintEmailParts', () => {
  test('lints subject and body, tags corrections by field', () => {
    const r = lintEmailParts({
      subject: 'Quotation for malaysia project',
      bodyText: 'Powered by IronLite — let us know.',
    });
    expect(r.subject).toBe('Quotation for Malaysia project');
    expect(r.bodyText).toBe('with IronLite Core Technology, let us know.');
    const fields = r.corrections.map(c => c.field).sort();
    expect(fields).toContain('subject');
    expect(fields).toContain('bodyText');
  });

  test('returns empty corrections when both fields are clean', () => {
    const r = lintEmailParts({
      subject: 'Hello',
      bodyText: 'Ready to proceed.',
    });
    expect(r.corrections).toEqual([]);
  });

  test('handles missing subject/bodyText gracefully', () => {
    const r = lintEmailParts({});
    expect(r.subject).toBe('');
    expect(r.bodyText).toBe('');
    expect(r.corrections).toEqual([]);
  });
});
