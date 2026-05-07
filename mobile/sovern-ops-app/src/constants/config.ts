// ─── Sovern Ops — App Config ──────────────────────────────────────────────
// Change SERVER_URL to point at the ERP backend.
// In production this is https://erp.sovernhouse.co
// For local dev use your machine's LAN IP, e.g. http://192.168.1.x:3001

export const CONFIG = {
  SERVER_URL: 'https://erp.sovernhouse.co',
  APP_NAME: 'Sovern Ops',
  BRAND_NAME: 'Sovern House',
  TAGLINE: 'Your buying office in Asia.',
  TOKEN_KEY: 'sovern_ops_token',           // SecureStore key for access token
  REFRESH_TOKEN_KEY: 'sovern_ops_refresh', // SecureStore key for refresh token
};

// ─── Design Tokens (matches ERP/website: ink, cream, forest) ──────────────
export const COLORS = {
  ink:       '#1A1A1A',   // primary text / dark background
  cream:     '#F5F0E8',   // light background / cards
  forest:    '#2D5A27',   // Sovern green — CTAs, headers
  forestDim: '#1B3B17',   // darker green for pressed states
  muted:     '#6B7280',   // secondary text
  border:    '#E5E0D8',   // dividers
  white:     '#FFFFFF',
  error:     '#DC2626',
  warning:   '#D97706',
  success:   '#16A34A',

  // Status chip colours
  statusNew:         '#3B82F6',
  statusContacted:   '#8B5CF6',
  statusQualified:   '#10B981',
  statusProposal:    '#F59E0B',
  statusNegotiation: '#EF4444',
  statusClosed:      '#6B7280',
};

export const FONTS = {
  regular: 'System',
  medium:  'System',
  bold:    'System',
};
