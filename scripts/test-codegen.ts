#!/usr/bin/env ts-node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Temporary values for testing
const testStartBlock = '19087544';
const testGraftBlock = '19087543';

console.log('🧪 Preparing subgraph for testing...');

// Read subgraph.yaml
const subgraphPath = path.join(__dirname, '..', 'subgraph.yaml');
let subgraphContent = fs.readFileSync(subgraphPath, 'utf8');

// Replace template variables with test values
subgraphContent = subgraphContent.replace(/\{\{\s*scrubvault_start_block\s*\}\}/g, testStartBlock);
subgraphContent = subgraphContent.replace(/\{\{\s*graft_block\s*\}\}/g, testGraftBlock);

// Write temporary file
const tempPath = path.join(__dirname, '..', 'subgraph.test.yaml');
fs.writeFileSync(tempPath, subgraphContent, 'utf8');

// Run codegen on temp file
try {
  execSync('graph codegen subgraph.test.yaml', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Code generation complete');
  
  // Run tests
  execSync('graph test', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  console.log('✅ Tests complete');
} catch (error) {
  console.error('❌ Failed:', (error as Error).message);
  process.exit(1);
} finally {
  // Cleanup temp file
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
  }
}
