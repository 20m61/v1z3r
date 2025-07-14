#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VjApiStack } from '../lib/stacks/vj-api-stack';
import { VjStorageStack } from '../lib/stacks/vj-storage-stack';
import { VjStaticHostingStack } from '../lib/stacks/vj-static-hosting-stack';
import { VjMonitoringStack } from '../lib/stacks/vj-monitoring-stack';
import { VjConfigStack } from '../lib/stacks/vj-config-stack';
import { VjCdnStack } from '../lib/stacks/vj-cdn-stack';
import { VjXRayStack } from '../lib/stacks/vj-xray-stack';
import { VjLoggingStack } from '../lib/stacks/vj-logging-stack';
import { VjAuthStack } from '../lib/stacks/vj-auth-stack';

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
    domainName: 'localhost:3000',
    enableAuth: false,
    enableCloudFront: false,
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

// Auth Stack (optional based on config)
let authStack: VjAuthStack | undefined;
if (config.enableAuth) {
  authStack = new VjAuthStack(app, `VjAuthStack-${stage}`, {
    ...stackProps,
    environment: stage as 'dev' | 'staging' | 'prod',
  });
}

// API Stack
const apiStack = new VjApiStack(app, `VjApiStack-${stage}`, {
  ...stackProps,
  stage,
  config,
  sessionTable: storageStack.sessionTable,
  presetTable: storageStack.presetTable,
  configTable: configStack.configTable,
  userPool: authStack?.userPool,
  authorizer: authStack?.authorizer,
});

// Static Hosting Stack
const hostingStack = new VjStaticHostingStack(app, `VjStaticHostingStack-${stage}`, {
  ...stackProps,
  stage,
  config,
  apiUrl: apiStack.apiUrl,
  websocketUrl: apiStack.websocketUrl,
});

// CDN Stack (optional based on config)
let cdnStack: VjCdnStack | undefined;
if (config.enableCloudFront) {
  cdnStack = new VjCdnStack(app, `VjCdnStack-${stage}`, {
    ...stackProps,
    stage: stage as 'dev' | 'staging' | 'prod',
    siteBucket: hostingStack.siteBucket,
    domainName: config.domainName,
  });
}

// X-Ray Stack (optional based on stage)
let xrayStack: VjXRayStack | undefined;
if (stage !== 'dev') {
  xrayStack = new VjXRayStack(app, `VjXRayStack-${stage}`, {
    ...stackProps,
    stage,
    lambdaFunctions: [apiStack.presetFunction, apiStack.connectionFunction]
  });
}

// Logging Stack (for production monitoring)
let loggingStack: VjLoggingStack | undefined;
if (stage === 'prod' || stage === 'staging') {
  loggingStack = new VjLoggingStack(app, `VjLoggingStack-${stage}`, {
    ...stackProps,
    stage,
    lambdaFunctions: [apiStack.presetFunction, apiStack.connectionFunction]
  });
}

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
if (authStack) {
  authStack.addDependency(configStack);
  apiStack.addDependency(authStack);
}
apiStack.addDependency(storageStack);
hostingStack.addDependency(apiStack);

if (cdnStack) {
  cdnStack.addDependency(hostingStack);
}

if (xrayStack) {
  xrayStack.addDependency(apiStack);
}

if (loggingStack) {
  loggingStack.addDependency(apiStack);
}

monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(storageStack);
monitoringStack.addDependency(hostingStack);

if (cdnStack) {
  monitoringStack.addDependency(cdnStack);
}
if (xrayStack) {
  monitoringStack.addDependency(xrayStack);
}
if (loggingStack) {
  monitoringStack.addDependency(loggingStack);
}