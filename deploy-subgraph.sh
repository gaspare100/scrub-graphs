#!/bin/bash

# Quick deployment script for subgraph after infrastructure is set up
# Usage: ./deploy-subgraph.sh <droplet-ip> [subgraph-name]

if [ -z "$1" ]; then
  echo "Usage: ./deploy-subgraph.sh <droplet-ip> [subgraph-name]"
  echo ""
  echo "Examples:"
  echo "  ./deploy-subgraph.sh 192.168.1.1 scrubvault-test  # Deploy test"
  echo "  ./deploy-subgraph.sh 192.168.1.1 scrubvault       # Deploy production"
  echo "  ./deploy-subgraph.sh 192.168.1.1 scrubvault-arbitrum # Deploy Arbitrum"
  exit 1
fi

DROPLET_IP=$1
SUBGRAPH_NAME=${2:-scrubvault-test}

  case "$SUBGRAPH_NAME" in
    scrubvault|scrubvault-arbitrum)
      ENV="production"
      BRANCH="main"
      ;;
    *)
      ENV="development"
      BRANCH="develop"
      ;;
  esac

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
if [ "$SUBGRAPH_NAME" == "scrubvault-arbitrum" ]; then
  npm run codegen-scrubvault-arbitrum
  npm run build-scrubvault-arbitrum
else
  npm run codegen
  npm run build
fi

echo ""
echo "Creating subgraph on graph node (if not exists)..."
npx graph create --node http://$DROPLET_IP:8020 $SUBGRAPH_NAME || echo "Subgraph may already exist"

echo ""
echo "Deploying subgraph..."
if [ "$SUBGRAPH_NAME" == "scrubvault-arbitrum" ]; then
  npx graph deploy --node http://$DROPLET_IP:8020 --ipfs http://$DROPLET_IP:5001 $SUBGRAPH_NAME generated/subgraph.scrubvault-arbitrum.yaml
else
  npx graph deploy --node http://$DROPLET_IP:8020 --ipfs http://$DROPLET_IP:5001 $SUBGRAPH_NAME
fi

echo ""
echo "========================================="
echo "Deployment Complete! 🚀"
echo "========================================="
echo "Subgraph: $SUBGRAPH_NAME"
echo "Environment: $ENV"
if [ "$SUBGRAPH_NAME" == "scrubvault-arbitrum" ]; then
  echo "Manifest: generated/subgraph.scrubvault-arbitrum.yaml"
fi
echo ""
echo "Endpoints:"
echo "  Query: http://$DROPLET_IP:8000/subgraphs/name/$SUBGRAPH_NAME"
echo "  GraphQL: http://$DROPLET_IP:8000/subgraphs/name/$SUBGRAPH_NAME/graphql"
echo ""
echo "Once DNS is configured:"
echo "  Query: https://subgraph.scrub.money/subgraphs/name/$SUBGRAPH_NAME"
echo "  GraphQL: https://subgraph.scrub.money/subgraphs/name/$SUBGRAPH_NAME/graphql"
