# Sovern ERP — GCP Always Free Deployment

**Live URL:** https://erp.sovernhouse.co
**Cost:** $0/month (e2-micro Always Free tier)
**Hardware:** 1 e2-micro VM (~1GB RAM, 30GB disk, 1GB egress/mo) — us-central1-f, project `local-iterator-495008-e6`

> Historical context: this used to live in `ORACLE_CLOUD_DEPLOYMENT.md` (planned Oracle deployment, never executed). System has been on GCP since launch. The Oracle doc was deleted; recover from git history if needed.

---

## Architecture

```
GitHub repo (SovernHouse/sovern-erp)
       |
       | push to main
       v
GitHub Actions runner (7GB RAM)
       |
       | builds frontend (npm run build --workspace=frontend/admin-portal)
       | uploads dist/ as artifact
       v
       | scp dist/ to VM
       | ssh: git pull, npm install backend deps, atomic-swap dist, pm2 restart
       v
GCP e2-micro VM (~1GB RAM)
       |
       v
nginx (port 80/443)  →  SSL via Certbot
       |
       +---  /api/   ---->  pm2 sovern-erp (Express + Sequelize) — port 3001
       +---  /socket.io/   --->  same Express
       +---  /  --->  served from /home/alex/sovern-erp/frontend/admin-portal/dist
```

**Key constraint: the build does NOT run on the VM.** vite/rollup peaks >1GB; e2-micro has ~958MB. Builds OOM silently. We offload to the GitHub Actions runner (free, 7GB) and rsync the resulting dist to the VM.

---

## Repo locations on the VM

| What | Path on VM |
|---|---|
| Repo root | `~/sovern-erp/` |
| Backend | `~/sovern-erp/backend/` |
| Frontend dist (served by nginx) | `~/sovern-erp/frontend/admin-portal/dist/` |
| nginx site config | `/etc/nginx/sites-enabled/sovern-erp` (canonical copy in repo at `infra/nginx/sovern-erp.conf`) |
| pm2 systemd unit | `/etc/systemd/system/pm2-alex.service` |
| pm2 process list | `~/.pm2/dump.pm2` (resurrected on reboot) |
| SSL certs | `/etc/letsencrypt/live/erp.sovernhouse.co/` (Certbot-managed) |

---

## Common ops

### Manual deploy (if you bypass GitHub Actions)
```bash
cd ~/sovern-erp/frontend/admin-portal && NODE_OPTIONS=--max-old-space-size=1536 npm run build
pm2 restart sovern-erp
```

### Restart backend
```bash
pm2 restart sovern-erp           # graceful
pm2 delete sovern-erp && \
  cd ~/sovern-erp && NODE_ENV=production pm2 start backend/server.js --name sovern-erp --cwd ~/sovern-erp/backend && pm2 save
```

### Apply nginx config from repo
```bash
sudo cp ~/sovern-erp/infra/nginx/sovern-erp.conf /etc/nginx/sites-enabled/sovern-erp
sudo nginx -t && sudo systemctl reload nginx
```

### Health checks
```bash
curl -s -o /dev/null -w 'health %{http_code} %{time_total}s\n' http://localhost:3001/api/health
curl -s -o /dev/null -w 'public %{http_code}\n' https://erp.sovernhouse.co/api/health
```

### Logs
```bash
pm2 logs sovern-erp --lines 50 --nostream     # backend
sudo journalctl -xeu pm2-alex.service          # systemd unit
sudo tail -f /var/log/nginx/error.log          # nginx
sudo tail -f /var/log/nginx/access.log
```

---

## Secrets

- `SERVER_HOST` (GitHub Actions secret) — VM external IP
- `SERVER_SSH_KEY` (GitHub Actions secret) — SSH deploy key (in GCP instance metadata, not just `~/.ssh/authorized_keys`, because Guest Agent overwrites the file from metadata. Fingerprint: `SHA256:IZkDUn...`)
- `.env` on VM at `~/sovern-erp/backend/.env` — DB path, Sentry DSN, OAuth secrets

---

## Footguns we've hit (don't trip on these again)

1. **nginx root path drift.** Build outputs to `frontend/admin-portal/dist/`; nginx must point there exactly. We were serving a stale `frontend/dist/` snapshot for hours one day. See `lessons.md` L-005.

2. **VM RAM ceiling.** Anything you build on the VM needs `NODE_OPTIONS=--max-old-space-size=1536`. Don't even try without it. See L-006.

3. **GitHub Actions reports green ≠ deploy succeeded.** Always `stat -c '%y' frontend/admin-portal/dist/index.html` against the deploy time. See L-007.

4. **Edit-tool truncation.** When Claude edits a source file with large/structural changes, verify `wc -l` and `tail` after. See L-008.

5. **Service worker.** `frontend/admin-portal/public/sw.js` is now a kill-switch (deletes caches + unregisters). Do not re-introduce a caching SW unless it's `vite-plugin-pwa` with a proper precache manifest.

6. **PM2 auto-recovery.** Configured via `pm2-alex.service` (systemd). Saved process list at `~/.pm2/dump.pm2`. Survives reboot.

---

## DNS

- `erp.sovernhouse.co` → A record → VM external IP. Managed in Cloudflare/registrar. SSL by Certbot, auto-renewed.

---

## When to upgrade the VM

If we ever need to:
- Run vite on the VM directly (don't, but if forced): bump to e2-small (~$13/mo, 2GB RAM)
- Add Postgres locally instead of SQLite: bump to e2-medium (~$25/mo, 4GB RAM)
- Add Redis for real session/cache (currently ioredis loaded but unused): same

For now, free tier covers all current load. Backend pm2 process sits at ~60-120MB, plenty of headroom.
