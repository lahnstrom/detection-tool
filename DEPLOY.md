# Deployment Guide

## Server provisioning

1. Create an Ubuntu droplet on [DigitalOcean](https://www.digitalocean.com/) with an SSH key.
2. SSH in:
   ```bash
   ssh root@164.92.210.200
   ```
3. Install Node.js v22.7+ (via [nvm](https://github.com/nvm-sh/nvm) or NodeSource):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.bashrc
   nvm install 22
   ```
4. Install build tools (needed for native npm modules):
   ```bash
   apt update && apt install -y make build-essential
   ```

## First-time setup

```bash
git clone https://github.com/lahnstrom/detection-tool.git
cd detection-tool/tool
cp .env.example .env
# Edit .env — add OPENAI_API_KEY, SERPER_API_KEY, optionally PUBMED_API_KEY

cd ..
./deploy.sh --setup
```

This installs PM2 globally, configures it to start on boot, and installs Playwright system dependencies.

## SSL setup

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d metaresearch.se -d www.metaresearch.se
certbot renew --dry-run   # verify auto-renewal
```

## Frontend deployment

To also deploy the vis-nordic frontend:

```bash
./deploy.sh --with-frontend
```

This clones vis-nordic, builds it, and copies the output to `/var/www/metaresearch/`.

## Ongoing deploys

```bash
ssh root@164.92.210.200
cd /root/detection-tool
./deploy.sh
```

The deploy script:
1. Pulls latest code from `origin/main`
2. Runs `npm install --production` in `tool/`
3. Verifies `tool/.env` exists
4. Diffs nginx config and reloads if changed
5. Restarts the PM2 process (`trialscout`)

## Nginx

The nginx config is kept in `nginx/default`. It proxies `/api/` to `localhost:3001` and serves the frontend SPA from `/var/www/metaresearch/`. SSL blocks are managed by Certbot.

## PM2 commands

```bash
pm2 status              # Check process status
pm2 logs trialscout     # View logs
pm2 restart trialscout  # Manual restart
pm2 save                # Persist process list
```
