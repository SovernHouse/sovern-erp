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

async function request<T>(
  path: string,
  options: RequestInit = {}
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
  const token = res.data.tokens.accessToken;
  await SecureStore.setItemAsync(CONFIG.TOKEN_KEY, token);
  return { user: res.data.user };
}

export async function logout() {
  await SecureStore.deleteItemAsync(CONFIG.TOKEN_KEY);
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
  return request<PaginatedResponse<Lead>>(`/api/leads${qs ? `?${qs}` : ''}`);
}

export async function getLead(id: string) {
  const res = await request<{ success: boolean; data: Lead }>(`/api/leads/${id}`);
  return res.data;
}

export function addActivity(leadId: string, note: string, type = 'note') {
  return request(`/api/leads/${leadId}/activities`, {
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
  const res = await request<{ success: boolean; data: Lead }>(`/api/leads/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  return res.data;
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
  estimatedValue?: number;
  currency?: string;
  productInterests?: string;
  country?: string;
  industry?: string;
  source?: string;
  notes?: string;
  lastActivityAt?: string;
  score?: number;
  activities?: Activity[];
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

export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  currency?: string;
  unit?: string;
  moq?: number;           // minimum order quantity
  leadTime?: string;
  status?: string;
  imageUrl?: string;
  specifications?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  contactPerson?: string;
  status?: string;
  industry?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
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
  createdAt: string
  updatedAt: string
  factory?: { id: string; name?: string; companyName?: string }
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
