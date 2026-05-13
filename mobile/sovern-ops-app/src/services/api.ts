// ─── Sovern Ops — API Service ─────────────────────────────────────────────
// Thin wrapper around fetch that:
//   1. Prepends the configured server URL
//   2. Injects the JWT from the auth store
//   3. Returns typed responses and throws on non-2xx
//
// All ERP endpoints are the same ones used by the admin portal —
// no backend changes required for Phase 1.

import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/config';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CONFIG.TOKEN_KEY);
}

// Serializes concurrent 401 retries so we only hit /api/auth/refresh once.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const refreshToken = await SecureStore.getItemAsync(CONFIG.REFRESH_TOKEN_KEY);
      if (!refreshToken) return false;
      const res = await fetch(`${CONFIG.SERVER_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        await Promise.all([
          SecureStore.deleteItemAsync(CONFIG.TOKEN_KEY),
          SecureStore.deleteItemAsync(CONFIG.REFRESH_TOKEN_KEY),
        ]);
        return false;
      }
      const body = await res.json();
      const newAccess: string | undefined = body.data?.tokens?.accessToken;
      const newRefresh: string | undefined = body.data?.tokens?.refreshToken;
      if (!newAccess) return false;
      await SecureStore.setItemAsync(CONFIG.TOKEN_KEY, newAccess);
      if (newRefresh) await SecureStore.setItemAsync(CONFIG.REFRESH_TOKEN_KEY, newRefresh);
      return true;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  _retry = true,
): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${CONFIG.SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && _retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request(path, options, false);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────
// Backend wraps all responses as: { success, data, message }
// Login returns: { success, data: { user, tokens: { accessToken, refreshToken } } }
// /api/auth/me returns: { success, data: <user object> }

export async function login(email: string, password: string) {
  const res = await request<{
    success: boolean;
    data: { user: User; tokens: { accessToken: string; refreshToken: string } };
  }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const { accessToken, refreshToken } = res.data.tokens;
  await SecureStore.setItemAsync(CONFIG.TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(CONFIG.REFRESH_TOKEN_KEY, refreshToken);
  return { user: res.data.user };
}

export async function logout() {
  await Promise.all([
    SecureStore.deleteItemAsync(CONFIG.TOKEN_KEY),
    SecureStore.deleteItemAsync(CONFIG.REFRESH_TOKEN_KEY),
  ]);
}

export async function getCurrentUser(): Promise<User> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await request<{ success: boolean; data: User }>(
      '/api/auth/me',
      { signal: controller.signal },
    );
    return res.data;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────

export function getDashboard() {
  return request<DashboardSummary>('/api/dashboard');
}

// ─── Leads ────────────────────────────────────────────────────────────────

export function getLeads(params?: { status?: string; page?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString();
  return request<PaginatedResponse<Lead>>(`/api/crm/leads${qs ? `?${qs}` : ''}`);
}

export async function getLead(id: string) {
  const res = await request<{ success: boolean; data: Lead }>(`/api/crm/leads/${id}`);
  return res.data;
}

export function addActivity(leadId: string, note: string, type = 'note') {
  return request(`/api/crm/leads/${leadId}/activities`, {
    method: 'POST',
    body: JSON.stringify({ type, note }),
  });
}

// ─── Products ─────────────────────────────────────────────────────────────

export async function getProducts(params?: { search?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString();
  return request<PaginatedResponse<Product>>(`/api/products${qs ? `?${qs}` : ''}`);
}

export async function getProduct(id: string) {
  const res = await request<{ success: boolean; data: Product }>(`/api/products/${id}`);
  return res.data;
}

// ─── Customers ────────────────────────────────────────────────────────────

export async function getCustomers(params?: { search?: string; page?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString();
  return request<PaginatedResponse<Customer>>(`/api/customers${qs ? `?${qs}` : ''}`);
}

export async function getCustomer(id: string) {
  const res = await request<{ success: boolean; data: Customer }>(`/api/customers/${id}`);
  return res.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await request(`/api/customers/${id}`, { method: 'DELETE' });
}

export interface CustomerProfitability {
  customer: { id: string; companyName: string; country?: string };
  period: { from: string; to: string };
  currency: string;
  revenue: { invoiced: number; paid: number };
  cogs: number;
  directExpenses: { total: number; count: number };
  allocatedOverhead: { total: number; basis: string; revenueShare: number; overheadPool: number };
  grossProfit: number;
  netProfit: number;
  directCostRatio: number | null;
}

export async function getCustomerProfitability(
  id: string,
  params?: { from?: string; to?: string },
): Promise<CustomerProfitability> {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await request<{ success: boolean; data: CustomerProfitability }>(
    `/api/customers/${id}/profitability${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

// ─── Factories ────────────────────────────────────────────────────────────

export async function getFactories(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString();
  return request<PaginatedResponse<Factory>>(`/api/factories${qs ? `?${qs}` : ''}`);
}

export async function getFactory(id: string) {
  const res = await request<{ success: boolean; data: Factory }>(`/api/factories/${id}`);
  return res.data;
}

export async function deleteFactory(id: string): Promise<void> {
  await request(`/api/factories/${id}`, { method: 'DELETE' });
}

// Factory model — supplier directory entry. Backend blocks delete when
// open POs exist (status NOT IN 'completed'/'cancelled').
export interface Factory {
  id: string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  currency?: string;
  paymentTerms?: string;
  leadTimeDays?: number;
  certifications?: string[];
  specializations?: string[];
  rating?: number;
  isActive?: boolean;
  isConfidential?: boolean;
  notes?: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
}

export async function deleteInquiry(id: string): Promise<void> {
  await request(`/api/inquiries/${id}`, { method: 'DELETE' });
}

// ─── Activities ───────────────────────────────────────────────────────────

export async function getUpcomingActivities() {
  const res = await request<{ success: boolean; data: Activity[] }>(
    '/api/activities/upcoming'
  );
  return res.data;
}

export async function getOverdueActivities() {
  const res = await request<{ success: boolean; data: Activity[] }>(
    '/api/activities/overdue'
  );
  return res.data;
}

export function completeActivity(id: string, outcome?: string) {
  return request(`/api/activities/${id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ outcome }),
  });
}

export async function updateLeadStatus(id: string, status: string) {
  const res = await request<{ success: boolean; data: Lead }>(`/api/crm/leads/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return res.data;
}

// ─── Document Approval (public sign-back link generation) ───────────────
// Generates a public URL the customer/supplier can open without logging in
// to sign the document. Backend supports: ProformaInvoice, Quotation,
// SalesOrder, PurchaseOrder.

export type ApprovalEntityType =
  | 'ProformaInvoice'
  | 'Quotation'
  | 'SalesOrder'
  | 'PurchaseOrder'

export interface ApprovalLink {
  id: string
  token: string
  approvalUrl: string
  expiresAt: string
  documentLabel: string
}

export async function generateApprovalLink(
  entityType: ApprovalEntityType,
  entityId: string,
  opts?: { notes?: string; clientEmail?: string; expiryDays?: number },
): Promise<ApprovalLink> {
  const res = await request<{ success: boolean; data: ApprovalLink; message?: string }>(
    '/api/approvals/generate',
    {
      method: 'POST',
      body: JSON.stringify({ entityType, entityId, ...opts }),
    },
  )
  return res.data
}

// ─── Scheduled Activities ────────────────────────────────────────────────
// These are user-assigned tasks. AI-generated approval tasks (created when
// the AI assistant proposes a new product or quotation) come through here
// with type='approve'. Mobile Approvals tab merges these alongside
// InternalApproval rows to mirror the desktop PendingApprovalsWidget.

export async function getMyActivities() {
  const res = await request<{ success: boolean; data: ScheduledActivity[] }>(
    '/api/scheduled-activities/my',
  )
  return res.data ?? []
}

export async function markActivityDone(id: string) {
  return request(`/api/scheduled-activities/${id}/done`, { method: 'PUT' })
}

export interface ScheduledActivity {
  id: string
  // 'approve' = waiting for sign-off; other types are general tasks
  type: 'approve' | 'follow_up' | 'review' | 'call' | 'other' | string
  status: 'pending' | 'done' | 'cancelled' | string
  title: string
  body?: string
  entityType?: string
  entityId?: string
  dueDate?: string
  priority?: 'low' | 'normal' | 'high' | string
  assignedToId?: string
  assignedById?: string
  assignedBy?: { id: string; firstName: string; lastName: string }
  createdAt: string
  updatedAt: string
}

// ─── Internal Approvals ──────────────────────────────────────────────────
// These are manager-approval requests raised by coordinators on Quotations,
// PIs, Sales Orders, etc. Managed via /api/internal-approvals (not the
// client-facing /api/approvals document e-signature system).

export async function getPendingApprovals() {
  const res = await request<{ success: boolean; data: InternalApproval[]; total: number }>(
    '/api/internal-approvals?status=pending'
  );
  return res.data;
}

export function approveDocument(id: number) {
  return request(`/api/internal-approvals/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function rejectDocument(id: number, note: string) {
  return request(`/api/internal-approvals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface DashboardSummary {
  openLeads: number;
  pendingApprovals: number;
  pendingActivities: number;
  pipelineValueUSD: number;
  lastUpdated: string;
}

export interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  status: string;
  brandCode?: string;
  estimatedValue?: number;
  currency?: string;
  productInterests?: string;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  industry?: string;
  source?: string;
  notes?: string;
  description?: string;
  draftEmailSubject?: string;
  draftEmailBody?: string;
  createdAt?: string;
  createdById?: string;
  createdBySource?: 'manual' | 'ai_research' | 'webhook' | 'import';
  createdBy?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  responsibleUserIds?: string[];
  assignedToId?: string | null;
  assignedTo?: { id: string; firstName?: string; lastName?: string; email?: string } | null;
  lastActivityAt?: string;
  score?: number;
  activities?: Activity[];
}

export interface OutreachEmailPayload {
  fromAddress?: string;
  toAddress: string;
  toName?: string;
  subject: string;
  bodyText: string;
  touchNumber?: number;
  followUpDays?: number;
  cc?: string;
  bcc?: string;
  signatureId?: string;
}

export async function sendOutreachEmail(leadId: string, payload: OutreachEmailPayload) {
  const res = await api.post(`/crm/leads/${leadId}/outreach-emails`, payload);
  return res.data;
}

export interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note' | 'task' | 'follow_up';
  subject: string;
  description?: string;
  leadId?: string;
  contactId?: string;
  customerId?: string;
  userId?: string;
  scheduledAt?: string;
  completedAt?: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  outcome?: string;
  duration?: number;   // minutes
  createdAt: string;
  updatedAt: string;
  // Optional associations included by the API
  lead?: { id: string; companyName: string; contactName: string };
}

// Internal (manager) approval — raised by coordinators, resolved by admin/manager.
// Maps to the InternalApproval model in backend/models/InternalApproval.js.
export interface InternalApproval {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  entityType: string;   // e.g. 'Quotation', 'ProformaInvoice', 'SalesOrder'
  entityId: number;
  approvalType: string; // e.g. 'send_quotation', 'general'
  requestNote?: string;
  requesterId: number;
  requester?: { firstName: string; lastName: string };
  decidedById?: number;
  decidedBy?: { firstName: string; lastName: string };
  decisionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProductPrice {
  id: string;
  factoryId: string;
  factory?: { id: string; companyName: string };
  costPrice: number;       // FOB price (buy)
  exwPrice?: number;       // EXW price (optional)
  priceType: string;       // FOB | EXW | CIF | CFR | DDP
  markup: number;          // margin %
  sellingPrice: number;    // sell = FOB / (1 - margin%)
  currency: string;
  isActive: boolean;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  salesDescription?: string;
  purchaseDescription?: string;
  category?: { id: string; name: string } | string;
  factory?: { id: string; companyName: string };
  factoryId?: string;
  unit?: string;
  hsCode?: string;
  minOrderQty?: number;
  isActive?: boolean;
  prices?: ProductPrice[];
  specifications?: Record<string, unknown>;
  // legacy compat
  unitPrice?: number;
  currency?: string;
  moq?: number;
  leadTime?: string;
  status?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  // Backend returns companyName; name is kept for compat with any legacy callers
  companyName?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  status?: string;
  industry?: string;
  notes?: string;
  // Multi-brand (Phase 1)
  brandRelationships?: string[] | null;
  productBrandingMode?: 'ironlite' | 'generic' | 'private_label' | null;
  privateLabelProductName?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Multi-brand (Phase 1 Commit 5) ──────────────────────────────────────
export interface Brand {
  id: string;
  code: string;
  displayName: string;
  senderEmail: string;
  primaryColor: string;
  accentColor: string;
  footerLegalText?: string | null;
  logoUrl?: string | null;
  active: boolean;
  acceptedProductCategories?: string[] | null;
}

export interface BrandScope {
  accessibleBrands: string[];
  defaultBrand: string;
  viewMode: 'single' | 'cross-brand';
  isCrossBrand: boolean;
}

export function listBrands() {
  return request<{ success: boolean; data: Brand[] }>('/api/brands');
}

export function getMyBrandScope() {
  return request<{ success: boolean; data: BrandScope }>('/api/brands/me');
}

// ─── Triage Inbox ────────────────────────────────────────────────────────
// Inbound emails detected by the Cowork triage task and parked here pending
// a decision (promote → lead, forward to Fanzey, mark spam, dismiss, archive).
// Backend mounted at /api/triage.

export async function getTriageItems(
  status: 'pending' | 'forwarded' | 'archived' | 'all' = 'pending'
) {
  const res = await request<{
    success: boolean;
    data: TriageItem[];
    pagination: { total: number; page: number; pages: number; pageSize: number };
    pendingCount: number;
  }>(`/api/triage?status=${status}&limit=50`);
  return { items: res.data, pendingCount: res.pendingCount };
}

export async function getTriagePendingCount() {
  const res = await request<{ count: number }>('/api/triage/pending-count');
  return res.count ?? 0;
}

export function promoteTriageToLead(id: string) {
  return request(`/api/triage/${id}/promote`, { method: 'PATCH' });
}

export function forwardTriageToFanzey(id: string) {
  return request(`/api/triage/${id}/forward-fanzey`, { method: 'PATCH' });
}

export function markTriageSpam(id: string) {
  return request(`/api/triage/${id}/spam`, { method: 'PATCH' });
}

export function dismissTriage(id: string) {
  return request(`/api/triage/${id}/dismiss`, { method: 'PATCH' });
}

export function archiveTriage(id: string) {
  return request(`/api/triage/${id}/archive`, { method: 'PATCH' });
}

// Generic update — flips status without picking between specific action routes.
// Mirrors PATCH /api/triage/:id. Use the action-specific helpers above when
// you need promote+lead-creation or forward+email side-effects.
export type TriageStatus =
  | 'pending'
  | 'promoted'
  | 'forwarded'
  | 'spam'
  | 'dismissed'
  | 'archived';

export function updateTriageItem(id: string, body: { status?: TriageStatus }) {
  return request(`/api/triage/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function requestTriageSync() {
  return request('/api/triage/sync-requested', { method: 'POST' });
}

// Triage item — inbound email awaiting Alex's decision.
// Maps to backend/models/TriageItem.js.
export interface TriageItem {
  id: string;
  gmailMessageId: string;
  inReplyToMessageId?: string | null;
  isReplyToOutreach?: boolean;
  matchedOutreachEmailId?: string | null;
  matchedOutreachEmail?: {
    id: string;
    subject: string;
    toAddress: string;
    sentAt: string;
  } | null;
  senderName?: string | null;
  senderCompany?: string | null;
  senderEmail: string;
  country?: string | null;
  productInterest?: string | null;
  intentScore?: 'high' | 'medium' | 'low' | 'spam' | null;
  suggestedAction?:
    | 'create_lead'
    | 'request_info'
    | 'forward_fanzey'
    | 'mark_spam'
    | 'dismiss'
    | null;
  detectedLanguage?: string | null;
  subject: string;
  bodySnippet?: string | null;
  status: 'pending' | 'promoted' | 'forwarded' | 'spam' | 'dismissed' | 'archived';
  autoArchiveAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Dev Mode (super_admin only) ─────────────────────────────────────────────
// Lifecycle endpoints for in-ERP code-change AI subprocesses. The actual
// runtime ships in Session 2; these helpers exist now for parity so the
// mobile UI can hook in without another api.ts edit later.
// Maps to backend/models/DevModeRun.js + backend/routes/devModeRoutes.js.

export type DevModeRunStatus =
  | 'queued'
  | 'running'
  | 'opening_pr'
  | 'awaiting_clarification'
  | 'completed'
  | 'wip'
  | 'failed'
  | 'aborted';

export interface DevModeRun {
  id: string;
  userId: string;
  prompt: string;
  status: DevModeRunStatus;
  branchName?: string | null;
  prUrl?: string | null;
  prNumber?: number | null;
  prMergedAt?: string | null;
  filesChanged: Array<{ path: string; additions: number; deletions: number }>;
  linesAdded: number;
  linesDeleted: number;
  turnCount: number;
  maxTurns: number;
  tokenUsage: Record<string, number>;
  estimatedCostUsd?: number | null;
  errorMessage?: string | null;
  workTreePath?: string | null;
  subprocessPid?: number | null;
  clarificationQuestion?: string | null;
  clarificationAnswer?: string | null;
  awaitingSince?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function startDevModeRun(prompt: string) {
  return request<{ success: boolean; data: DevModeRun; message?: string }>(
    '/api/dev-mode/runs',
    { method: 'POST', body: JSON.stringify({ prompt }) },
  );
}

export function getDevModeRun(id: string) {
  return request<{ success: boolean; data: DevModeRun }>(`/api/dev-mode/runs/${id}`);
}

export function listDevModeRuns(opts: { status?: DevModeRunStatus; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<{
    success: boolean;
    data: DevModeRun[];
    pagination: { total: number; page: number; pages: number; pageSize: number };
  }>(`/api/dev-mode/runs${suffix}`);
}

export function answerDevModeClarification(id: string, answer: string) {
  return request<{ success: boolean; data: DevModeRun; message?: string }>(
    `/api/dev-mode/runs/${id}/answer`,
    { method: 'POST', body: JSON.stringify({ answer }) },
  );
}

export function abortDevModeRun(id: string) {
  return request<{ success: boolean; data: DevModeRun; message?: string }>(
    `/api/dev-mode/runs/${id}/abort`,
    { method: 'POST' },
  );
}

// ─── Expo push token registration ────────────────────────────────────────────
// Mobile registers its Expo push token on login so the backend can fire
// dev-mode notifications via exp.host. Available to any authenticated user.

export type ExpoPushPlatform = 'ios' | 'android' | 'web';

export interface ExpoPushTokenRow {
  id: string;
  deviceId: string | null;
  platform: ExpoPushPlatform | null;
  isActive: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export function registerPushToken(token: string, opts: { deviceId?: string; platform?: ExpoPushPlatform } = {}) {
  return request<{ success: boolean; data: ExpoPushTokenRow }>('/api/push-tokens/register', {
    method: 'POST',
    body: JSON.stringify({ token, ...opts }),
  });
}

export function unregisterPushToken(token: string) {
  return request<{ success: boolean; message: string }>('/api/push-tokens/unregister', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export function listMyPushTokens() {
  return request<{ success: boolean; data: ExpoPushTokenRow[] }>('/api/push-tokens/me');
}

// ─── Shipments / Invoices / Purchase Orders (read-only) ──────────────────
// Three backend modules used for on-the-road visibility. All read-only on
// mobile — creation/edit happens on the desktop ERP.

export async function getShipments(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return request<PaginatedResponse<Shipment>>(`/api/shipments${qs ? `?${qs}` : ''}`)
}

export async function getShipment(id: string) {
  const res = await request<{ success: boolean; data: Shipment }>(`/api/shipments/${id}`)
  return res.data
}

export async function getInvoices(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return request<PaginatedResponse<Invoice>>(`/api/invoices${qs ? `?${qs}` : ''}`)
}

export async function getInvoice(id: string) {
  const res = await request<{ success: boolean; data: Invoice }>(`/api/invoices/${id}`)
  return res.data
}

export async function getPurchaseOrders(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return request<PaginatedResponse<PurchaseOrder>>(`/api/purchase-orders${qs ? `?${qs}` : ''}`)
}

export async function getPurchaseOrder(id: string) {
  const res = await request<{ success: boolean; data: PurchaseOrder }>(`/api/purchase-orders/${id}`)
  return res.data
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface Shipment {
  id: string
  shipmentNumber: string
  salesOrderId?: string
  carrier?: string
  vesselName?: string
  trackingNumber?: string
  status?: string
  originPort?: string
  destinationPort?: string
  estimatedDeparture?: string
  actualDeparture?: string
  estimatedArrival?: string
  actualArrival?: string
  containerNumber?: string
  blNumber?: string
  notes?: string
  createdAt: string
  updatedAt: string
  // Optional includes
  salesOrder?: { id: string; orderNumber: string; customer?: { companyName: string } }
}

export interface Invoice {
  id: string
  invoiceNumber: string
  customerId?: string
  salesOrderId?: string
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | string
  totalAmount?: number
  paidAmount?: number
  currency?: string
  invoiceDate?: string
  dueDate?: string
  paidDate?: string
  notes?: string
  createdAt: string
  updatedAt: string
  customer?: { id: string; companyName: string }
}

export interface PurchaseOrder {
  id: string
  poNumber: string
  factoryId?: string
  salesOrderId?: string
  status?: string
  totalAmount?: number
  currency?: string
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
  paymentTerms?: string
  shippingTerms?: string
  notes?: string
  // E-signature audit trail. Populated when the supplier confirms the
  // PO via the public approve link. IP/UA live on the DocumentApproval row.
  signedAt?: string
  signedBySupplier?: string
  createdAt: string
  updatedAt: string
  factory?: { id: string; name?: string; companyName?: string }
}

// ─── Sales Orders ────────────────────────────────────────────────────────
// Confirmed orders flowing from quotation → SO → fulfilment. Mobile is
// read + e-sign-display only; create/edit happens on desktop.

export async function getSalesOrders(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return request<PaginatedResponse<SalesOrder>>(`/api/sales-orders${qs ? `?${qs}` : ''}`)
}

export async function getSalesOrder(id: string) {
  const res = await request<{ success: boolean; data: SalesOrder }>(`/api/sales-orders/${id}`)
  return res.data
}

export interface SalesOrderItem {
  id: string
  productId?: string
  description?: string
  quantity: number
  unit?: string
  unitPrice: number
  total: number
  product?: { id: string; name: string; sku?: string }
}

export interface SalesOrder {
  id: string
  orderNumber: string
  customerId?: string
  factoryId?: string
  quotationId?: string
  status?: string
  totalAmount?: number
  currency?: string
  expectedDeliveryDate?: string
  actualDeliveryDate?: string
  paymentTerms?: string
  shippingTerms?: string
  notes?: string
  // E-signature audit trail. Populated when the customer approves the SO
  // via the public approve link. IP/UA live on the DocumentApproval row.
  signedAt?: string
  signedByClient?: string
  createdAt: string
  updatedAt: string
  items?: SalesOrderItem[]
  customer?: { id: string; companyName: string; email?: string; country?: string }
  factory?: { id: string; companyName: string }
}

export async function convertInquiryToQuotation(
  id: string,
  body?: { salesPersonId?: string; discount?: number; taxRate?: number; terms?: string },
): Promise<Quotation> {
  const res = await request<{ success: boolean; data: Quotation; message?: string }>(
    `/api/inquiries/${id}/convert-to-quotation`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
  return res.data
}

// ─── Inquiries (RFQs) ────────────────────────────────────────────────────
// Inbound inquiries from web forms, email, phone, portal. Reps can read +
// assign on the road. Updating status moves them through the funnel:
// new → in_review → quoted → follow_up → converted/lost.

export async function getInquiries(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return request<PaginatedResponse<Inquiry>>(`/api/inquiries${qs ? `?${qs}` : ''}`)
}

export async function getInquiry(id: string) {
  const res = await request<{ success: boolean; data: Inquiry }>(`/api/inquiries/${id}`)
  return res.data
}

export async function updateInquiryStatus(id: string, status: string) {
  const res = await request<{ success: boolean; data: Inquiry }>(`/api/inquiries/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
  return res.data
}

export interface Inquiry {
  id: string
  inquiryNumber: string
  customerId?: string
  salesPersonId?: string
  status: 'new' | 'in_review' | 'quoted' | 'follow_up' | 'converted' | 'lost' | 'cancelled' | string
  source?: 'web' | 'email' | 'phone' | 'portal' | string
  priority?: 'low' | 'medium' | 'high' | 'urgent' | string
  notes?: string
  followUpDate?: string
  estimatedValue?: number
  // Set on the inquiry record once it's been converted to a quotation
  // (POST /api/inquiries/:id/convert-to-quotation). Mobile uses this to
  // hide the convert button on already-converted inquiries.
  convertedToQuotationId?: string | null
  createdAt: string
  updatedAt: string
  customer?: { id: string; companyName: string; email?: string; country?: string }
  salesPerson?: { id: string; firstName: string; lastName: string }
}

// ─── Auth: forgot-password ───────────────────────────────────────────────

export async function requestPasswordReset(email: string) {
  return request<{ success: boolean; message?: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

// ─── Quotations ───────────────────────────────────────────────────────────

export async function getQuotations(params?: { search?: string; status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
  ).toString()
  return request<PaginatedResponse<Quotation>>(`/api/quotations${qs ? `?${qs}` : ''}`)
}

export async function getQuotation(id: string) {
  const res = await request<{ success: boolean; data: Quotation }>(`/api/quotations/${id}`)
  return res.data
}

export interface QuotationItem {
  id: string
  productId?: string
  description?: string
  quantity: number
  unit?: string
  unitPrice: number
  discount?: number
  total: number
  notes?: string
  product?: { id: string; name: string; sku?: string }
}

export interface Quotation {
  id: string
  quotationNumber: string
  customerId?: string
  inquiryId?: string
  salesPersonId?: string
  factoryId?: string
  leadId?: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | string
  subtotal?: number
  discount?: number
  discountType?: 'fixed' | 'percentage'
  tax?: number
  taxRate?: number
  total?: number
  currency?: string
  validUntil?: string
  terms?: string
  notes?: string
  // E-signature audit trail. Populated when the customer signs the
  // quotation via the public approve link, which also flips status to
  // 'accepted'. IP/UA live on the DocumentApproval row.
  signedAt?: string
  signedByClient?: string
  createdAt: string
  updatedAt: string
  items?: QuotationItem[]
  customer?: { id: string; companyName: string; email?: string; country?: string }
  factory?: { id: string; companyName: string; country?: string }
  lead?: { id: string; companyName: string; contactName?: string }
  inquiry?: { id: string; inquiryNumber: string }
  salesPerson?: { id: string; firstName: string; lastName: string }
}

// ─── Chatter ──────────────────────────────────────────────────────────────

export async function getChatterMessages(entityType: string, entityId: string) {
  const res = await request<{ success: boolean; data: ChatterMessage[] }>(
    `/api/chatter/${entityType}/${entityId}`
  )
  return (res as any).data ?? (res as any) ?? []
}

export async function postChatterMessage(entityType: string, entityId: string, body: string) {
  const res = await request<{ success: boolean; data: ChatterMessage }>(
    `/api/chatter/${entityType}/${entityId}`,
    { method: 'POST', body: JSON.stringify({ body }) }
  )
  return (res as any).data ?? res
}

export interface ChatterMessage {
  id: string
  messageType: 'comment' | 'event' | 'status_change' | 'approval_request' | 'approval_decision' | 'activity' | 'email_sent' | 'file_attachment' | string
  body: string
  authorName?: string
  userId?: string
  createdAt: string
}

// ─── Internal Chat ────────────────────────────────────────────────────────────

export async function getChatRooms() {
  const res = await request<{ success: boolean; data: ChatRoom[] }>('/api/chat/rooms')
  return res.data ?? []
}

export async function getChatRoomMessages(roomId: string, limit = 50) {
  const res = await request<{ success: boolean; data: ChatMessage[] }>(
    `/api/chat/rooms/${roomId}/messages?limit=${limit}`
  )
  return res.data ?? []
}

export async function sendChatMessage(roomId: string, body: string) {
  const res = await request<{ success: boolean; data: ChatMessage }>(
    `/api/chat/rooms/${roomId}/messages`,
    { method: 'POST', body: JSON.stringify({ body }) }
  )
  return res.data
}

export async function markChatRoomRead(roomId: string) {
  return request(`/api/chat/rooms/${roomId}/read`, { method: 'POST' })
}

export interface ChatRoom {
  id: string
  name?: string
  type: 'dm' | 'channel' | 'external'
  lastMessageBody?: string
  lastMessageAt?: string
  unreadCount: number
  isArchived?: boolean
  dmUserId?: number
  dmUser?: { id: number; name: string }
}

export interface ChatMessage {
  id: string
  body: string | null
  senderId: string
  isMe?: boolean
  sender?: { firstName?: string; lastName?: string; name?: string }
  createdAt: string
  editedAt?: string | null
  deletedAt?: string | null
}

// ─── AI Assistant ─────────────────────────────────────────────────────────────

export interface AIConversation {
  id: string
  title: string
  messageCount: number
  lastMessageAt: string
  createdAt: string
  updatedAt: string
}

export interface AIAttachment {
  driveFileId: string
  name: string
  mimeType: string
  sizeBytes?: number | null
  webViewLink?: string | null
  thumbnailUrl?: string | null
  createdTime?: string | null
}

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  /**
   * Optional dev-mode metadata. Set on assistant messages of kind='devRun'
   * (live polling cards) and on user messages that triggered a dev-mode run
   * (devMode=true). Other AIMessage rows ignore both fields.
   */
  kind?: 'devRun'
  runId?: string
  devMode?: boolean
  /**
   * Files the user attached to this message. Backend persists these on the
   * user message in the conversation messages JSON. The AI views them via
   * the read_attachment MCP tool during the chat call.
   */
  attachments?: AIAttachment[]
}

export interface AIChatResponse {
  conversationId: string
  title: string
  reply: string
  isNew: boolean
}

export async function aiChat(
  message: string,
  conversationId?: string,
  attachments?: AIAttachment[],
): Promise<AIChatResponse> {
  const res = await request<{ success: boolean; data: AIChatResponse }>(
    '/api/ai/chat',
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        conversationId,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      }),
    },
  )
  return res.data
}

// Upload a single file to the user's Drive (Sovern ERP/AI uploads/YYYY-MM/)
// for use as a chat attachment. The returned AIAttachment is what gets
// passed to aiChat({ attachments: [...] }).
//
// Uses raw fetch + FormData rather than `request()` because that helper
// JSON-stringifies the body. SecureStore for the token because /api/auth
// uses bearer-on-fetch like the rest of the app.
export async function uploadAttachment(file: {
  uri: string
  name: string
  mimeType: string
}): Promise<AIAttachment> {
  const token = await SecureStore.getItemAsync(CONFIG.TOKEN_KEY)
  const form = new FormData()
  // RN FormData accepts the {uri,name,type} shape on iOS/Android.
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as any)
  const res = await fetch(`${CONFIG.SERVER_URL}/api/ai/attachments`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Don't set Content-Type — fetch fills in the multipart boundary itself.
    },
    body: form,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error ?? `Attachment upload failed (HTTP ${res.status})`)
  }
  const json = await res.json()
  return json.data as AIAttachment
}

export async function aiListConversations(): Promise<AIConversation[]> {
  const res = await request<{ success: boolean; data: AIConversation[] }>(
    '/api/ai/conversations'
  )
  return res.data ?? []
}

export async function aiGetConversation(
  id: string
): Promise<{ conversation: AIConversation; messages: AIMessage[] }> {
  const res = await request<{
    success: boolean
    data: { conversation: AIConversation; messages: AIMessage[] }
  }>(`/api/ai/conversations/${id}`)
  return res.data
}

export async function aiRenameConversation(
  id: string,
  title: string,
): Promise<{ id: string; title: string }> {
  // Backend returns { ok: true, data: { id, title } } here (not the usual
  // { success: true, data } envelope). Both shapes are tolerated below.
  const res = await request<{ ok?: boolean; success?: boolean; data: { id: string; title: string } }>(
    `/api/ai/conversations/${id}`,
    { method: 'PATCH', body: JSON.stringify({ title }) },
  )
  return res.data
}

export async function aiDeleteConversation(id: string): Promise<void> {
  await request(`/api/ai/conversations/${id}`, { method: 'DELETE' })
}

export async function aiClearConversation(id: string): Promise<void> {
  await request(`/api/ai/conversations/${id}/clear`, { method: 'POST' })
}

// ─── Research tasks (Tier 2 background sourcing) ─────────────────────────────
// Lifecycle endpoints for /new-clients and /new-suppliers slash commands.
// Maps to backend/models/ResearchTask.js + backend/routes/researchRoutes.js.

export type ResearchTaskMode = 'clients' | 'suppliers';

export type ResearchTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface ResearchFinding {
  type: 'lead' | 'factory' | 'customer';
  draftId?: string | null;
  companyName: string;
  country?: string | null;
  sourceUrl?: string | null;
  evidence?: string | null;
  // Set when the finding was deduped against an existing row instead of creating one.
  dedupedAgainst?: { id: string; type: string; companyName: string } | null;
  // Set when the finding was rejected (missing fields, invalid email, etc.).
  skipped?: string | null;
}

export interface ResearchTask {
  id: string;
  userId: string;
  mode: ResearchTaskMode;
  brief: string;
  conversationId?: string | null;
  status: ResearchTaskStatus;
  summary?: string | null;
  findings: ResearchFinding[];
  findingsCount: number;
  draftsCreated: number;
  duplicatesFound: number;
  tokenUsage: Record<string, number>;
  estimatedCostUsd?: number | null;
  errorMessage?: string | null;
  subprocessPid?: number | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function startResearchTask(
  mode: ResearchTaskMode,
  brief: string,
  conversationId?: string,
) {
  return request<{ success: boolean; data: ResearchTask; message?: string }>(
    '/api/research/tasks',
    { method: 'POST', body: JSON.stringify({ mode, brief, conversationId }) },
  );
}

export function getResearchTask(id: string) {
  return request<{ success: boolean; data: ResearchTask }>(`/api/research/tasks/${id}`);
}

export function listResearchTasks(opts: {
  status?: ResearchTaskStatus;
  mode?: ResearchTaskMode;
  page?: number;
  limit?: number;
} = {}) {
  const qs = new URLSearchParams();
  if (opts.status) qs.set('status', opts.status);
  if (opts.mode) qs.set('mode', opts.mode);
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.limit) qs.set('limit', String(opts.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return request<{
    success: boolean;
    data: ResearchTask[];
    pagination: { total: number; page: number; pages: number; pageSize: number };
  }>(`/api/research/tasks${suffix}`);
}

export function cancelResearchTask(id: string) {
  return request<{ success: boolean; data: ResearchTask; message?: string }>(
    `/api/research/tasks/${id}/cancel`,
    { method: 'POST' },
  );
}

// ─── Expenses (item 4) ─────────────────────────────────────────────────────
// Lifecycle helpers for the /expense slash commands. Full CRUD lives at
// /api/expenses, /api/expense-offices, /api/expense-trips,
// /api/expense-submissions; this helper file keeps it lean to what the chat
// commands actually need.

export interface ExpenseRow {
  id: string
  entryDate: string
  category: string
  description?: string | null
  originalCurrency: string
  originalAmount: number
  usdAmount?: number | null
  customerId?: string | null
  factoryId?: string | null
  submittingOfficeId?: string | null
  submissionStatus: 'draft' | 'submitted' | 'paid' | 'rejected' | 'not_claimable'
  paidAt?: string | null
  notes?: string | null
  // AI-receipt provenance — set by extractFromReceipt + carried on create.
  receiptDriveFileIds?: string[] | null
  aiExtractedFromDriveFileId?: string | null
  aiExtractionConfidence?: number | null
}

export interface ReceiptExtractionResult {
  entryDate?: string | null
  originalCurrency?: string | null
  originalAmount?: number | null
  vendor?: string | null
  suggestedCategory?: string | null
  suggestedDescription?: string | null
  country?: string | null
  confidence?: number | null
  notes?: string | null
  aiExtractedFromDriveFileId: string
  aiExtractionConfidence: number | null
  receiptDriveFileIds: string[]
}

export interface ReimbursementOfficeRow {
  id: string
  code: string
  displayName: string
  defaultCurrency: string
  exportTemplateKey?: string | null
}

export function listExpenses(params?: { status?: string; paid?: boolean; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.paid != null) qs.set('paid', String(params.paid))
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return request<{ success: boolean; data: ExpenseRow[] }>(`/api/expenses${suffix}`)
}

export function createExpense(body: Partial<ExpenseRow>) {
  return request<{ success: boolean; data: ExpenseRow }>(
    '/api/expenses',
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function updateExpense(id: string, body: Partial<ExpenseRow>) {
  return request<{ success: boolean; data: ExpenseRow }>(
    `/api/expenses/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
}

export function deleteExpense(id: string) {
  return request<{ success: boolean }>(
    `/api/expenses/${id}`,
    { method: 'DELETE' },
  )
}

export function listExpenseOffices() {
  return request<{ success: boolean; data: ReimbursementOfficeRow[] }>('/api/expense-offices')
}

export function createExpenseSubmission(body: { officeId: string; periodStart?: string; periodEnd?: string; expenseIds?: string[]; notes?: string }) {
  return request<{ success: boolean; data: any; message?: string }>(
    '/api/expense-submissions',
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function generateSubmissionReport(submissionId: string) {
  return request<{ success: boolean; data: any; message?: string }>(
    `/api/expense-submissions/${submissionId}/generate-report`,
    { method: 'POST' },
  )
}

// Given a driveFileId (from the existing uploadAttachment helper), run the
// AI receipt extractor and return suggested Expense fields. The caller
// renders these as a pre-filled draft for review.
export function extractFromReceipt(driveFileId: string) {
  return request<{ success: boolean; data: ReceiptExtractionResult }>(
    '/api/expenses/extract-from-receipt',
    { method: 'POST', body: JSON.stringify({ driveFileId }) },
  )
}
