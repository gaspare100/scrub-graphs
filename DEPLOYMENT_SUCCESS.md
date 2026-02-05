# The Graph Node - DigitalOcean Deployment Complete ✅

**Deployment Date**: February 5, 2026  
**Status**: OPERATIONAL

## 🎯 Infrastructure Overview

### Droplet Configuration
- **IP Address**: 165.227.158.85
- **Region**: Frankfurt (fra1)
- **Size**: g-2vcpu-8gb (8GB RAM, 2 vCPUs)
- **OS**: Ubuntu 22.04 with Docker
- **Droplet ID**: 549621129

### Services Running
```
✅ Graph Node v0.41.1      - Ports: 8000, 8001, 8020, 8030, 8040
✅ PostgreSQL 14 (Alpine)  - Port: 5432 (C locale configured)
✅ IPFS v0.4.23           - Port: 5001
✅ Nginx (Reverse Proxy)  - Port: 80
```

### Network Configuration
- **Domain**: subgraph.scrub.money (pending DNS update)
- **Blockchain**: Kava (via Nodies.app RPC)
- **RPC Endpoint**: https://lb.nodies.app/v1/9e49c973e9d546a48adbd48915c70f1d

## 🔧 Technical Details

### PostgreSQL Configuration
**Critical**: Uses C locale for optimal performance (10x faster string comparisons)
```yaml
POSTGRES_INITDB_ARGS: "-E UTF8 --lc-collate=C --lc-ctype=C"
```

This resolved the incompatibility with DigitalOcean Managed PostgreSQL which only supports en_US.UTF-8.

### Performance Tuning
```yaml
GRAPH_ETHEREUM_BLOCK_BATCH_SIZE: '1000'
GRAPH_ETHEREUM_MAX_BLOCK_RANGE_SIZE: '10000'
GRAPH_ETHEREUM_TARGET_TRIGGERS_PER_BLOCK_RANGE: '1000'
```

### Data Persistence
```
/home/graph-user/data/postgres/  - PostgreSQL data
/home/graph-user/data/ipfs/     - IPFS data
```

## 🚀 Deployment Workflow

### Automatic Deployment (via GitHub Actions)
```yaml
Trigger: Push to develop or main branch
Branches:
  - develop → deploys to scrubvault-test
  - main    → deploys to scrubvault
```

### Manual Deployment
```bash
# SSH into droplet
ssh -i ~/.ssh/theg root@165.227.158.85

# Deploy a subgraph
cd /home/graph-user
graph deploy --node http://localhost:8020 \
             --ipfs http://localhost:5001 \
             your-subgraph-name \
             path/to/subgraph
```

## 🔐 SSH Access

### SSH Keys Configured
- **DO Account Key**: 37257735 (fingerprint: 0d:53:ea:12:67:83:15:fe:9d:c1:2f:16:04:ac:f8:5e)
- **Local theg Key**: 53881058 (fingerprint: 94:e1:06:44:a6:a4:7e:62:37:d4:97:f2:b6:01:e5:9e)

### Connect to Droplet
```bash
ssh -i ~/.ssh/theg root@165.227.158.85
```

## 📊 Monitoring & Management

### Check Container Status
```bash
ssh -i ~/.ssh/theg root@165.227.158.85 'docker ps'
```

### View Graph Node Logs
```bash
ssh -i ~/.ssh/theg root@165.227.158.85 'docker logs graph-user-graph-node-1 -f'
```

### View PostgreSQL Logs
```bash
ssh -i ~/.ssh/theg root@165.227.158.85 'docker logs graph-user-postgres-1 -f'
```

### Query Indexing Status
```bash
curl http://165.227.158.85:8030/graphql \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{indexingStatuses { subgraph health synced fatalError { message } }}"}'
```

### Restart Services
```bash
ssh -i ~/.ssh/theg root@165.227.158.85 'cd /home/graph-user && docker compose restart'
```

## 🌐 GraphQL Endpoints

### After DNS Update (Pending)
- **Subgraph Queries**: https://subgraph.scrub.money/subgraphs/name/{subgraph-name}
- **GraphQL Playground**: https://subgraph.scrub.money/
- **Admin API**: https://subgraph.scrub.money:8020/

### Current (Direct IP)
- **Subgraph Queries**: http://165.227.158.85:8000/subgraphs/name/{subgraph-name}
- **Admin API**: http://165.227.158.85:8020/
- **Index Node**: http://165.227.158.85:8030/graphql

## 📋 Next Steps

1. **Update DNS Record**
   ```bash
   cd /Users/gasparemarchese/scrub/scrub-graphs
   ./update-dns.sh
   ```

2. **Install SSL Certificate** (after DNS propagation)
   ```bash
   ssh -i ~/.ssh/theg root@165.227.158.85
   certbot --nginx -d subgraph.scrub.money
   ```

3. **Deploy First Subgraph**
   ```bash
   # From local machine
   cd /Users/gasparemarchese/scrub/scrub-graphs
   git checkout develop
   git push origin develop  # Triggers auto-deployment
   ```

4. **Verify Deployment**
   ```bash
   # Check indexing status
   curl http://165.227.158.85:8030/graphql \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"query": "{indexingStatuses { subgraph synced health }}"}'
   ```

## 💰 Cost Breakdown

### Current Monthly Costs
- **Droplet (g-2vcpu-8gb)**: ~$84/month
- **Bandwidth**: Included (2TB transfer)
- **Backups** (if enabled): ~$8.40/month

### Costs Saved
- ~~Managed PostgreSQL~~: $15/month (deleted - using local PostgreSQL)

**Total Monthly Cost**: ~$84/month (droplet only)

## 🛠️ Troubleshooting

### Graph Node Won't Start
```bash
# Check logs
ssh -i ~/.ssh/theg root@165.227.158.85 'docker logs graph-user-graph-node-1'

# Common issues:
# 1. PostgreSQL not ready - wait 30 seconds after restart
# 2. IPFS not ready - check IPFS logs
# 3. Locale errors - ensure postgres container uses C locale
```

### Database Issues
```bash
# Restart PostgreSQL
ssh -i ~/.ssh/theg root@165.227.158.85 'docker restart graph-user-postgres-1'

# Reset database (CAUTION: destroys all subgraph data)
ssh -i ~/.ssh/theg root@165.227.158.85 'cd /home/graph-user && docker compose down && rm -rf data/postgres && docker compose up -d'
```

### Subgraph Not Indexing
```bash
# Check indexing status
curl http://165.227.158.85:8030/graphql -X POST -H "Content-Type: application/json" \
  -d '{"query": "{indexingStatuses { subgraph fatalError { message } }}"}'

# Check RPC connectivity
ssh -i ~/.ssh/theg root@165.227.158.85 'docker exec graph-user-graph-node-1 curl -s https://lb.nodies.app/v1/9e49c973e9d546a48adbd48915c70f1d -X POST -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}"'
```

## 📚 Important Files

- `/home/graph-user/docker-compose.yml` - Container orchestration
- `/home/graph-user/data/` - Persistent data directory
- `/etc/nginx/sites-available/subgraph` - Nginx configuration
- `~/.ssh/theg` - SSH private key (LOCAL - never commit!)

## 🎓 Lessons Learned

1. **Database Locale is Critical**: The Graph Node REQUIRES PostgreSQL with C locale
   - Managed databases from cloud providers often don't support this
   - Local PostgreSQL with explicit locale configuration is more reliable

2. **SSH Key Management**: DigitalOcean requires explicit key upload via doctl
   - Can't assume local keys exist in DO account
   - Use `doctl compute ssh-key create` to upload

3. **Docker Compose Evolution**: `--env-file` flag needed for non-standard env files
   - PostgreSQL data persists between container recreations
   - Must explicitly delete data directory to reset database

4. **Graph Node Startup**: Requires both IPFS and PostgreSQL to be ready
   - Allow 30+ seconds for full initialization
   - Check logs to verify successful connection

## 📞 Support Resources

- **The Graph Documentation**: https://thegraph.com/docs/
- **Graph Node GitHub**: https://github.com/graphprotocol/graph-node
- **Discord**: https://discord.gg/graphprotocol

---

**Deployed by**: GitHub Copilot Agent Mode  
**Repository**: https://github.com/yourusername/scrub-graphs
