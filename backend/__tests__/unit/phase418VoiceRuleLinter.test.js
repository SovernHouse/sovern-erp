/**
 * Phase 4.18f — voiceRuleLinter unit tests (extended).
 *
 * Locks every rewrite rule. Each rule has positive (correction
 * applied) and negative (already correct, no double-correction)
 * cases. Sentence-scoped rules (trader/middleman, trading company,
 * Sovern compensation language) include both in-context and
 * out-of-context cases so the linter doesn't over-correct
 * legitimate uses of the same words about competitors / brokers /
 * other parties.
 */

const { lint, lintEmailParts } = require('../../services/voiceRuleLinter');

// ── Rule 1: country Title Case ────────────────────────────────────
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

  test('only fixes WHOLE WORD matches (avoid mid-word false positives)', () => {
    const r = lint('Trade show in Indianapolis next month.');
    expect(r.text).toBe('Trade show in Indianapolis next month.');
  });
});

// ── Rule 2: em-dash → comma ───────────────────────────────────────
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
    const r = lint('A—B');
    expect(r.text).toBe('A, B');
  });
});

// ── Rule 3: IronLite phrasing ─────────────────────────────────────
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

// ── Rule 4: British English spellings ─────────────────────────────
describe('voiceRuleLinter.lint — British English spellings', () => {
  test('organize → organise (lowercase)', () => {
    const r = lint('We will organize the shipment.');
    expect(r.text).toBe('We will organise the shipment.');
    expect(r.corrections.find(c => c.rule === 'british-english').count).toBe(1);
  });

  test('Finalize → Finalise (Title Case preserved)', () => {
    const r = lint('Finalize the quote by Friday.');
    expect(r.text).toBe('Finalise the quote by Friday.');
  });

  test('COLOR → COLOUR (ALL CAPS preserved)', () => {
    const r = lint('PICK A COLOR FROM THE SAMPLE.');
    expect(r.text).toBe('PICK A COLOUR FROM THE SAMPLE.');
  });

  test('multiple terms in one sentence', () => {
    const r = lint('Optimize the program to organize colors.');
    expect(r.text).toBe('Optimise the programme to organise colours.');
    // optimize + program + organize + colors = 4 substitutions
    expect(r.corrections.find(c => c.rule === 'british-english').count).toBe(4);
  });

  test('inflections — organized, organizing, organization', () => {
    const cases = {
      'we organized it': 'we organised it',
      'organizing now': 'organising now',
      'the organization': 'the organisation',
      'fiber backing': 'fibre backing',
      'behavioral test': 'behavioural test',
      'aluminum oxide': 'aluminium oxide',
      'plank in meters': 'plank in metres',
    };
    for (const [input, expected] of Object.entries(cases)) {
      expect(lint(input).text).toBe(expected);
    }
  });

  test('does not touch already-British text', () => {
    const r = lint('We will organise the colour programme.');
    expect(r.text).toBe('We will organise the colour programme.');
    expect(r.corrections.find(c => c.rule === 'british-english')).toBeUndefined();
  });

  test('whole-word only — does not corrupt mid-word matches', () => {
    // "metaphor" contains "meta" not "meter"; "colorblind" contains
    // "color" though. The strict whole-word match means
    // "colorblind" gets rewritten to "colourblind" via the `color`
    // entry inside a word boundary, but only if its own
    // boundaries match. Let's lock the current behaviour: we DO
    // NOT touch "colorblind" because color is mid-word.
    const r = lint('A colorblind designer noted the metaphor.');
    expect(r.text).toBe('A colorblind designer noted the metaphor.');
  });
});

// ── Rule 5: trader / middleman in brand context ───────────────────
describe('voiceRuleLinter.lint — trader/middleman', () => {
  test('rewrites "Sovern is a trader" to "Sovern is a buying house in Asia"', () => {
    const r = lint('Sovern is a trader of flooring.');
    expect(r.text).toBe('Sovern is a buying house in Asia of flooring.');
    expect(r.corrections.find(c => c.rule === 'no-trader-middleman').count).toBe(1);
  });

  test('rewrites "middleman" same way (SH context)', () => {
    const r = lint('Sovern House is a middleman for the factories.');
    expect(r.text).toBe('Sovern House is a buying house in Asia for the factories.');
  });

  test('FlorWay context rewrites "trader" to "factory"', () => {
    const r = lint('FlorWay is a trader of SPC.');
    expect(r.text).toBe('FlorWay is a factory of SPC.');
  });

  test('HanHua context rewrites "middleman" to "factory"', () => {
    const r = lint('HanHua is a middleman in China.');
    // China + HanHua marker → factory context. Note: country Title
    // Case is already applied to China.
    expect(r.text).toBe('HanHua is a factory in China.');
  });

  test('does NOT touch competitor / unrelated context', () => {
    const r = lint('Our competitor is a trader.');
    expect(r.text).toBe('Our competitor is a trader.');
    expect(r.corrections.find(c => c.rule === 'no-trader-middleman')).toBeUndefined();
  });

  test('does NOT touch trader unrelated to Sovern in same paragraph different sentence', () => {
    const r = lint('Our broker is a trader. Sovern works with verified factories only.');
    // First sentence has no Sovern marker; second has no "trader".
    // Neither is rewritten.
    expect(r.text).toBe('Our broker is a trader. Sovern works with verified factories only.');
  });
});

// ── Rule 6: trading company in SH context ─────────────────────────
describe('voiceRuleLinter.lint — trading company', () => {
  test('rewrites "Sovern House is a trading company" to "Sovern House is a buying house in Asia"', () => {
    const r = lint('Sovern House is a trading company.');
    expect(r.text).toBe('Sovern House is a buying house in Asia.');
    expect(r.corrections.find(c => c.rule === 'no-trading-company').count).toBe(1);
  });

  test('case-insensitive match', () => {
    const r = lint('Sovern is a TRADING COMPANY in Taipei.');
    expect(r.text).toBe('Sovern is a buying house in Asia in Taipei.');
  });

  test('does NOT touch "trading company" without Sovern marker', () => {
    const r = lint('Our buyer runs a trading company in Singapore.');
    // Singapore Title Case applied, but trading company stays.
    expect(r.text).toBe('Our buyer runs a trading company in Singapore.');
  });
});

// ── Rule 7: JetCore stripping ─────────────────────────────────────
describe('voiceRuleLinter.lint — no JetCore', () => {
  test('rewrites JetCore to IronLite Core', () => {
    const r = lint('Our JetCore technology is featured on HGTV.');
    expect(r.text).toBe('Our IronLite Core technology is featured on HGTV.');
    expect(r.corrections.find(c => c.rule === 'no-jetcore').count).toBe(1);
  });

  test('case-insensitive match', () => {
    const r = lint('jetcore and JETCORE both go.');
    expect(r.text).toBe('IronLite Core and IronLite Core both go.');
    expect(r.corrections.find(c => c.rule === 'no-jetcore').count).toBe(2);
  });

  test('does not double-rewrite (chain ordering check)', () => {
    // The JetCore rewrite replaces with "IronLite Core" before the
    // British-spelling pass runs. IronLite Core is a brand name and
    // must not be Britishised.
    const r = lint('JetCore is great.');
    expect(r.text).toBe('IronLite Core is great.');
  });
});

// ── Rule 8: Sovern compensation language ──────────────────────────
describe('voiceRuleLinter.lint — Sovern compensation language', () => {
  test('rewrites "Sovern charges a commission" to the approved deflection', () => {
    const r = lint('Sovern charges a 5% commission on top of FOB.');
    expect(r.text).toContain('Alex will confirm our commercial terms with you directly');
    expect(r.corrections.find(c => c.rule === 'sovern-compensation-language').count).toBe(1);
  });

  test('rewrites "Sovern charges a sourcing fee"', () => {
    const r = lint('Sovern charges a sourcing fee of 5%.');
    expect(r.text).toContain('Alex will confirm our commercial terms');
  });

  test('rewrites "Sovern\'s buying commission" + "agency fee" + "markup"', () => {
    const cases = [
      'Our buying commission with Sovern is 5%.',
      'Sovern adds an agency fee of $2,000.',
      'Sovern applies a markup over FOB.',
    ];
    for (const input of cases) {
      const r = lint(input);
      expect(r.text).toContain('Alex will confirm our commercial terms');
    }
  });

  test('does NOT touch competitor/broker commission language', () => {
    const r = lint('The broker takes a 3% commission on the deal.');
    expect(r.text).toBe('The broker takes a 3% commission on the deal.');
    expect(r.corrections.find(c => c.rule === 'sovern-compensation-language')).toBeUndefined();
  });
});

// ── Rule 9: 40HC → 40 HQ ──────────────────────────────────────────
describe('voiceRuleLinter.lint — container abbreviation', () => {
  test('rewrites 40HC to 40 HQ', () => {
    const r = lint('One 40HC ships next week.');
    expect(r.text).toBe('One 40 HQ ships next week.');
    expect(r.corrections.find(c => c.rule === 'container-hq-preferred').count).toBe(1);
  });

  test('matches case-insensitively', () => {
    const r = lint('Two 40hc containers booked.');
    expect(r.text).toBe('Two 40 HQ containers booked.');
  });

  test('matches with hyphen / space variants', () => {
    expect(lint('booked 40-HC').text).toBe('booked 40 HQ');
    expect(lint('booked 40 HC').text).toBe('booked 40 HQ');
  });

  test('leaves "40 HQ" unchanged', () => {
    const r = lint('Two 40 HQ containers.');
    expect(r.text).toBe('Two 40 HQ containers.');
    expect(r.corrections.find(c => c.rule === 'container-hq-preferred')).toBeUndefined();
  });
});

// ── Null tolerance ────────────────────────────────────────────────
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

// ── Integration: lintEmailParts (subject + body) ──────────────────
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

  test('compound — multiple rules fire in one email', () => {
    const r = lintEmailParts({
      subject: 'Quote for malaysia',
      bodyText: 'JetCore is our SPC. Sovern is a trader. We organize one 40HC.',
    });
    expect(r.subject).toBe('Quote for Malaysia');
    expect(r.bodyText).toContain('IronLite Core is our SPC');
    expect(r.bodyText).toContain('Sovern is a buying house in Asia');
    expect(r.bodyText).toContain('We organise');
    expect(r.bodyText).toContain('40 HQ');
    // 5 rules fired: country-title-case (subject), no-jetcore,
    // no-trader-middleman, british-english, container-hq-preferred.
    const rules = new Set(r.corrections.map(c => c.rule));
    expect(rules.has('country-title-case')).toBe(true);
    expect(rules.has('no-jetcore')).toBe(true);
    expect(rules.has('no-trader-middleman')).toBe(true);
    expect(rules.has('british-english')).toBe(true);
    expect(rules.has('container-hq-preferred')).toBe(true);
  });
});
