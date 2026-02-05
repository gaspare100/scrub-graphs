#!/bin/bash
set -e

DROPLET_IP="165.227.158.85"
DROPLET_ID="549621129"
DB_ID="7304bbc7-71be-4d27-b7f6-995733686662"

echo "=== Final Graph Node Setup ==="
echo "Droplet: $DROPLET_IP"
echo ""

# Add to database firewall
echo "Adding to database firewall..."
doctl databases firewalls append $DB_ID --rule ip_addr:$DROPLET_IP 2>/dev/null || echo "Already added"
echo "✓ Firewall configured"
echo ""

# Get DB credentials
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

echo "Waiting 60s for cloud-init..."
sleep 60

echo "Testing SSH..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -i ~/.ssh/theg root@$DROPLET_IP "uptime && echo '✓ SSH works'"
echo ""

echo "Creating graph-user and directories..."
ssh -i ~/.ssh/theg root@$DROPLET_IP 'useradd -m -s /bin/bash graph-user || true && mkdir -p /home/graph-user'
echo "✓ User and directories created"
echo ""

echo "Copying files..."
scp -i ~/.ssh/theg .env.production root@$DROPLET_IP:/home/graph-user/.env
scp -i ~/.ssh/theg docker-compose.yml root@$DROPLET_IP:/home/graph-user/
echo "✓ Files copied"
echo ""

echo "Installing Nginx and Certbot..."
ssh -i ~/.ssh/theg root@$DROPLET_IP 'apt-get update -qq && apt-get install -y nginx certbot python3-certbot-nginx'
echo "✓ Packages installed"
echo ""

echo "Configuring Nginx..."
ssh -i ~/.ssh/theg root@$DROPLET_IP 'cat > /etc/nginx/sites-available/subgraph << "NGXCFG"
server {
    listen 80;
    server_name subgraph.scrub.money;
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
NGXCFG
ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx'
echo "✓ Nginx configured"
echo ""

echo "Starting Graph Node..."
ssh -i ~/.ssh/theg root@$DROPLET_IP 'cd /home/graph-user && chown -R graph-user:graph-user . && su - graph-user -c "cd /home/graph-user && docker-compose up -d" && sleep 10 && docker ps'
echo ""

echo "Updating DNS..."
./update-dns.sh $DROPLET_IP
echo ""

sleep 30
echo "Setting up SSL..."
ssh -i ~/.ssh/theg root@$DROPLET_IP "certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money" || echo "SSL pending DNS"
echo ""

echo "Setting GitHub secret..."
gh secret set GRAPH_NODE_IP --body "$DROPLET_IP" --repo gaspare100/scrub-graphs
echo ""

echo "========================================="
echo "✓ DEPLOYMENT COMPLETE!"
echo "========================================="
echo ""
echo "Droplet: $DROPLET_IP (ID: $DROPLET_ID)"
echo "Database: $DB_HOST"
echo ""
echo "Graph Node: http://$DROPLET_IP:8000"
echo "Public URL: https://subgraph.scrub.money"
echo ""
echo "Commands:"
echo "  Logs: ssh -i ~/.ssh/theg root@$DROPLET_IP 'docker logs -f graph-node-kava_graph-node_1'"
echo "  Deploy: git checkout develop && git push"
