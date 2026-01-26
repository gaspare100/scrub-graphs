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

// Update config/kava.json with the new start block
const configPath = path.join(__dirname, '..', 'config', 'kava.json');
const config = {
  scrubvault_start_block: startBlock
};

try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log('✅ Updated config/kava.json with startBlock:', startBlock);
} catch (error) {
  console.error('❌ Error writing config file:', error.message);
  process.exit(1);
}

// Run deployment
try {
  console.log('\n🔨 Running deployment...');
  execSync('npm run deploy-scrubvault', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('\n🎉 Deployment completed successfully!');
  console.log(`📊 Subgraph will start indexing from block ${startBlock}`);
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}

