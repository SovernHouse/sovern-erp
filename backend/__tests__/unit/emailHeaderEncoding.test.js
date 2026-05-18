/**
 * RFC 2822 display-name encoding for outbound email To/From headers.
 *
 * Regression for the 2026-05-18 Ultimate Floors "Invalid To header"
 * incident. Lead.contact_name was "Ofer Dardashti, Founder". The
 * encodeHeader function returned ASCII strings verbatim, so the
 * To header built as:
 *
 *   To: Ofer Dardashti, Founder <info@ultimatefloors.net>
 *
 * Gmail parsed the unquoted comma as a recipient delimiter, saw two
 * recipients (one with no email), and rejected with "Invalid To
 * header". Fix wraps any ASCII display-name containing a comma /
 * semicolon / @ / colon / < / > / quote / backslash in a quoted-string
 * per RFC 5322 §3.4.1.
 */

const { encodeHeader } = require('../../services/emailService');

describe('encodeHeader — RFC 2822 display-name quoting', () => {
  test('plain ASCII name passes through unchanged', () => {
    expect(encodeHeader('Alex McConnell')).toBe('Alex McConnell');
  });

  test('empty / null inputs return empty string (Sequelize-friendly)', () => {
    expect(encodeHeader('')).toBe('');
    expect(encodeHeader(null)).toBe('');
    expect(encodeHeader(undefined)).toBe('');
  });

  test('common honorific with dot is NOT quoted (Mr. Ben, J. Smith)', () => {
    expect(encodeHeader('Mr. Ben')).toBe('Mr. Ben');
    expect(encodeHeader('J. Smith')).toBe('J. Smith');
  });

  test('parens are NOT quoted — Gmail treats them as RFC 5322 comments', () => {
    // Stevens Omni's contact ("John Cerisano (President)") sent OK
    // under the prior implementation, so we keep that behaviour.
    expect(encodeHeader('John Cerisano (President)')).toBe('John Cerisano (President)');
    expect(encodeHeader('Procurement Team (Samor Road HQ)')).toBe('Procurement Team (Samor Road HQ)');
  });

  test('comma in display-name IS quoted (the actual 2026-05-18 bug)', () => {
    expect(encodeHeader('Ofer Dardashti, Founder')).toBe('"Ofer Dardashti, Founder"');
  });

  test('semicolon, colon, @, < > all force quoting', () => {
    expect(encodeHeader('Buyer; Procurement')).toBe('"Buyer; Procurement"');
    expect(encodeHeader('Sales: Region 3')).toBe('"Sales: Region 3"');
    expect(encodeHeader('foo@bar Holdings')).toBe('"foo@bar Holdings"');
    expect(encodeHeader('<<HQ>>')).toBe('"<<HQ>>"');
  });

  test('inner double quote and backslash are escaped before being wrapped', () => {
    expect(encodeHeader('She said "hi", John')).toBe('"She said \\"hi\\", John"');
    expect(encodeHeader('a \\ b , c')).toBe('"a \\\\ b , c"');
  });

  test('non-ASCII forces RFC 2047 encoded-word (existing behaviour)', () => {
    expect(encodeHeader('Hänsel')).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    expect(encodeHeader('王伟')).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });

  test('From-header brand display names with pipe are NOT quoted', () => {
    // The Sovern brand display name convention "<BrandName> | Alex"
    // contains "|" which is not in the RFC 2822 specials set.
    expect(encodeHeader('Sovern House | Alex')).toBe('Sovern House | Alex');
    expect(encodeHeader('FlorWay | Alex')).toBe('FlorWay | Alex');
  });
});
