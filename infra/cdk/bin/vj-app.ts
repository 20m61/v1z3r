#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VjUnifiedStack } from '../lib/stacks/vj-unified-stack';

const app = new cdk.App();

// Get environment from context or use default
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

// Environment-specific configuration
const stage = app.node.tryGetContext('stage') || 'dev';

interface StageConfig {
  domainName: string;
  enableAuth: boolean;
  enableCloudFront: boolean;
  enableBackup: boolean;
}

const stageConfigs: Record<string, StageConfig> = {
  dev: {
    domainName: 'v1z3r-dev.sc4pe.net',
    enableAuth: false,
    enableCloudFront: true,
    enableBackup: false,
  },
  staging: {
    domainName: 'staging.v1z3r.sc4pe.net',
    enableAuth: true,
    enableCloudFront: true,
    enableBackup: false,
  },
  prod: {
    domainName: 'v1z3r.sc4pe.net',
    enableAuth: true,
    enableCloudFront: true,
    enableBackup: true,
  },
};

const config: StageConfig = stageConfigs[stage] || {
  domainName: 'localhost:3000',
  enableAuth: false,
  enableCloudFront: false,
  enableBackup: false,
};

// Shared stack props
const stackProps: cdk.StackProps = {
  env,
  tags: {
    Project: 'VJ-Application',
    Stage: stage,
    Owner: 'vj-team',
  },
};

// Unified Stack (all resources in one stack)
const unifiedStack = new VjUnifiedStack(app, `VjUnifiedStack-${stage}`, {
  ...stackProps,
  stage,
  enableAuth: config.enableAuth,
  enableCloudFront: config.enableCloudFront,
  enableBackup: config.enableBackup,
  domainName: config.domainName,
});