# TrialScout — Deployment

TrialScout automatically discovers publications linked to clinical trial registrations and detects whether they contain trial results, using LLMs. This repo deploys the TrialScout server to a DigitalOcean droplet behind Nginx.

## Prerequisites

- **Node.js** v22.7+ (ES modules)
- **PM2** — process manager (`npm install -g pm2`)
- **Nginx** — reverse proxy (pre-installed on DigitalOcean Node.js images)

## Quick start

```bash
git clone https://github.com/lahnstrom/detection-tool.git
cd detection-tool/tool
cp .env.example .env   # Add your API keys
cd ..
./deploy.sh --setup    # First-time: installs PM2, configures startup
./deploy.sh            # Subsequent deploys
```

## Deploying updates

From your local machine:
```bash
./deploy.sh --remote
```

Or SSH in directly:
```bash
ssh root@164.92.210.200
cd /root/detection-tool
./deploy.sh
```

The script pulls latest code, installs dependencies, updates nginx if changed, and restarts the PM2 process.

## Tool documentation

See [tool/README.md](tool/README.md) for API endpoints, CLI modes, configuration, and source layout.
