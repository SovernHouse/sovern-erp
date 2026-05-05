# Sovern House ERP MCP Server

Local MCP server that wraps the Sovern ERP API and exposes it as named tools to Claude via the Model Context Protocol.

## Tools

### Leads
| Tool | Description |
|------|-------------|
| `erp_list_leads` | List leads with optional status/type filter |
| `erp_get_lead` | Get a lead + its full outreach history |
| `erp_create_lead` | Create a new outbound prospect lead |
| `erp_update_lead` | Update lead status or notes |
| `erp_delete_lead` | Delete a lead and its outreach emails |

### Outreach + Email
| Tool | Description |
|------|-------------|
| `erp_send_outreach_email` | Send an outreach email to a lead |
| `erp_list_email_templates` | List saved email templates |
| `erp_create_email_template` | Save a new email template |
| `erp_list_email_signatures` | List email signatures (get the default signature ID) |
| `erp_create_email_signature` | Create a new email signature |

### Companies
| Tool | Description |
|------|-------------|
| `erp_list_customers` | List ERP customers |
| `erp_list_factories` | List factory/supplier companies |
| `erp_get_factory` | Get a factory + its products and prices |
| `erp_create_factory` | Create a new factory/supplier record |
| `erp_update_factory` | Update factory fields |

### Contacts (people at a Customer or Factory)
| Tool | Description |
|------|-------------|
| `erp_list_contacts` | List contacts; filter by customerId, factoryId, or factoryIdNotNull (all suppliers) |
| `erp_get_contact` | Get a single contact + linked customer/factory + activities |
| `erp_create_contact` | Create a contact attached to either a customer or factory |
| `erp_update_contact` | Update contact fields |
| `erp_delete_contact` | Permanently delete a contact |

### Quotations (read-only)
| Tool | Description |
|------|-------------|
| `erp_list_quotations` | List quotations with optional status/customer filter |
| `erp_get_quotation` | Get a quotation + line items, customer, sales person |

## Setup

### 1. Install dependencies

```powershell
cd mcp-server
npm install
```

### 2. Build

```powershell
npm run build
```

### 3. Create a .env file (never commit this)

```
ERP_PASSWORD=admin123
```

Or set the environment variable directly in your Claude Desktop config (see below).

### 4. Add to Claude Desktop config

Open `%APPDATA%\Claude\claude_desktop_config.json` and add:

```json
{
  "mcpServers": {
    "sovern-erp": {
      "command": "node",
      "args": ["C:\\Users\\Alex\\Desktop\\International Trade Company\\Trading ERP\\mcp-server\\dist\\index.js"],
      "env": {
        "ERP_URL": "http://localhost:5000",
        "ERP_EMAIL": "admin@sovernhouse.co",
        "ERP_PASSWORD": "admin123"
      }
    }
  }
}
```

### 5. Restart Claude Desktop

The ERP tools will appear in Claude automatically.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ERP_URL` | `http://localhost:5000` | ERP backend URL |
| `ERP_EMAIL` | `admin@sovernhouse.co` | Admin email |
| `ERP_PASSWORD` | *(required)* | Admin password |

## Development

Run in watch mode (auto-reloads on changes):

```powershell
npm run dev
```
