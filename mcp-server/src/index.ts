#!/usr/bin/env node
/**
 * Sovern House ERP MCP Server
 *
 * Exposes CRM, lead management, and outreach tools to Claude via the
 * Model Context Protocol. Runs locally via stdio transport alongside
 * the ERP backend.
 *
 * Required environment variables:
 *   ERP_URL      - Base URL of the ERP backend (default: http://localhost:5000)
 *   ERP_EMAIL    - Admin email (default: admin@sovernhouse.co)
 *   ERP_PASSWORD - Admin password
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios, { AxiosError, AxiosInstance } from "axios";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ERP_URL = process.env.ERP_URL ?? "http://localhost:5000";
const ERP_EMAIL = process.env.ERP_EMAIL ?? "admin@sovernhouse.co";
const ERP_PASSWORD = process.env.ERP_PASSWORD ?? "";

if (!ERP_PASSWORD) {
  console.error("ERROR: ERP_PASSWORD environment variable is required");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Auth client — authenticates once and re-auths on 401
// ---------------------------------------------------------------------------

let authToken: string | null = null;

const http: AxiosInstance = axios.create({
  baseURL: ERP_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

async function authenticate(): Promise<void> {
  const res = await http.post("/api/auth/login", {
    email: ERP_EMAIL,
    password: ERP_PASSWORD,
  });
  // Login response: { success, data: { user, tokens: { accessToken, refreshToken } } }
  authToken = (res.data as { data: { tokens: { accessToken: string } } }).data.tokens.accessToken;
  // Set as instance default so every subsequent request inherits it automatically
  http.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
}

async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  path: string,
  data?: unknown,
  params?: Record<string, unknown>
): Promise<T> {
  if (!authToken) await authenticate();

  try {
    const res = await http.request<T>({ method, url: path, data, params });
    return res.data;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 401) {
      // Token expired — re-authenticate once and retry
      await authenticate();
      const res = await http.request<T>({ method, url: path, data, params });
      return res.data;
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Error formatter
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const msg = (err.response?.data as { message?: string })?.message;
    if (status === 404) return `Error: Not found. ${msg ?? ""}`.trim();
    if (status === 403) return `Error: Permission denied. ${msg ?? ""}`.trim();
    if (status === 400) return `Error: Bad request. ${msg ?? ""}`.trim();
    if (status === 409) return `Error: Conflict. ${msg ?? ""}`.trim();
    return `Error: API returned ${status}. ${msg ?? err.message}`.trim();
  }
  return `Error: ${err instanceof Error ? err.message : String(err)}`;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "sovern-erp-mcp-server",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// LEADS
// ---------------------------------------------------------------------------

server.registerTool(
  "erp_list_leads",
  {
    title: "List Leads",
    description: `List outbound prospect leads from the ERP CRM.

Returns leads with their ID, company name, contact name, email, country, status, lead type, and latest outreach touch number.

Args:
  - status (optional): Filter by lead status. Values: 'new', 'contacted', 'qualified', 'converted', 'lost'
  - leadType (optional): Filter by type. Values: 'outbound_prospect', 'inbound_inquiry', 'referral'
  - limit (optional): Max results (default 50, max 200)
  - offset (optional): Pagination offset (default 0)

Returns: Array of lead objects with id, companyName, contactName, email, country, status, leadType, createdAt`,
    inputSchema: z.object({
      status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional()
        .describe("Filter by lead status"),
      leadType: z.enum(["outbound_prospect", "inbound_inquiry", "referral"]).optional()
        .describe("Filter by lead type"),
      limit: z.number().int().min(1).max(200).default(50)
        .describe("Maximum number of leads to return"),
      offset: z.number().int().min(0).default(0)
        .describe("Pagination offset"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ status, leadType, limit, offset }) => {
    try {
      const params: Record<string, unknown> = { limit, offset };
      if (status) params.status = status;
      if (leadType) params.leadType = leadType;

      const res = await apiRequest<{ success: boolean; data: unknown[] }>(
        "GET", "/api/crm/leads", undefined, params
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { leads: res.data, count: res.data.length, offset, limit },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

server.registerTool(
  "erp_get_lead",
  {
    title: "Get Lead",
    description: `Get a single lead by ID, including its full outreach email history.

Args:
  - leadId (string): The lead UUID

Returns: Lead object with id, companyName, contactName, email, country, status, notes, and outreachEmails array`,
    inputSchema: z.object({
      leadId: z.string().uuid().describe("The lead UUID"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ leadId }) => {
    try {
      const res = await apiRequest<{ success: boolean; data: unknown }>(
        "GET", `/api/crm/leads/${leadId}`
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { lead: res.data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

server.registerTool(
  "erp_create_lead",
  {
    title: "Create Lead",
    description: `Create a new outbound prospect lead in the ERP CRM.

Args:
  - companyName (string): Company name
  - contactName (string): Contact person's name or 'Team' for info@ addresses
  - email (string): Contact email address
  - country (string): Country name
  - leadType (optional): 'outbound_prospect' | 'inbound_inquiry' | 'referral' (default: outbound_prospect)
  - notes (optional): Internal notes about this prospect

Returns: Created lead object with id`,
    inputSchema: z.object({
      companyName: z.string().min(1).describe("Company name"),
      contactName: z.string().min(1).describe("Contact person's name"),
      email: z.string().email().describe("Contact email address"),
      country: z.string().min(1).describe("Country name"),
      leadType: z.enum(["outbound_prospect", "inbound_inquiry", "referral"])
        .default("outbound_prospect").describe("Lead type"),
      notes: z.string().optional().describe("Internal notes"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ companyName, contactName, email, country, leadType, notes }) => {
    try {
      const res = await apiRequest<{ success: boolean; data: { id: string } }>(
        "POST", "/api/crm/leads",
        { companyName, contactName, email, country, leadType, notes }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { lead: res.data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

server.registerTool(
  "erp_update_lead",
  {
    title: "Update Lead",
    description: `Update a lead's status or notes.

Args:
  - leadId (string): The lead UUID
  - status (optional): New status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  - notes (optional): Updated internal notes

Returns: Updated lead object`,
    inputSchema: z.object({
      leadId: z.string().uuid().describe("The lead UUID"),
      status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional()
        .describe("New status for the lead"),
      notes: z.string().optional().describe("Updated internal notes"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ leadId, status, notes }) => {
    try {
      const body: Record<string, unknown> = {};
      if (status) body.status = status;
      if (notes !== undefined) body.notes = notes;

      const res = await apiRequest<{ success: boolean; data: unknown }>(
        "PUT", `/api/crm/leads/${leadId}`, body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { lead: res.data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

server.registerTool(
  "erp_delete_lead",
  {
    title: "Delete Lead",
    description: `Permanently delete a lead and all its associated outreach emails. Use when a contact bounces, is a duplicate, or is otherwise invalid.

Args:
  - leadId (string): The lead UUID to delete

Returns: Success confirmation`,
    inputSchema: z.object({
      leadId: z.string().uuid().describe("The lead UUID to delete"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  async ({ leadId }) => {
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        "DELETE", `/api/crm/leads/${leadId}`
      );
      return {
        content: [{ type: "text", text: res.message ?? "Lead deleted successfully" }],
        structuredContent: { success: res.success, leadId },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

// ---------------------------------------------------------------------------
// OUTREACH EMAILS
// ---------------------------------------------------------------------------

server.registerTool(
  "erp_send_outreach_email",
  {
    title: "Send Outreach Email",
    description: `Send an outreach email to a lead via the ERP (uses Resend for delivery).

Args:
  - leadId (string): The lead UUID to send to
  - toAddress (string): Recipient email address
  - subject (string): Email subject line
  - bodyText (string): Plain text email body (no signature — ERP appends it automatically)
  - fromAddress (optional): Sender address (default: alex@sovern-house.com)
  - signatureId (optional): UUID of the email signature to append
  - bcc (optional): BCC email address (e.g. mohanadfanzey@gmail.com for Egypt outreach)
  - touchNumber (optional): Outreach sequence number (default: 1)
  - followUpDays (optional): Days until follow-up reminder (default: 5)

Returns: Sent email record with id and status`,
    inputSchema: z.object({
      leadId: z.string().uuid().describe("The lead UUID"),
      toAddress: z.string().email().describe("Recipient email address"),
      subject: z.string().min(1).describe("Email subject line"),
      bodyText: z.string().min(1).describe("Plain text email body — no signature, ERP appends it"),
      fromAddress: z.string().email().default("alex@sovern-house.com")
        .describe("Sender email address"),
      signatureId: z.string().uuid().optional()
        .describe("UUID of the email signature to use"),
      bcc: z.string().email().optional()
        .describe("BCC email address"),
      touchNumber: z.number().int().min(1).default(1)
        .describe("Outreach sequence touch number"),
      followUpDays: z.number().int().min(1).default(5)
        .describe("Days until follow-up reminder"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  async ({ leadId, toAddress, subject, bodyText, fromAddress, signatureId, bcc, touchNumber, followUpDays }) => {
    try {
      const body: Record<string, unknown> = {
        fromAddress,
        toAddress,
        subject,
        bodyText,
        touchNumber,
        followUpDays,
      };
      if (signatureId) body.signatureId = signatureId;
      if (bcc) body.bcc = bcc;

      const res = await apiRequest<{ success: boolean; data: unknown }>(
        "POST", `/api/crm/leads/${leadId}/outreach-emails`, body
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { email: res.data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

// ---------------------------------------------------------------------------
// EMAIL TEMPLATES
// ---------------------------------------------------------------------------

server.registerTool(
  "erp_list_email_templates",
  {
    title: "List Email Templates",
    description: `List all saved outreach email templates in the ERP.

Returns: Array of templates with id, name, subject, bodyText, createdAt`,
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: unknown[] }>(
        "GET", "/api/crm/email-templates"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { templates: res.data, count: res.data.length },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

server.registerTool(
  "erp_create_email_template",
  {
    title: "Create Email Template",
    description: `Save a new outreach email template to the ERP for future reuse.

Args:
  - name (string): Template name (e.g. 'EU Flooring Importers — Asia Sourcing (Touch 1)')
  - subject (string): Default email subject line
  - bodyText (string): Template body text — use [company name] or [Name] as placeholders

Returns: Created template with id`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Template name"),
      subject: z.string().min(1).describe("Default subject line"),
      bodyText: z.string().min(1).describe("Template body — use [placeholders] as needed"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ name, subject, bodyText }) => {
    try {
      const res = await apiRequest<{ success: boolean; data: { id: string } }>(
        "POST", "/api/crm/email-templates", { name, subject, bodyText }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { template: res.data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

// ---------------------------------------------------------------------------
// EMAIL SIGNATURES
// ---------------------------------------------------------------------------

server.registerTool(
  "erp_list_email_signatures",
  {
    title: "List Email Signatures",
    description: `List all saved email signatures in the ERP. Use to find the default signature ID needed when sending outreach emails.

Returns: Array of signatures with id, name, displayName, title, phone, website, tagline, isDefault`,
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: unknown[] }>(
        "GET", "/api/crm/email-signatures"
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { signatures: res.data, count: res.data.length },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

server.registerTool(
  "erp_create_email_signature",
  {
    title: "Create Email Signature",
    description: `Create a new email signature in the ERP.

Args:
  - name (string): Internal name for the signature
  - displayName (string): Sender's display name (e.g. 'Alexander McConnell')
  - title (string): Job title (e.g. 'FOUNDER')
  - phone (string): Phone number
  - website (string): Website (e.g. 'sovernhouse.co')
  - tagline (optional): Tagline (e.g. 'Your buying office in Asia.')
  - legalText (optional): Legal entity text
  - isDefault (optional): Set as default signature (default: false)

Returns: Created signature with id`,
    inputSchema: z.object({
      name: z.string().min(1).describe("Internal name for the signature"),
      displayName: z.string().min(1).describe("Sender display name"),
      title: z.string().min(1).describe("Job title"),
      phone: z.string().min(1).describe("Phone number"),
      website: z.string().min(1).describe("Website URL"),
      tagline: z.string().optional().describe("Tagline text"),
      legalText: z.string().optional().describe("Legal entity text"),
      isDefault: z.boolean().default(false).describe("Set as default signature"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ name, displayName, title, phone, website, tagline, legalText, isDefault }) => {
    try {
      const res = await apiRequest<{ success: boolean; data: { id: string } }>(
        "POST", "/api/crm/email-signatures",
        { name, displayName, title, phone, website, tagline, legalText, isDefault }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { signature: res.data },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------

server.registerTool(
  "erp_list_customers",
  {
    title: "List Customers",
    description: `List customers in the ERP.

Args:
  - limit (optional): Max results (default 50)
  - offset (optional): Pagination offset (default 0)

Returns: Array of customer objects with id, name, email, country, status`,
    inputSchema: z.object({
      limit: z.number().int().min(1).max(200).default(50).describe("Maximum results"),
      offset: z.number().int().min(0).default(0).describe("Pagination offset"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ limit, offset }) => {
    try {
      const res = await apiRequest<{ success: boolean; data: unknown[] }>(
        "GET", "/api/customers", undefined, { limit, offset }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
        structuredContent: { customers: res.data, count: (res.data ?? []).length },
      };
    } catch (err) {
      return { content: [{ type: "text", text: formatError(err) }] };
    }
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Pre-authenticate so the first tool call is fast
  try {
    await authenticate();
    console.error(`Sovern ERP MCP server authenticated. ERP: ${ERP_URL}`);
  } catch {
    console.error("WARNING: Could not pre-authenticate with ERP. Will retry on first tool call.");
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sovern ERP MCP server running via stdio.");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
