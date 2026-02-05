#!/bin/bash

# Update DNS A record for subgraph.scrub.money
# Run this after deployment completes with: ./update-dns.sh <DROPLET_IP>

if [ -z "$1" ]; then
  echo "Usage: ./update-dns.sh <DROPLET_IP>"
  exit 1
fi

DROPLET_IP=$1
DOMAIN="scrub.money"
RECORD="subgraph"

echo "Updating DNS for $RECORD.$DOMAIN to $DROPLET_IP..."

# Get current record ID if exists
RECORD_ID=$(doctl compute domain records list $DOMAIN --format ID,Name,Type --no-header | grep -E "^[0-9]+\s+$RECORD\s+A" | awk '{print $1}')

if [ -z "$RECORD_ID" ]; then
  echo "Creating new A record..."
  doctl compute domain records create $DOMAIN \
    --record-type A \
    --record-name $RECORD \
    --record-data $DROPLET_IP \
    --record-ttl 300
  echo "✓ DNS record created"
else
  echo "Updating existing A record (ID: $RECORD_ID)..."
  doctl compute domain records update $DOMAIN \
    --record-id $RECORD_ID \
    --record-data $DROPLET_IP
  echo "✓ DNS record updated"
fi

echo ""
echo "DNS updated successfully!"
echo "Propagation may take 5-10 minutes"
echo ""
echo "Test with: dig subgraph.scrub.money +short"
