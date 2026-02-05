#!/bin/bash

DROPLET_IP="68.183.216.208"
DB_HOST="graph-node-db-do-user-11635192-0.a.db.ondigitalocean.com"
DB_PORT="25060"
DB_ID="7304bbc7-71be-4d27-b7f6-995733686662"

echo "=== Completing Graph Node Setup ==="
echo ""
echo "Droplet: $DROPLET_IP"
echo ""

# Get database credentials
echo "Getting database credentials..."
DB_USER=$(doctl databases connection $DB_ID --format User --no-header)
DB_PASSWORD=$(doctl databases connection $DB_ID --format Password --no-header)
DB_DATABASE=$(doctl databases connection $DB_ID --format Database --no-header)

# Create updated env file
cat > .env.production << EOF
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_DATABASE
EOF

echo "✓ Environment file ready"
echo ""
echo "The droplet is at: $DROPLET_IP"
echo ""
echo "You need to manually complete setup. Run these commands:"
echo ""
echo "# 1. Add your SSH key to the droplet (one-time password from DO console)"
echo "ssh-copy-id root@$DROPLET_IP"
echo ""
echo "# 2. Then run this setup:"
cat << 'SETUPCMD'
ssh root@68.183.216.208 'bash -s' << 'ENDSSH'
set -e
echo "Installing Docker..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq curl
systemctl enable docker
systemctl start docker
useradd -m -s /bin/bash graph-user || true
usermod -aG docker graph-user
echo "✓ Setup complete"
ENDSSH

# Copy files
scp .env.production root@68.183.216.208:/home/graph-user/.env
scp docker-compose.yml root@68.183.216.208:/home/graph-user/

# Configure nginx
ssh root@68.183.216.208 'bash -s' << 'NGINX'
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
    }
}
NGXCFG
ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
NGINX

# Start graph node
ssh root@68.183.216.208 'bash -s' << 'START'
cd /home/graph-user
chown -R graph-user:graph-user /home/graph-user
su - graph-user -c "cd /home/graph-user && docker-compose up -d"
docker ps
START

# Update DNS
./update-dns.sh 68.183.216.208

# Setup SSL
ssh root@68.183.216.208 "certbot --nginx -d subgraph.scrub.money --non-interactive --agree-tos -m gaspare@scrub.money"

# Set GitHub secret
gh secret set GRAPH_NODE_IP --body "68.183.216.208" --repo gaspare100/scrub-graphs

echo "✓ Complete!"
SETUPCMD
