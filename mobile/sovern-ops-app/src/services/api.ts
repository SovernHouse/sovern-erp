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
