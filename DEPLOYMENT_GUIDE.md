# Graph Node Deployment Guide

## Overview

This repository contains two subgraphs:
- **scrubvault-test** (development) - deployed from `develop` branch
- **scrubvault** (production) - deployed from `main` branch

## Automatic Deployment

Deployments happen automatically via GitHub Actions when you push to:
- `develop` branch → deploys to **scrubvault-test**
- `main` branch → deploys to **scrubvault**

### Setup GitHub Secrets

Add this secret to your repository (Settings → Secrets → Actions):
- `GRAPH_NODE_IP` - The IP address of your DigitalOcean droplet

## Manual Deployment

### Prerequisites
```bash
npm install
```

### Deploy Test (from develop branch)
```bash
git checkout develop
./deploy-subgraph.sh <DROPLET_IP> scrubvault-test
```

### Deploy Production (from main branch)
```bash
git checkout main
./deploy-subgraph.sh <DROPLET_IP> scrubvault
```

## Initial Infrastructure Setup

### 1. Deploy to DigitalOcean
```bash
chmod +x deploy-to-do.sh
./deploy-to-do.sh
```

This creates:
- Managed PostgreSQL database (2GB)
- Droplet with Docker (2 vCPU, 8GB RAM)
- Graph node with optimized settings (1000 block batches)
- Nginx reverse proxy
- IPFS node

### 2. Configure DNS
Point `subgraph.scrub.money` A record to the droplet IP shown after deployment.

### 3. Setup SSL
```bash
ssh root@<DROPLET_IP>
certbot --nginx -d subgraph.scrub.money
```

### 4. Deploy Both Subgraphs

From develop branch:
```bash
git checkout develop
./deploy-subgraph.sh <DROPLET_IP> scrubvault-test
```

From main branch:
```bash
git checkout main
./deploy-subgraph.sh <DROPLET_IP> scrubvault
```

## Endpoints

### Development (scrubvault-test)
- Query: https://subgraph.scrub.money/subgraphs/name/scrubvault-test
- GraphQL: https://subgraph.scrub.money/subgraphs/name/scrubvault-test/graphql

### Production (scrubvault)
- Query: https://subgraph.scrub.money/subgraphs/name/scrubvault
- GraphQL: https://subgraph.scrub.money/subgraphs/name/scrubvault/graphql

## Monitoring

### Check sync status
```bash
ssh root@<DROPLET_IP>
docker logs -f graph-node-kava_graph-node_1
```

### Query sync progress
```bash
curl -X POST https://subgraph.scrub.money/subgraphs/name/scrubvault-test \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number hash timestamp } hasIndexingErrors } }"}'
```

## Configuration

### RPC Endpoint
Kava Nodies RPC: `https://lb.nodies.app/v1/9e49c973e9d546a48adbd48915c70f1d`

### Performance Settings
- Block batch size: 1000
- Max block range: 10000
- Target triggers per block: 1000

### Database
- Managed PostgreSQL on DigitalOcean
- Connection details in `.env` file on droplet

## Development Workflow

1. Make changes to mappings in `src/`
2. Test locally or push to `develop` branch
3. GitHub Actions deploys to `scrubvault-test`
4. Verify at https://subgraph.scrub.money/subgraphs/name/scrubvault-test
5. Merge to `main` when ready
6. GitHub Actions deploys to `scrubvault` (production)

## Troubleshooting

### Check graph node logs
```bash
ssh root@<DROPLET_IP>
docker logs graph-node-kava_graph-node_1 --tail 100 -f
```

### Restart graph node
```bash
ssh root@<DROPLET_IP>
cd /home/graph-user
docker-compose restart graph-node
```

### Check database connection
```bash
ssh root@<DROPLET_IP>
cd /home/graph-user
cat .env
```

### Rebuild and redeploy
```bash
docker-compose down
docker-compose up -d
```
