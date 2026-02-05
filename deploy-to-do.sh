#!/bin/bash

set -e

echo "=== Setting up Graph Node on DigitalOcean ==="
echo ""

# Configuration
DROPLET_NAME="graph-node-kava"
REGION="fra1"
SIZE="g-2vcpu-8gb"  # General purpose with 8GB RAM
IMAGE="ubuntu-22-04-x64"
DB_NAME="graph-node-db"
DB_SIZE="db-s-1vcpu-2gb"  # Smallest managed DB

echo "1. Creating managed PostgreSQL database..."
echo "   Name: $DB_NAME"
echo "   Region: $REGION"
echo "   Size: $DB_SIZE"
echo ""

# Create database cluster
doctl databases create $DB_NAME \
  --engine pg \
  --region $REGION \
  --size $DB_SIZE \
  --version 14 \
  --num-nodes 1

echo ""
echo "Waiting for database to be ready (this may take 5-10 minutes)..."
sleep 30

# Get database ID
DB_ID=$(doctl databases list --format ID,Name --no-header | grep $DB_NAME | awk '{print $1}')
echo "Database ID: $DB_ID"

# Wait for database to be online
while true; do
  DB_STATUS=$(doctl databases get $DB_ID --format Status --no-header)
  if [ "$DB_STATUS" == "online" ]; then
    echo "Database is online!"
    break
  fi
  echo "Database status: $DB_STATUS - waiting..."
  sleep 10
done

# Get database connection details
echo ""
echo "2. Getting database connection details..."
DB_HOST=$(doctl databases connection $DB_ID --format Host --no-header)
DB_PORT=$(doctl databases connection $DB_ID --format Port --no-header)
DB_USER=$(doctl databases connection $DB_ID --format User --no-header)
DB_PASSWORD=$(doctl databases connection $DB_ID --format Password --no-header)
DB_DATABASE=$(doctl databases connection $DB_ID --format Database --no-header)

echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo "   User: $DB_USER"
echo "   Database: $DB_DATABASE"
echo ""

# Create droplet
echo "3. Creating droplet..."
echo "   Name: $DROPLET_NAME"
echo "   Region: $REGION"
echo "   Size: $SIZE (2 vCPU, 8GB RAM)"
echo ""

DROPLET_ID=$(doctl compute droplet create $DROPLET_NAME \
  --image $IMAGE \
  --region $REGION \
  --size $SIZE \
  --ssh-keys $(doctl compute ssh-key list --format ID --no-header | head -1) \
  --wait \
  --format ID \
  --no-header)

echo "Droplet ID: $DROPLET_ID"

# Wait for droplet to be active
sleep 30

# Get droplet IP
DROPLET_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)
echo "Droplet IP: $DROPLET_IP"

# Add droplet to database trusted sources
echo ""
echo "4. Adding droplet to database trusted sources..."
doctl databases firewalls append $DB_ID --rule ip_addr:$DROPLET_IP

echo ""
echo "5. Creating .env file for droplet..."
cat > .env.production << EOF
POSTGRES_HOST=$DB_HOST
POSTGRES_PORT=$DB_PORT
POSTGRES_USER=$DB_USER
POSTGRES_PASSWORD=$DB_PASSWORD
POSTGRES_DB=$DB_DATABASE
EOF

echo ""
echo "6. Waiting for droplet SSH to be ready..."
sleep 30

echo ""
echo "7. Setting up droplet..."
ssh -o StrictHostKeyChecking=no root@$DROPLET_IP << 'ENDSSH'
# Update system
apt-get update
apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install docker-compose
apt-get install -y docker-compose

# Install nginx and certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Create graph user
useradd -m -s /bin/bash graph-user
usermod -aG docker graph-user

echo "Setup complete on droplet"
ENDSSH

echo ""
echo "8. Copying files to droplet..."
scp .env.production root@$DROPLET_IP:/home/graph-user/.env
scp docker-compose.yml root@$DROPLET_IP:/home/graph-user/
scp -r subgraph.yaml schema.graphql src build root@$DROPLET_IP:/home/graph-user/ 2>/dev/null || true

echo ""
echo "9. Configuring nginx reverse proxy..."
ssh root@$DROPLET_IP << EOF
cat > /etc/nginx/sites-available/subgraph << 'NGINX'
server {
    listen 80;
    server_name subgraph.scrub.money;

    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/subgraph /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
EOF

echo ""
echo "10. Starting graph node..."
ssh root@$DROPLET_IP << 'EOF'
cd /home/graph-user
chown -R graph-user:graph-user /home/graph-user
su - graph-user -c "cd /home/graph-user && docker-compose up -d"
EOF

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Droplet IP: $DROPLET_IP"
echo "Database Host: $DB_HOST"
echo ""
echo "Next steps:"
echo "1. Point subgraph.scrub.money DNS A record to: $DROPLET_IP"
echo "2. Wait for DNS propagation (5-10 minutes)"
echo "3. Run SSL certificate setup:"
echo "   ssh root@$DROPLET_IP"
echo "   certbot --nginx -d subgraph.scrub.money"
echo ""
echo "4. Deploy your subgraph:"
echo "   npm run codegen"
echo "   npm run build"
echo "   graph create --node http://$DROPLET_IP:8020 scrubvault-test"
echo "   graph deploy --node http://$DROPLET_IP:8020 --ipfs http://$DROPLET_IP:5001 scrubvault-test"
echo ""
echo "5. Monitor graph node:"
echo "   ssh root@$DROPLET_IP"
echo "   docker logs -f graph-user_graph-node_1"
echo ""
echo "Connection details saved in .env.production"
