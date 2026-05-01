# Sovern ERP — Oracle Cloud Always Free Deployment Guide

**Goal:** Run the ERP 24/7 on Oracle Cloud's Always Free tier at zero cost.  
**Result:** Access from any phone or laptop, ERP never goes down when your Windows PC is off.

---

## Overview

Oracle Cloud Always Free includes, permanently free, no credit card auto-charges:
- 4 ARM OCPUs (Ampere A1)
- 24 GB RAM
- 200 GB block storage
- 10 TB outbound bandwidth/month

This is more than enough for the ERP — a comparable AWS instance costs ~$130/month.

---

## Part 1: Create the Oracle Cloud VM

### 1.1 Sign up
Go to https://cloud.oracle.com and create a free account.  
Use a real credit card — Oracle verifies it but **will not charge you** unless you manually upgrade to Pay As You Go.  
Select the **home region** closest to your users (Singapore or Tokyo for Asia).

### 1.2 Create the VM instance
1. From the Console, go to **Compute > Instances > Create Instance**
2. Name: `sovern-erp`
3. Image: **Ubuntu 22.04** (Canonical)
4. Shape: Click "Change shape" → **Ampere** → `VM.Standard.A1.Flex`
   - OCPUs: **4**
   - Memory: **24 GB**
5. Networking: leave defaults (new VCN auto-created)
6. SSH keys: **Download the private key** (.key file) — save it somewhere safe, you cannot get it again
7. Click **Create**

### 1.3 Open firewall ports
After the instance is created, you need to open ports for web traffic.

**In Oracle Console:**  
Networking > Virtual Cloud Networks > your VCN > Security Lists > Default Security List  
Add **Ingress Rules**:

| Source CIDR | Protocol | Port | Description |
|---|---|---|---|
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |

Port 22 (SSH) is already open by default.

---

## Part 2: Connect to the Server

Find your instance's **Public IP** in the Console (Compute > Instances > your instance).

**From Windows PowerShell or Windows Terminal:**
```powershell
# Your downloaded key file — adjust path as needed
ssh -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key ubuntu@YOUR_PUBLIC_IP
```

If you get a "permissions" error on Windows:
1. Right-click the .key file > Properties > Security > Advanced
2. Remove all inherited permissions, add yourself with Full Control only

---

## Part 3: Server Setup

Run all the following commands on the Oracle server (over SSH).

### 3.1 Update system and open OS firewall
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx

# Open ports in Ubuntu's own firewall (separate from Oracle's security list)
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 3.2 Install Node.js 20 LTS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v20.x.x
npm --version
```

### 3.3 Install PM2
PM2 keeps the ERP running after you close SSH and restarts it automatically on server reboot.
```bash
sudo npm install -g pm2
```

---

## Part 4: Deploy the ERP Code

### 4.1 Option A — Git (recommended if ERP is in a private repo)

If the ERP backend is in GitHub:
```bash
# On the server
git clone https://github.com/YOUR_ORG/YOUR_REPO.git /home/ubuntu/sovern-erp
cd /home/ubuntu/sovern-erp/backend
npm install --production
```

To authenticate with GitHub on the server, use a Personal Access Token:
1. GitHub > Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens
2. Create a token with read access to the repo
3. When git prompts for password, use the token

### 4.2 Option B — SCP from Windows (if no git remote)

Run this from your Windows machine (not the server):
```powershell
# Copy the entire ERP backend folder to the server
scp -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key -r "C:\Users\Alex\Desktop\International Trade Company\Trading ERP" ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/sovern-erp
```

Then on the server:
```bash
cd /home/ubuntu/sovern-erp/backend
npm install --production
```

### 4.3 Create the environment file
```bash
nano /home/ubuntu/sovern-erp/backend/.env
```

Paste and fill in:
```
NODE_ENV=production
PORT=5000

# Auth
JWT_SECRET=your-strong-random-secret-here
JWT_REFRESH_SECRET=your-other-strong-random-secret

# Database — start with SQLite, migrate to Postgres later
DB_DIALECT=sqlite
DB_STORAGE=/home/ubuntu/sovern-erp/data/erp.db

# Email (nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alex@sovern-house.com
SMTP_PASS=your-app-password

# CORS — add your actual domain once DNS is set up
CORS_ORIGINS=https://erp.sovernhouse.co,http://localhost:3000
SOCKET_IO_CORS_ORIGIN=https://erp.sovernhouse.co

# Optional: raise memory alert threshold for the server (has real RAM)
MEMORY_ALERT_RSS_MB=1000

# Disable features you don't need on server
DISABLE_SCHEDULER=false
ENABLE_SCHEDULED_BACKUP=false
ENABLE_AUTO_BACKUP=false
ENABLE_EXCHANGE_RATE_SCHEDULER=true

# Sentry DSN if you use it
# SENTRY_DSN=...
```

Save: Ctrl+X → Y → Enter

### 4.4 Copy the SQLite database from Windows (if using SQLite)
```bash
# Create data directory
mkdir -p /home/ubuntu/sovern-erp/data
```

From Windows PowerShell:
```powershell
# Copy your existing SQLite database file to the server
# Find the .db file first — it's usually in the backend folder
scp -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\backend\database.sqlite" ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/sovern-erp/data/erp.db
```

---

## Part 5: Run the ERP with PM2

### 5.1 Create PM2 ecosystem config
```bash
cat > /home/ubuntu/sovern-erp/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'sovern-erp',
      script: 'server.js',
      cwd: '/home/ubuntu/sovern-erp/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Restart if memory exceeds 1.5GB
      max_memory_restart: '1500M',
      // Restart on crash, wait 5s between restarts
      restart_delay: 5000,
      // Keep 10 days of logs
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      out_file: '/home/ubuntu/sovern-erp/logs/out.log',
      error_file: '/home/ubuntu/sovern-erp/logs/error.log',
      merge_logs: true
    }
  ]
};
EOF

mkdir -p /home/ubuntu/sovern-erp/logs
```

### 5.2 Start the ERP
```bash
cd /home/ubuntu/sovern-erp
pm2 start ecosystem.config.js
pm2 logs sovern-erp   # watch the startup logs, Ctrl+C to stop watching
pm2 status            # should show "online"
```

### 5.3 Auto-start on server reboot
```bash
pm2 startup
# This prints a command like: sudo env PATH=... pm2 startup systemd ...
# COPY that exact command and run it

pm2 save   # saves current process list so it restores on reboot
```

### 5.4 Test it works
```bash
curl http://localhost:5000/api/health
# Should return {"status":"healthy",...}
```

---

## Part 6: Set Up nginx as Reverse Proxy

nginx handles HTTPS termination and proxies traffic to the Node.js app on port 5000.

### 6.1 Create nginx config
```bash
sudo nano /etc/nginx/sites-available/sovern-erp
```

Paste (replace `erp.sovernhouse.co` with your subdomain):
```nginx
server {
    listen 80;
    server_name erp.sovernhouse.co;

    # Redirect all HTTP to HTTPS (certbot will modify this)
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        # Increase for file uploads
        client_max_body_size 50m;
    }
}
```

### 6.2 Enable the config
```bash
sudo ln -s /etc/nginx/sites-available/sovern-erp /etc/nginx/sites-enabled/
sudo nginx -t    # should print "syntax is ok"
sudo systemctl reload nginx
```

---

## Part 7: Set Up DNS

In your DNS provider (Cloudflare, Namecheap, etc.):

Add an **A record**:
- Name: `erp`
- Value: `YOUR_PUBLIC_IP` (the Oracle VM's public IP)
- TTL: 300 (or Auto)

This creates `erp.sovernhouse.co` pointing at your server.

Wait 5 minutes for DNS to propagate, then test:
```bash
ping erp.sovernhouse.co   # should resolve to your Oracle IP
```

---

## Part 8: SSL Certificate (HTTPS)

Once DNS is resolving:
```bash
sudo certbot --nginx -d erp.sovernhouse.co
```

Follow the prompts:
- Enter your email
- Agree to terms
- Select option 2 to redirect HTTP to HTTPS

Certbot automatically edits your nginx config and sets up auto-renewal. Done.

Test: open `https://erp.sovernhouse.co` in your browser.

---

## Part 9: Build and Deploy the Frontend

The React admin portal needs to be built and its `dist/` folder copied to the server.

**On your Windows machine:**
```powershell
cd "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\frontend\admin-portal"
npm run build
```

Then copy the dist folder to the server:
```powershell
scp -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key -r dist ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/sovern-erp/frontend/admin-portal/dist
```

Do the same for factory-portal and customer-portal if you use them.

---

## Part 10: Keeping It Updated

When you make code changes on Windows and want to push to the server:

**Option A — via git (if using GitHub):**
```bash
# On Windows: commit and push changes to GitHub
# On server:
cd /home/ubuntu/sovern-erp && git pull
pm2 restart sovern-erp
```

**Option B — via SCP:**
```powershell
# Copy updated backend files
scp -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key -r "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\backend\controllers" ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/sovern-erp/backend/
# Then restart on server:
ssh -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key ubuntu@YOUR_PUBLIC_IP "pm2 restart sovern-erp"
```

**Update the admin portal:**
```powershell
# After running npm run build on Windows:
scp -i C:\Users\Alex\Downloads\ssh-key-sovern-erp.key -r "C:\Users\Alex\Desktop\International Trade Company\Trading ERP\frontend\admin-portal\dist" ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/sovern-erp/frontend/admin-portal/
```

---

## Part 11: Useful PM2 Commands

```bash
pm2 status                    # check if ERP is running
pm2 logs sovern-erp           # live log tail
pm2 logs sovern-erp --lines 100  # last 100 lines
pm2 restart sovern-erp        # restart after code changes
pm2 stop sovern-erp           # stop the ERP
pm2 monit                     # real-time CPU/memory dashboard
```

---

## Part 12: Optional — PostgreSQL (for production robustness)

SQLite works fine for the current usage. Switch to PostgreSQL if you add more users or hit write-contention issues. This is optional and not required on day one.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER sovern WITH PASSWORD 'your-db-password';"
sudo -u postgres psql -c "CREATE DATABASE sovernERP OWNER sovern;"
```

Update `.env`:
```
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sovernERP
DB_USER=sovern
DB_PASSWORD=your-db-password
```

Then restart: `pm2 restart sovern-erp`  
Sequelize will auto-create tables on first start (the existing autoMigrateSchema handles this).

---

## Estimated Timeline

| Step | Time |
|---|---|
| Oracle account + VM creation | 20 min |
| Server setup (Node, PM2, nginx) | 15 min |
| Deploy ERP code + database | 20 min |
| DNS + SSL | 10 min |
| Frontend build + deploy | 10 min |
| **Total** | **~75 min** |

---

## Security Notes

- The SSH key is the only way into the server. Store it in OneDrive or a password manager — not just on your desktop.
- Oracle's security list is your outer firewall. Only ports 22, 80, 443 are exposed.
- The ERP's existing JWT authentication handles user access inside the app.
- Consider adding Oracle's free WAF (Web Application Firewall) later if you expose this to clients.
- Never commit the `.env` file to git.
