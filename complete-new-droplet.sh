#!/bin/bash
set -e

DROPLET_IP="64.227.117.95"
DROPLET_ID="549615792"
DB_ID="7304bbc7-71be-4d27-b7f6-995733686662"

echo "=== Completing Graph Node Setup ==="
echo "Droplet: $DROPLET_IP"
echo ""

# Add to database firewall
echo "Adding droplet to database firewall..."
doctl databases firewalls append $DB_ID --rule ip_addr:$DROPLET_IP 2>/dev/null || echo "Already added"
echo "✓ Firewall updated"
echo ""

# Get database credentials
echo "Fetching database credentials..."
DB_HOST=$(doctl databases connection $DB_ID --format Host --no-header)
DB_PORT=$(doctl databases connection $DB_ID --format Port --no-header)
DB_USER=$(doctl databases connection $DB_ID --format User --no-header)
DB_PASSWORD=$(doctl databases connection $DB_ID --format Password --no-header)
DB_DATABASE=$(doctl databases connection $DB_ID --format Database --no-header)

cat > .env.production << ENVEOF
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_DATABASE
ENVEOF
echo "✓ Environment file created"
echo ""

echo "Waiting 30 seconds for SSH..."
sleep 30

echo "Testing SSH..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@$DROPLET_IP "echo '✓ SSH working'"
echo ""

echo "Installing packages..."
ssh root@$DROPLET_IP 'export DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq curl && systemctl enable docker && systemctl start docker && useradd -m -s /bin/bash graph-user && usermod -aG docker graph-user && echo "✓ Packages installed"'
echo ""

echo "Copying files..."
scp .env.production root@$DROPLET_IP:/home/graph-user/.env
scp docker-compose.yml root@$DROPLET_IP:/home/graph-user/
echo "✓ Files copied"
echo ""

echo "Configuring Nginx..."
ssh root@$DROPLET_IP 'cat > /etc/nginx/sites-available/subgraph << "NGXCFG"
server {
    listen 80;
    server_name subgraph.scrub.money;
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGXCFG
ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx && echo "✓ Nginx configured"'
echo ""

echo "Starting Graph Node..."
ssh root@$DROPLET_IP 'cd /home/graph-user && chown -R graph-user:graph-user . && su - graph-user -c "cd /home/graph-user && docker-compose up -d" && sleep 10 && docker ps'
echo ""

echo "Updating DNS..."
./update-dns.sh $DROPLET_IP
echo ""

echo "Waiting 60s for DNS..."
sleep 60

echo "Setting up SSL..."
ssh root@$DROPLET_IP "certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money" || echo "SSL will retry later"
echo ""

echo "Setting GitHub secret..."
gh secret set GRAPH_NODE_IP --body "$DROPLET_IP" --repo gaspare100/scrub-graphs
echo ""

echo "========================================="
echo "✓ Complete!"
echo "========================================="
echo "Droplet: $DROPLET_IP"
echo "Public: https://subgraph.scrub.money"
echo ""
echo "Test: curl -X POST http://$DROPLET_IP:8000"
echo "Logs: ssh root@$DROPLET_IP 'docker logs -f graph-node-kava_graph-node_1'"
