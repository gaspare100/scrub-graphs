#!/usr/bin/env ts-node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get start block argument
const startBlock = process.argv[2];

if (!startBlock || isNaN(Number(startBlock))) {
  console.error('❌ Error: Please provide a valid start block number');
  console.error('Usage: npm run deploy-graft <startBlock>');
  console.error('Example: npm run deploy-graft 19087544');
  process.exit(1);
}

console.log('🚀 Starting deployment...');
console.log(`📦 Start Block: ${startBlock}`);

// Read and process subgraph.yaml with mustache template substitution
const subgraphPath = path.join(__dirname, '..', 'subgraph.yaml');
let subgraphContent = fs.readFileSync(subgraphPath, 'utf8');

// Replace {{ scrubvault_start_block }} with actual value
subgraphContent = subgraphContent.replace(/\{\{\s*scrubvault_start_block\s*\}\}/g, startBlock);

// Replace {{ graft_block }} with actual value (use startBlock - 1 for safety)
const graftBlock = (Number(startBlock) - 1).toString();
subgraphContent = subgraphContent.replace(/\{\{\s*graft_block\s*\}\}/g, graftBlock);

// Write processed content back
fs.writeFileSync(subgraphPath, subgraphContent, 'utf8');
console.log('✅ Updated subgraph.yaml with startBlock:', startBlock);
console.log('✅ Updated subgraph.yaml with graft block:', graftBlock);

// Run deployment
try {
  console.log('\n🔨 Running deployment...');
  execSync('npm run deploy-scrubvault', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('\n🎉 Deployment completed successfully!');
  console.log(`📊 Subgraph is indexing from block ${startBlock}`);
} catch (error) {
  console.error('❌ Deployment failed:', (error as Error).message);
  process.exit(1);
}


