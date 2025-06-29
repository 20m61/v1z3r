#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VjApiStack } from '../lib/stacks/vj-api-stack';
import { VjStorageStack } from '../lib/stacks/vj-storage-stack';
import { VjStaticHostingStack } from '../lib/stacks/vj-static-hosting-stack';
import { VjMonitoringStack } from '../lib/stacks/vj-monitoring-stack';
import { VjConfigStack } from '../lib/stacks/vj-config-stack';

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
    domainName: 'dev.v1z3r.app',
    enableAuth: false,
    enableCloudFront: false,
    enableBackup: false,
  },
  staging: {
    domainName: 'staging.v1z3r.app',
    enableAuth: true,
    enableCloudFront: true,
    enableBackup: true,
  },
  prod: {
    domainName: 'v1z3r.app',
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

// Configuration Stack (must be deployed first)
const configStack = new VjConfigStack(app, `VjConfigStack-${stage}`, {
  ...stackProps,
  stage,
  config,
});

// Storage Stack
const storageStack = new VjStorageStack(app, `VjStorageStack-${stage}`, {
  ...stackProps,
  stage,
  config,
  configTable: configStack.configTable,
});

// API Stack
const apiStack = new VjApiStack(app, `VjApiStack-${stage}`, {
  ...stackProps,
  stage,
  config,
  sessionTable: storageStack.sessionTable,
  presetTable: storageStack.presetTable,
  configTable: configStack.configTable,
});

// Static Hosting Stack
const hostingStack = new VjStaticHostingStack(app, `VjStaticHostingStack-${stage}`, {
  ...stackProps,
  stage,
  config,
  apiUrl: apiStack.apiUrl,
  websocketUrl: apiStack.websocketUrl,
});

// Monitoring Stack (depends on all other stacks)
const monitoringStack = new VjMonitoringStack(app, `VjMonitoringStack-${stage}`, {
  ...stackProps,
  stage,
  config,
  apiStack,
  storageStack,
  hostingStack,
});

// Stack dependencies
storageStack.addDependency(configStack);
apiStack.addDependency(storageStack);
hostingStack.addDependency(apiStack);
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(storageStack);
monitoringStack.addDependency(hostingStack);