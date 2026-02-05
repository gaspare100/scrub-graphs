#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# Add correct SSH key
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOTdy6R8o6f4UgroniuAHljAxF9UT0F9Fp4INgLSIztP theg" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys

# Install packages
apt-get update -qq
apt-get install -y docker.io docker-compose nginx certbot python3-certbot-nginx jq curl

# Setup Docker
systemctl enable docker
systemctl start docker

# Create graph user
useradd -m -s /bin/bash graph-user
usermod -aG docker graph-user

echo "Init complete" > /root/init-complete.txt
