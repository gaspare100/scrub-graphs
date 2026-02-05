#!/bin/bash

# Quick deployment script for subgraph after infrastructure is set up
# Usage: ./deploy-subgraph.sh <droplet-ip> [subgraph-name]

if [ -z "$1" ]; then
  echo "Usage: ./deploy-subgraph.sh <droplet-ip> [subgraph-name]"
  echo ""
  echo "Examples:"
  echo "  ./deploy-subgraph.sh 192.168.1.1 scrubvault-test  # Deploy test"
  echo "  ./deploy-subgraph.sh 192.168.1.1 scrubvault       # Deploy production"
  exit 1
fi

DROPLET_IP=$1
SUBGRAPH_NAME=${2:-scrubvault-test}

# Determine environment based on subgraph name
if [ "$SUBGRAPH_NAME" == "scrubvault" ]; then
  ENV="production"
  BRANCH="main"
else
  ENV="development"
  BRANCH="develop"
fi

echo "========================================="
echo "Deploying Subgraph"
echo "========================================="
echo "Subgraph: $SUBGRAPH_NAME"
echo "Environment: $ENV"
echo "Expected branch: $BRANCH"
echo "Target: $DROPLET_IP"
echo ""

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "⚠️  WARNING: You're on branch '$CURRENT_BRANCH' but deploying to $ENV ($SUBGRAPH_NAME)"
  echo "   Expected branch: $BRANCH"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "Building subgraph..."
npm run codegen
npm run build

echo ""
echo "Creating subgraph on graph node (if not exists)..."
npx graph create --node http://$DROPLET_IP:8020 $SUBGRAPH_NAME 2>/dev/null || echo "Subgraph already exists"

echo ""
echo "Deploying subgraph..."
npx graph deploy --node http://$DROPLET_IP:8020 --ipfs http://$DROPLET_IP:5001 $SUBGRAPH_NAME

echo ""
echo "========================================="
echo "Deployment Complete! 🚀"
echo "========================================="
echo "Subgraph: $SUBGRAPH_NAME"
echo "Environment: $ENV"
echo ""
echo "Endpoints:"
echo "  Query: http://$DROPLET_IP:8000/subgraphs/name/$SUBGRAPH_NAME"
echo "  GraphQL: http://$DROPLET_IP:8000/subgraphs/name/$SUBGRAPH_NAME/graphql"
echo ""
echo "Once DNS is configured:"
echo "  Query: https://subgraph.scrub.money/subgraphs/name/$SUBGRAPH_NAME"
echo "  GraphQL: https://subgraph.scrub.money/subgraphs/name/$SUBGRAPH_NAME/graphql"
