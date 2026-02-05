# Manual Setup Instructions

The automated deployment created:
- ✓ PostgreSQL Database (ID: 7304bbc7-71be-4d27-b7f6-995733686662)
- ✓ Droplet at **68.183.216.208** (ID: 549612808)
- ✓ Database firewall configured

However, SSH key authentication failed. Complete the setup manually:

## Step 1: Access Droplet Console

1. Go to https://cloud.digitalocean.com/droplets/549612808
2. Click "Console" button (top right)
3. Login as root (password was emailed to you)

## Step 2: Run Init Script in Console

Paste this into the DigitalOcean console:

```bash
apt-get update && apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq curl && systemctl enable docker && systemctl start docker && useradd -m -s /bin/bash graph-user && usermod -aG docker graph-user && mkdir -p /root/.ssh && echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOTdy6R8o6f4UgroniuAHljAxF9UT0F9Fp4INgLSIztP theg" >> /root/.ssh/authorized_keys && chmod 700 /root/.ssh && chmod 600 /root/.ssh/authorized_keys && echo "Setup complete! You can now SSH from your local machine."
```

## Step 3: Run Finish Script Locally

From your local machine:

```bash
cd /Users/gasparemarchese/scrub/scrub-graphs
chmod +x finish-setup.sh
./finish-setup.sh
```

This will:
- Copy configuration files
- Setup Nginx reverse proxy
- Start Graph Node with Docker
- Update DNS for subgraph.scrub.money
- Setup SSL certificate
- Configure GitHub Actions secret

## Alternative: Quick Commands

If you prefer, run these manually:

### On Droplet (via DO console):
```bash
# Install packages
apt-get update
apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq

# Setup Docker
systemctl enable docker
systemctl start docker
useradd -m -s /bin/bash graph-user
usermod -aG docker graph-user

# Add your SSH key
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOTdy6R8o6f4UgroniuAHljAxF9UT0F9Fp4INgLSIztP theg" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
```

### From Local Machine:
```bash
cd /Users/gasparemarchese/scrub/scrub-graphs

# Create .env file
doctl databases connection 7304bbc7-71be-4d27-b7f6-995733686662 --format URI

# Copy files
scp .env.production root@68.183.216.208:/home/graph-user/.env
scp docker-compose.yml root@68.183.216.208:/home/graph-user/

# Setup Nginx
ssh root@68.183.216.208 'cat > /etc/nginx/sites-available/subgraph << "EOF"
server {
    listen 80;
    server_name subgraph.scrub.money;
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF
ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx'

# Start Graph Node
ssh root@68.183.216.208 'cd /home/graph-user && chown -R graph-user:graph-user . && su - graph-user -c "cd /home/graph-user && docker-compose up -d"'

# Update DNS
./update-dns.sh 68.183.216.208

# Setup SSL (wait 5 min for DNS)
ssh root@68.183.216.208 "certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money"

# Set GitHub secret
gh secret set GRAPH_NODE_IP --body "68.183.216.208" --repo gaspare100/scrub-graphs
```

## Verification

After setup:
```bash
# Check graph node
curl http://68.183.216.208:8000

# Check via domain (after DNS)
curl https://subgraph.scrub.money

# View logs
ssh root@68.183.216.208 'docker logs -f graph-node-kava_graph-node_1'
```

## Deploy Subgraphs

Once everything is running:
```bash
# Deploy test
git checkout develop
git push origin develop

# Deploy production
git checkout main
git push origin main
```

## Database Connection Details

- Host: graph-node-db-do-user-11635192-0.a.db.ondigitalocean.com
- Port: 25060
- Get full URI: `doctl databases connection 7304bbc7-71be-4d27-b7f6-995733686662 --format URI`
