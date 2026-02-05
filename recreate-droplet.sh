#!/bin/bash

set -e

DB_ID="7304bbc7-71be-4d27-b7f6-995733686662"
DROPLET_NAME="graph-node-kava"
REGION="fra1"
SIZE="g-2vcpu-8gb"
IMAGE="ubuntu-22-04-x64"

echo "=== Creating Graph Node Droplet with Correct SSH Key ==="
echo ""

# Get SSH key ID
SSH_KEY_ID=$(doctl compute ssh-key list --format ID --no-header | head -1)
echo "Using SSH key ID: $SSH_KEY_ID"
echo ""

# Create droplet with SSH key
echo "Creating droplet..."
DROPLET_ID=$(doctl compute droplet create $DROPLET_NAME \
  --image $IMAGE \
  --region $REGION \
  --size $SIZE \
  --ssh-keys $SSH_KEY_ID \
  --wait \
  --format ID \
  --no-header)

echo "✓ Droplet created: $DROPLET_ID"
echo "Waiting 30 seconds for droplet to boot..."
sleep 30

# Get droplet IP
DROPLET_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)
echo "✓ Droplet IP: $DROPLET_IP"
echo ""

# Add to database firewall
echo "Adding droplet to database firewall..."
doctl databases firewalls append $DB_ID --rule ip_addr:$DROPLET_IP
echo "✓ Firewall updated"
echo ""

# Get database credentials
echo "Fetching database credentials..."
DB_HOST=$(doctl databases connection $DB_ID --format Host --no-header)
DB_PORT=$(doctl databases connection $DB_ID --format Port --no-header)
DB_USER=$(doctl databases connection $DB_ID --format User --no-header)
DB_PASSWORD=$(doctl databases connection $DB_ID --format Password --no-header)
DB_DATABASE=$(doctl databases connection $DB_ID --format Database --no-header)

# Create .env file
cat > .env.production << EOF
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_DATABASE
EOF
echo "✓ Environment file created"
echo ""

# Wait for SSH to be ready
echo "Waiting 30 seconds for SSH..."
sleep 30

# Test SSH
echo "Testing SSH connection..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$DROPLET_IP "echo '✓ SSH working'"
echo ""

# Install packages
echo "Installing Docker, Nginx, Certbot..."
ssh root@$DROPLET_IP bash << 'INSTALL'
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq curl
systemctl enable docker
systemctl start docker
useradd -m -s /bin/bash graph-user
usermod -aG docker graph-user
echo "✓ Packages installed"
INSTALL
echo ""

# Copy files
echo "Copying configuration files..."
scp .env.production root@$DROPLET_IP:/home/graph-user/.env
scp docker-compose.yml root@$DROPLET_IP:/home/graph-user/
echo "✓ Files copied"
echo ""

# Configure Nginx
echo "Configuring Nginx..."
ssh root@$DROPLET_IP bash << 'NGINX'
cat > /etc/nginx/sites-available/subgraph << 'NGXCFG'
server {
    listen 80;
    server_name subgraph.scrub.money;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGXCFG
ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✓ Nginx configured"
NGINX
echo ""

# Start Graph Node
echo "Starting Graph Node..."
ssh root@$DROPLET_IP bash << 'START'
cd /home/graph-user
chown -R graph-user:graph-user /home/graph-user
su - graph-user -c "cd /home/graph-user && docker-compose up -d"
sleep 10
docker ps
START
echo ""

# Update DNS
echo "Updating DNS..."
chmod +x update-dns.sh
./update-dns.sh $DROPLET_IP
echo ""

# Wait for DNS
echo "Waiting 60 seconds for DNS propagation..."
sleep 60

# Setup SSL
echo "Setting up SSL certificate..."
ssh root@$DROPLET_IP "certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money || echo 'SSL will retry - DNS may need more time'"
echo ""

# Set GitHub secret
echo "Setting GitHub secret..."
gh secret set GRAPH_NODE_IP --body "$DROPLET_IP" --repo gaspare100/scrub-graphs
echo "✓ GitHub secret set"
echo ""

# Test graph endpoint
echo "Testing graph node..."
sleep 5
curl -s -X POST http://$DROPLET_IP:8000 -H "Content-Type: application/json" -d '{"query": "{_meta{block{number}}}"}' | jq . || echo "Graph node starting up..."
echo ""

echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Droplet IP: $DROPLET_IP"
echo "Database: $DB_HOST"
echo ""
echo "Endpoints:"
echo "  Direct: http://$DROPLET_IP:8000"
echo "  Public: https://subgraph.scrub.money"
echo ""
echo "View logs:"
echo "  ssh root@$DROPLET_IP 'docker logs -f graph-node-kava_graph-node_1'"
echo ""
echo "Deploy subgraphs:"
echo "  git checkout develop && git push  # scrubvault-test"
echo "  git checkout main && git push     # scrubvault"
echo ""
echo "Droplet ID: $DROPLET_ID"
echo "Database ID: $DB_ID"
