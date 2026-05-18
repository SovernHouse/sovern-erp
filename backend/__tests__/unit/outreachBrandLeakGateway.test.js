/**
 * Outreach email brand-leak gateway — rule #9 / L-068 lock.
 *
 * Regression for the 2026-05-18 BPI incident: 17 FW outreach emails went
 * out via the MCP send_outreach_email path with the Sovern House
 * branding stamped on them (From "Sovern House | Alex" + SH signature
 * "Your buying office in Asia" + "Sovern House is a brand of New Route
 * International Exchange — Taiwan"). Surfaced when BPI's auto-responder
 * echoed our display name back as "Hi Sovern House | Alex".
 *
 * Root cause: the MCP handler didn't pass fromDisplayName and loaded
 * the user's default EmailSignature with no brand filter. emailService
 * defaulted both to the SH baseline. Same class of cross-brand leak
 * as the PriceList PDF incident (L-068, 2026-05-17).
 *
 * This gateway lives inside sendOutreachEmail. Any future caller that
 * tries to ship an inconsistent brand combination is refused at the
 * service boundary.
 */

// Mock the Gmail API + ConnectedGoogleAccount lookup so we can drive
// the gateway directly without leaving the unit-test process.
jest.mock('googleapis', () => ({
  google: {
    gmail: () => ({ users: { messages: { send: jest.fn(async () => ({ data: { id: 'mock', threadId: 'mock' } })) } } }),
    auth: { OAuth2: jest.fn(() => ({ setCredentials: jest.fn(), refreshAccessToken: jest.fn(async () => ({ credentials: {} })) })) },
  },
}));

jest.mock('../../models', () => ({
  ConnectedGoogleAccount: {
    findOne: jest.fn(async () => ({
      id: 'mock',
      email: 'alexflorway@gmail.com',
      accessToken: 'x',
      refreshToken: 'y',
      tokenExpiry: null,
      isActive: true,
    })),
  },
}));

jest.mock('../../controllers/googleAccountController', () => ({
  getAuthClientForAccount: jest.fn(async () => ({})),
}));

const { sendOutreachEmail } = require('../../services/emailService');

const SH_LEAKED_SIGNATURE_HTML = `
<div>
  <a href="https://sovernhouse.co">sovernhouse.co</a>
  <div>Your buying office in Asia.</div>
  <div>Sovern House is a brand of New Route International Exchange Co., Ltd. — Taiwan.</div>
</div>`;

const FW_SIGNATURE_HTML = `
<table><tr><td>
  <div>Alexander McConnell</div>
  <div>Country Manager, U.S.A/Canada</div>
  <div>FlorWay Sdn. Bhd. (Malaysia)</div>
  <div>Anhui HanHua Building Materials Technology Co., Ltd. (China)</div>
</td></tr></table>`;

describe('Outreach brand-leak gateway (rule #9 / L-068)', () => {
  test('refuses FW send when fromDisplayName is the SH default', async () => {
    await expect(sendOutreachEmail({
      fromAddress: 'alexflorway@gmail.com',
      fromDisplayName: 'Sovern House | Alex',  // wrong for FW
      toAddress: 'orders@bpiteam.com',
      subject: 'Malaysia LVT/SPC for BPI',
      bodyText: 'Hi team,',
      brandCode: 'FW',
      brandDisplayName: 'FlorWay',
    })).rejects.toThrow(/Brand-leak refused.*fromDisplayName.*Sovern House.*FlorWay/);
  });

  test('refuses FW send when the signature contains "Sovern House"', async () => {
    await expect(sendOutreachEmail({
      fromAddress: 'alexflorway@gmail.com',
      fromDisplayName: 'FlorWay | Alex',
      toAddress: 'orders@bpiteam.com',
      subject: 'Malaysia LVT/SPC for BPI',
      bodyText: 'Hi team,',
      signatureHtml: SH_LEAKED_SIGNATURE_HTML,
      brandCode: 'FW',
      brandDisplayName: 'FlorWay',
    })).rejects.toThrow(/signature.*FW.*Sovern House/i);
  });

  test('refuses FW send when the signature contains sovernhouse.co URL', async () => {
    await expect(sendOutreachEmail({
      fromAddress: 'alexflorway@gmail.com',
      fromDisplayName: 'FlorWay | Alex',
      toAddress: 'orders@bpiteam.com',
      subject: 'Malaysia LVT/SPC for BPI',
      bodyText: 'Hi team,',
      signatureHtml: '<div><a href="https://sovernhouse.co">sovernhouse.co</a></div>',
      brandCode: 'FW',
      brandDisplayName: 'FlorWay',
    })).rejects.toThrow(/sovernhouse\.co|Sovern House/i);
  });

  test('refuses SH send when the signature contains FlorWay markers', async () => {
    await expect(sendOutreachEmail({
      fromAddress: 'alex@sovernhouse.co',
      fromDisplayName: 'Sovern House | Alex',
      toAddress: 'buyer@somewhere.com',
      subject: 'Buying-house intro',
      bodyText: 'Hi,',
      signatureHtml: FW_SIGNATURE_HTML,
      brandCode: 'SH',
      brandDisplayName: 'Sovern House',
    })).rejects.toThrow(/SH outreach signature contains FW/);
  });

  test('refuses legacy callers (no brandCode) that send from FW address without overriding display name', async () => {
    await expect(sendOutreachEmail({
      fromAddress: 'alexflorway@gmail.com',
      // no fromDisplayName, no brandCode — pre-fix behaviour exactly
      toAddress: 'orders@bpiteam.com',
      subject: 'foo',
      bodyText: 'Hi team,',
    })).rejects.toThrow(/sending from alexflorway.*fromDisplayName missing/i);
  });

  test('accepts a correctly-branded FW send and reaches the Gmail API path', async () => {
    // Should not throw at the gateway. The mocked Gmail API will return
    // a mock messageId so this also confirms the gateway is non-blocking
    // for valid sends.
    const result = await sendOutreachEmail({
      fromAddress: 'alexflorway@gmail.com',
      fromDisplayName: 'FlorWay | Alex',
      toAddress: 'orders@bpiteam.com',
      subject: 'Malaysia LVT/SPC for BPI',
      bodyText: 'Hi team,\n\nWe ship from our factory in Malaysia.',
      signatureHtml: FW_SIGNATURE_HTML,
      brandCode: 'FW',
      brandDisplayName: 'FlorWay',
    });
    expect(result.messageId).toBe('mock');
    expect(result.via).toBe('gmail-api');
  });
});
