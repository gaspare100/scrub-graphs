#!/usr/bin/env ts-node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get arguments: startBlock and optional baseIpfsHash for grafting
const startBlock = process.argv[2];
const baseIpfsHash = process.argv[3];

if (!startBlock || isNaN(Number(startBlock))) {
  console.error('❌ Error: Please provide a valid start block number');
  console.error('Usage: npm run deploy-grafting <startBlock> [baseIpfsHash]');
  console.error('Example (separate subgraph): npm run deploy-grafting 19087544');
  console.error('Example (with grafting): npm run deploy-grafting 19087544 QmXXXXX...');
  process.exit(1);
}

const subgraphPath = path.join(__dirname, '..', 'subgraph.yaml');

console.log('🚀 Starting deployment...');
console.log(`📦 Start Block: ${startBlock}`);
if (baseIpfsHash) {
  console.log(`🔗 Grafting from base: ${baseIpfsHash}`);
  console.log(`⚡ This will copy all data up to block ${startBlock} and continue from there`);
}

// Read subgraph.yaml
let subgraphYaml: string;
try {
  subgraphYaml = fs.readFileSync(subgraphPath, 'utf8');
} catch (error) {
  console.error('❌ Error reading subgraph.yaml:', (error as Error).message);
  process.exit(1);
}

// Update startBlock for ScrubDepositVault data source
// Split into lines, find ScrubDepositVault section, update startBlock
const lines = subgraphYaml.split('\n');
const scrubVaultIdx = lines.findIndex(l => l.includes('name: ScrubDepositVault'));

if (scrubVaultIdx === -1) {
  console.error('❌ Error: Could not find "name: ScrubDepositVault" in subgraph.yaml');
  process.exit(1);
}

// Find the startBlock line after ScrubDepositVault (should be within next 10 lines)
let startBlockIdx = -1;
for (let i = scrubVaultIdx + 1; i < Math.min(scrubVaultIdx + 15, lines.length); i++) {
  if (lines[i].includes('startBlock:')) {
    startBlockIdx = i;
    break;
  }
}

if (startBlockIdx === -1) {
  console.error('❌ Error: Could not find startBlock after ScrubDepositVault');
  process.exit(1);
}

// Replace the startBlock value
lines[startBlockIdx] = lines[startBlockIdx].replace(/startBlock:\s*\d+/, `startBlock: ${startBlock}`);
let updatedYaml = lines.join('\n');

// Add grafting configuration if baseIpfsHash provided
if (baseIpfsHash) {
  // Remove existing graft config if present
  updatedYaml = updatedYaml.replace(/features:\s*\n\s*-\s*grafting\s*\n/, '');
  updatedYaml = updatedYaml.replace(/graft:\s*\n\s*base:.*\n\s*block:.*\n/, '');
  
  // Add grafting config at the top after specVersion
  const graftConfig = `features:
  - grafting
graft:
  base: ${baseIpfsHash}
  block: ${startBlock}
`;
  
  updatedYaml = updatedYaml.replace(
    /(specVersion: 0\.0\.4\ndescription: ScrubInvest\n)/,
    `$1${graftConfig}`
  );
  
  console.log('✅ Added grafting configuration to subgraph.yaml');
} else {
  // Remove grafting config if it exists (deploying separate subgraph)
  updatedYaml = updatedYaml.replace(/features:\s*\n\s*-\s*grafting\s*\n/, '');
  updatedYaml = updatedYaml.replace(/graft:\s*\n\s*base:.*\n\s*block:.*\n/, '');
  console.log('ℹ️  Deploying as separate "scrubvault" subgraph (no grafting)');
}

// Write updated subgraph.yaml
try {
  fs.writeFileSync(subgraphPath, updatedYaml, 'utf8');
  console.log('✅ Updated subgraph.yaml with startBlock:', startBlock);
} catch (error) {
  console.error('❌ Error writing subgraph.yaml:', (error as Error).message);
  process.exit(1);
}

// Run deployment commands
interface Command {
  name: string;
  cmd: string;
}

const commands: Command[] = [
  { name: 'Codegen', cmd: 'npm run codegen' },
  { name: 'Build', cmd: 'npm run build' },
  { name: 'Deploy', cmd: 'npm run deploy-scrubvault' }
];

for (const { name, cmd } of commands) {
  try {
    console.log(`\n🔨 Running ${name}...`);
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log(`✅ ${name} completed`);
  } catch (error) {
    console.error(`❌ ${name} failed:`, (error as Error).message);
    process.exit(1);
  }
}

console.log('\n🎉 Deployment completed successfully!');
console.log(`📊 Subgraph will ${baseIpfsHash ? 'graft from base and continue' : 'start indexing'} from block ${startBlock}`);
