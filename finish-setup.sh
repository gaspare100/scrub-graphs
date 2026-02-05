#!/bin/bash
# Run this from your LOCAL machine after droplet-init.sh completes

set -e

DROPLET_IP="68.183.216.208"
DB_ID="7304bbc7-71be-4d27-b7f6-995733686662"

echo "=== Completing Graph Node Deployment ==="
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

# Test SSH connection
echo "Testing SSH connection..."
ssh -o ConnectTimeout=5 root@$DROPLET_IP "echo '✓ SSH working'"
echo ""

# Copy files
echo "Copying files to droplet..."
scp .env.production root@$DROPLET_IP:/home/graph-user/.env
scp docker-compose.yml root@$DROPLET_IP:/home/graph-user/
echo "✓ Files copied"
echo ""

# Configure Nginx
echo "Configuring Nginx reverse proxy..."
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
    }
}
NGXCFG

ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "✓ Nginx configured"
NGINX

echo "✓ Nginx ready"
echo ""

# Start graph node
echo "Starting Graph Node..."
ssh root@$DROPLET_IP bash << 'START'
cd /home/graph-user
chown -R graph-user:graph-user /home/graph-user
su - graph-user -c "cd /home/graph-user && docker-compose up -d"
sleep 5
docker ps
START

echo "✓ Graph Node started"
echo ""

# Update DNS
echo "Updating DNS..."
chmod +x update-dns.sh
./update-dns.sh $DROPLET_IP

echo "✓ DNS updated"
echo ""

# Wait for DNS propagation
echo "Waiting 30 seconds for DNS propagation..."
sleep 30

# Setup SSL
echo "Setting up SSL certificate..."
ssh root@$DROPLET_IP "certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money" || echo "SSL setup failed - DNS may not be propagated yet"

echo ""

# Set GitHub secret
echo "Setting GitHub secret..."
gh secret set GRAPH_NODE_IP --body "$DROPLET_IP" --repo gaspare100/scrub-graphs
echo "✓ GitHub secret set"

echo ""
echo "========================================="
echo "✓ Deployment Complete!"
echo "========================================="
echo ""
echo "Droplet IP: $DROPLET_IP"
echo "Graph Node: http://$DROPLET_IP:8000"
echo "Public URL: https://subgraph.scrub.money"
echo ""
echo "View logs:"
echo "  ssh root@$DROPLET_IP 'docker logs -f graph-node-kava_graph-node_1'"
echo ""
echo "Deploy subgraphs:"
echo "  git checkout develop && git push origin develop  # scrubvault-test"
echo "  git checkout main && git push origin main        # scrubvault"
