# Trading ERP System - Start Here

**Welcome! This file will guide you to the right documentation for your needs.**

---

## What Are You Looking For?

### I Want to Get Started Quickly
Start here:
1. **[SETUP_SUMMARY.md](SETUP_SUMMARY.md)** - Quick overview and setup instructions
2. Run either:
   - `./scripts/setup.sh` (macOS/Linux) - Automated setup
   - `scripts/setup.bat` (Windows) - Automated setup
   - `npm run docker:up` (Docker) - Container-based setup
3. Access the system:
   - Admin: http://localhost:3000
   - Customer: http://localhost:3002
   - Factory: http://localhost:3003

### I Need Complete System Documentation
Read:
- **[README.md](README.md)** - Master documentation covering:
  - System architecture and features
  - Tech stack details
  - All 16 business modules
  - Project structure
  - Configuration guide
  - Deployment instructions

### I'm Developing the API
Read:
- **[docs/API_REFERENCE.md](docs/API_REFERENCE.md)** - Complete API documentation:
  - All 30+ endpoints
  - Request/response examples
  - Authentication details
  - Error handling

### I Need Database Information
Read:
- **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** - Database documentation:
  - 45+ table definitions
  - All fields and relationships
  - Indexes and constraints
  - Entity relationship diagram

### I'm an End User
Read:
- **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** - User manual covering:
  - Admin portal guide (8 modules)
  - Customer portal guide (7 modules)
  - Factory portal guide (5 modules)
  - Complete order workflows
  - FAQs and troubleshooting

### I Need System Installation Help
Run:
- **macOS/Linux**: `./scripts/setup.sh`
- **Windows**: `scripts/setup.bat`
- **Docker**: `npm run docker:up`

Or read:
- **[SETUP_SUMMARY.md](SETUP_SUMMARY.md)** for quick overview
- **[README.md](README.md)** for detailed setup instructions

### I Want to Configure the System
Read:
- **[.env.example](.env.example)** - All configuration variables (100+)
- **[README.md](README.md#configuration)** - Configuration guide

### I'm Deploying to Production
Read:
- **[README.md](README.md#deployment)** - Production deployment guide
- **[SETUP_SUMMARY.md](SETUP_SUMMARY.md#deployment-checklist)** - Deployment checklist

### I Need Project Overview
Read:
- **[DELIVERY_MANIFEST.txt](DELIVERY_MANIFEST.txt)** - Complete file listing and project summary

---

## Key Files

### Configuration & Setup
- `docker-compose.yml` - Multi-service Docker configuration
- `package.json` - Workspace and npm scripts
- `.env.example` - Environment variables template
- `.gitignore` - Git configuration

### Setup Scripts
- `scripts/setup.sh` - macOS/Linux setup (automated)
- `scripts/setup.bat` - Windows setup (automated)
- `scripts/reset-db.sh` - Database reset utility

### Docker Configuration
- `docker/nginx.conf` - Reverse proxy configuration
- `docker/Dockerfile.backend` - Backend Docker image
- `docker/Dockerfile.frontend` - Frontend Docker image

### Documentation
- `README.md` - Master documentation (33 KB)
- `docs/API_REFERENCE.md` - API documentation (45 KB)
- `docs/DATABASE_SCHEMA.md` - Database documentation (50 KB)
- `docs/USER_GUIDE.md` - User guide (42 KB)
- `SETUP_SUMMARY.md` - Setup overview (11 KB)
- `DELIVERY_MANIFEST.txt` - File listing and summary

---

## Quick Navigation

| Need | File |
|------|------|
| Quick start | [SETUP_SUMMARY.md](SETUP_SUMMARY.md) |
| Complete overview | [README.md](README.md) |
| API endpoints | [docs/API_REFERENCE.md](docs/API_REFERENCE.md) |
| Database tables | [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) |
| User instructions | [docs/USER_GUIDE.md](docs/USER_GUIDE.md) |
| Setup help | [scripts/](scripts/) + [README.md](README.md#quick-start) |
| Configuration | [.env.example](.env.example) |
| All files | [DELIVERY_MANIFEST.txt](DELIVERY_MANIFEST.txt) |

---

## Default Credentials

**Admin Portal** (http://localhost:3000)
- Email: admin@floortrading.com
- Password: admin123

**Customer Portal** (http://localhost:3002)
- Email: customer@example.com
- Password: customer123

**Factory Portal** (http://localhost:3003)
- Email: factory@example.com
- Password: factory123

---

## System Features

The Trading ERP System includes:

1. **Customer Management & CRM** - Lead tracking, pipeline management
2. **Inquiry Management** - Product request handling
3. **Quotation Management** - Digital quotation creation and tracking
4. **Proforma Invoice** - PI generation from quotations
5. **Sales Order Management** - Order lifecycle management
6. **Purchase Order Management** - Supplier ordering
7. **Packing List** - Package allocation and tracking
8. **Shipping & Logistics** - Real-time shipment tracking
9. **Document Management** - Centralized document storage
10. **Inspection & QC** - Quality control and defect tracking
11. **Claims Management** - Customer claim resolution
12. **Invoice & Payment** - Sales/purchase invoicing
13. **Inventory Management** - Stock tracking
14. **Financial Reporting** - P&L, AR/AP aging reports
15. **User & Access Control** - RBAC and permissions
16. **Multilingual Support** - 6 languages (EN, ZH, ES, FR, DE, PT)

---

## Technical Stack

- **Backend**: Node.js 18+, Express.js, PostgreSQL 15+, Redis 7+
- **Frontend**: React 18+, Vite, Material-UI/Tailwind CSS
- **Mobile**: React Native (iOS/Android)
- **DevOps**: Docker, Docker Compose, Nginx
- **Authentication**: JWT
- **Database**: PostgreSQL with 45+ tables

---

## Getting Started Steps

1. **Read** this file (you're here!)
2. **Choose your setup method**:
   - Local: Run `./scripts/setup.sh` (Unix) or `scripts/setup.bat` (Windows)
   - Docker: Run `npm run docker:up`
3. **Read the relevant documentation**:
   - For overview: [README.md](README.md)
   - For users: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
   - For developers: [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
4. **Access the system**:
   - Admin: http://localhost:3000
   - Customer: http://localhost:3002
   - Factory: http://localhost:3003
5. **Use default credentials above to login**
6. **Explore the features!**

---

## Support & Help

**For specific questions, check these documents:**

- How do I setup? → [SETUP_SUMMARY.md](SETUP_SUMMARY.md) or [README.md](README.md#quick-start)
- How do I use the Admin Portal? → [docs/USER_GUIDE.md](docs/USER_GUIDE.md#admin-portal-guide)
- How do I use the Customer Portal? → [docs/USER_GUIDE.md](docs/USER_GUIDE.md#customer-portal-guide)
- How do I use the Factory Portal? → [docs/USER_GUIDE.md](docs/USER_GUIDE.md#factory-portal-guide)
- What are the API endpoints? → [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- What are the database tables? → [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- What are the configuration options? → [.env.example](.env.example)
- What should I do before deploying? → [README.md](README.md#deployment)

---

## Project Information

- **Name**: Trading Company ERP System
- **Version**: 1.0.0
- **Created**: March 16, 2024
- **Location**: `/sessions/eager-stoic-wozniak/mnt/Trading ERP/`
- **Status**: Production-Ready

---

## Next Step

**Choose your path**:

- [ ] I want to **setup the system** → Read [SETUP_SUMMARY.md](SETUP_SUMMARY.md)
- [ ] I want to **understand the system** → Read [README.md](README.md)
- [ ] I want to **use the system** → Read [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- [ ] I'm **integrating with the API** → Read [docs/API_REFERENCE.md](docs/API_REFERENCE.md)
- [ ] I need **database information** → Read [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)

---

**Happy exploring! If you have questions, check the documentation files above.**
