#!/bin/bash

set -e

DB_ID="7304bbc7-71be-4d27-b7f6-995733686662"
DB_NAME="graph-node-db"
DROPLET_NAME="graph-node-kava"
REGION="fra1"
SIZE="g-2vcpu-8gb"
IMAGE="ubuntu-22-04-x64"

echo "=== Continuing Graph Node Deployment ==="
echo ""
echo "Database ID: $DB_ID"
echo ""

# Wait for database
echo "Waiting for database to be online..."
while true; do
  DB_STATUS=$(doctl databases get $DB_ID --format Status --no-header 2>/dev/null || echo "error")
  if [ "$DB_STATUS" == "online" ]; then
    echo "✓ Database is online!"
    break
  elif [ "$DB_STATUS" == "error" ]; then
    echo "Error getting database status. Retrying..."
  else
    echo "  Status: $DB_STATUS - waiting..."
  fi
  sleep 15
done

# Get database connection details
echo ""
echo "Getting database connection details..."
DB_HOST=$(doctl databases connection $DB_ID --format Host --no-header)
DB_PORT=$(doctl databases connection $DB_ID --format Port --no-header)
DB_USER=$(doctl databases connection $DB_ID --format User --no-header)
DB_PASSWORD=$(doctl databases connection $DB_ID --format Password --no-header)
DB_DATABASE=$(doctl databases connection $DB_ID --format Database --no-header)

echo "✓ Database ready"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo ""

# Create droplet
echo "Creating droplet..."
DROPLET_ID=$(doctl compute droplet create $DROPLET_NAME \
  --image $IMAGE \
  --region $REGION \
  --size $SIZE \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
  --wait \
  --format ID \
  --no-header)

echo "✓ Droplet created: $DROPLET_ID"
sleep 30

# Get droplet IP
DROPLET_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)
echo "✓ Droplet IP: $DROPLET_IP"

# Add droplet to database firewall
echo ""
echo "Adding droplet to database firewall..."
doctl databases firewalls append $DB_ID --rule ip_addr:$DROPLET_IP
echo "✓ Firewall updated"

# Create .env file
echo ""
echo "Creating .env.production..."
cat > .env.production << EOF
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_DATABASE
EOF
echo "✓ Environment file created"

# Wait for SSH
echo ""
echo "Waiting for SSH (30 seconds)..."
sleep 30

echo ""
echo "Setting up droplet..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP bash << 'ENDSSH'
set -e
apt-get update -qq
apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq
systemctl enable docker
systemctl start docker
useradd -m -s /bin/bash graph-user
usermod -aG docker graph-user
echo "✓ Droplet setup complete"
ENDSSH

echo ""
echo "Copying files..."
scp .env.production root@$DROPLET_IP:/home/graph-user/.env
scp docker-compose.yml root@$DROPLET_IP:/home/graph-user/
echo "✓ Files copied"

echo ""
echo "Configuring nginx..."
ssh root@$DROPLET_IP bash << 'EOF'
cat > /etc/nginx/sites-available/subgraph << 'NGINX'
server {
    listen 80;
    server_name subgraph.scrub.money;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
EOF
echo "✓ Nginx configured"

echo ""
echo "Starting graph node..."
ssh root@$DROPLET_IP bash << 'EOF'
cd /home/graph-user
chown -R graph-user:graph-user /home/graph-user
su - graph-user -c "cd /home/graph-user && docker-compose up -d"
sleep 10
docker ps
EOF
echo "✓ Graph node started"

echo ""
echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Droplet IP: $DROPLET_IP"
echo "Database: $DB_HOST"
echo ""
echo "Setting GitHub secret..."
gh secret set GRAPH_NODE_IP --body "$DROPLET_IP" --repo gaspare100/scrub-graphs
echo "✓ GitHub secret set"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Point DNS A record for subgraph.scrub.money to: $DROPLET_IP"
echo ""
echo "2. Setup SSL (after DNS propagates):"
echo "   ssh root@$DROPLET_IP"
echo "   certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money"
echo ""
echo "3. Deploy subgraphs:"
echo "   git checkout develop && git push origin develop"
echo "   git checkout main && git push origin main"
echo ""
echo "View logs:"
echo "   ssh root@$DROPLET_IP 'docker logs -f graph-node-kava_graph-node_1'"
