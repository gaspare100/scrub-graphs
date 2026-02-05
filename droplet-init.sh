#!/bin/bash
# Run this script ON THE DROPLET via DigitalOcean console

set -e

echo "=== Setting up Graph Node on Droplet ==="
echo ""

# Install required packages
echo "Installing packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  docker.io \
  docker-compose \
  nginx \
  certbot \
  python3-certbot-nginx \
  jq \
  curl

# Enable Docker
systemctl enable docker
systemctl start docker

# Create graph user
useradd -m -s /bin/bash graph-user || true
usermod -aG docker graph-user

echo "✓ Packages installed"
echo ""

# Add SSH key for external access
echo "Adding SSH key..."
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOTdy6R8o6f4UgroniuAHljAxF9UT0F9Fp4INgLSIztP theg" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
echo "✓ SSH key added"
echo ""

echo "✓ Setup complete!"
echo ""
echo "Now you can SSH from your local machine:"
echo "  ssh root@68.183.216.208"
