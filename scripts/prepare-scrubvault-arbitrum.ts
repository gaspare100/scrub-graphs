#!/usr/bin/env ts-node

import * as fs from "fs";
import * as path from "path";

type DeploymentArtifact = {
  contracts?: Record<string, string>;
  details?: Record<string, { proxy?: string; startBlock?: number | string }>;
};

type ArbitrumConfig = {
  network?: string;
  subgraph_name?: string;
  deposit_vault_address?: string;
  deposit_vault_start_block?: string | number;
  scrubpoint_address?: string;
  scrubpoint_start_block?: string | number;
};

const rootDir = path.join(__dirname, "..");
const configPath = path.join(rootDir, "config", "arbitrum.json");
const templatePath = path.join(rootDir, "subgraph.scrubvault-arbitrum.template.yaml");
const outputPath = path.join(rootDir, "generated", "subgraph.scrubvault-arbitrum.yaml");
const fallbackDeploymentPath = process.env.SCRUBVAULT_DEPLOYMENT_FILE || path.join(
  rootDir,
  "..",
  "scrubvault",
  "packages",
  "contracts",
  "deployments",
  "arbitrum-latest.json",
);

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function toAddress(label: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return value;
}

function toStartBlock(label: string, value: string | number | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized || Number.isNaN(Number(normalized)) || Number(normalized) <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return normalized;
}

function resolveArbitrumConfig(): Required<ArbitrumConfig> {
  const fileConfig = readJson<ArbitrumConfig>(configPath) || {};
  const deploymentArtifact = readJson<DeploymentArtifact>(fallbackDeploymentPath) || {};

  const depositVaultAddress = fileConfig.deposit_vault_address
    || deploymentArtifact.details?.DepositVault?.proxy
    || deploymentArtifact.contracts?.DepositVault;
  const depositVaultStartBlock = fileConfig.deposit_vault_start_block
    || deploymentArtifact.details?.DepositVault?.startBlock;
  const scrubPointAddress = fileConfig.scrubpoint_address
    || deploymentArtifact.details?.ScrubPoint?.proxy
    || deploymentArtifact.contracts?.ScrubPoint;
  const scrubPointStartBlock = fileConfig.scrubpoint_start_block
    || deploymentArtifact.details?.ScrubPoint?.startBlock;

  return {
    network: fileConfig.network || "arbitrum-one",
    subgraph_name: fileConfig.subgraph_name || "scrubvault-arbitrum",
    deposit_vault_address: toAddress("deposit_vault_address", depositVaultAddress),
    deposit_vault_start_block: toStartBlock("deposit_vault_start_block", depositVaultStartBlock),
    scrubpoint_address: toAddress("scrubpoint_address", scrubPointAddress),
    scrubpoint_start_block: toStartBlock("scrubpoint_start_block", scrubPointStartBlock),
  };
}

function main() {
  const resolvedConfig = resolveArbitrumConfig();
  const template = fs.readFileSync(templatePath, "utf8");

  const rendered = template
    .replace(/\{\{\s*deposit_vault_address\s*\}\}/g, resolvedConfig.deposit_vault_address)
    .replace(/\{\{\s*deposit_vault_start_block\s*\}\}/g, String(resolvedConfig.deposit_vault_start_block))
    .replace(/\{\{\s*scrubpoint_address\s*\}\}/g, resolvedConfig.scrubpoint_address)
    .replace(/\{\{\s*scrubpoint_start_block\s*\}\}/g, String(resolvedConfig.scrubpoint_start_block));

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, rendered, "utf8");

  console.log("Prepared Arbitrum subgraph manifest");
  console.log(`  config: ${configPath}`);
  console.log(`  output: ${outputPath}`);
  console.log(`  DepositVault: ${resolvedConfig.deposit_vault_address} @ ${resolvedConfig.deposit_vault_start_block}`);
  console.log(`  ScrubPoint: ${resolvedConfig.scrubpoint_address} @ ${resolvedConfig.scrubpoint_start_block}`);
}

main();