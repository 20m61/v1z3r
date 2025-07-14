#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const vj_api_stack_1 = require("../lib/stacks/vj-api-stack");
const vj_storage_stack_1 = require("../lib/stacks/vj-storage-stack");
const vj_static_hosting_stack_1 = require("../lib/stacks/vj-static-hosting-stack");
const vj_monitoring_stack_1 = require("../lib/stacks/vj-monitoring-stack");
const vj_config_stack_1 = require("../lib/stacks/vj-config-stack");
const vj_cdn_stack_1 = require("../lib/stacks/vj-cdn-stack");
const vj_xray_stack_1 = require("../lib/stacks/vj-xray-stack");
const vj_logging_stack_1 = require("../lib/stacks/vj-logging-stack");
const app = new cdk.App();
// Get environment from context or use default
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
// Environment-specific configuration
const stage = app.node.tryGetContext('stage') || 'dev';
const stageConfigs = {
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
const config = stageConfigs[stage] || {
    domainName: 'localhost:3000',
    enableAuth: false,
    enableCloudFront: false,
    enableBackup: false,
};
// Shared stack props
const stackProps = {
    env,
    tags: {
        Project: 'VJ-Application',
        Stage: stage,
        Owner: 'vj-team',
    },
};
// Configuration Stack (must be deployed first)
const configStack = new vj_config_stack_1.VjConfigStack(app, `VjConfigStack-${stage}`, {
    ...stackProps,
    stage,
    config,
});
// Storage Stack
const storageStack = new vj_storage_stack_1.VjStorageStack(app, `VjStorageStack-${stage}`, {
    ...stackProps,
    stage,
    config,
    configTable: configStack.configTable,
});
// API Stack
const apiStack = new vj_api_stack_1.VjApiStack(app, `VjApiStack-${stage}`, {
    ...stackProps,
    stage,
    config,
    sessionTable: storageStack.sessionTable,
    presetTable: storageStack.presetTable,
    configTable: configStack.configTable,
});
// Static Hosting Stack
const hostingStack = new vj_static_hosting_stack_1.VjStaticHostingStack(app, `VjStaticHostingStack-${stage}`, {
    ...stackProps,
    stage,
    config,
    apiUrl: apiStack.apiUrl,
    websocketUrl: apiStack.websocketUrl,
});
// CDN Stack (optional based on config)
let cdnStack;
if (config.enableCloudFront) {
    cdnStack = new vj_cdn_stack_1.VjCdnStack(app, `VjCdnStack-${stage}`, {
        ...stackProps,
        stage: stage,
        siteBucket: hostingStack.siteBucket,
        domainName: config.domainName,
    });
}
// X-Ray Stack (optional based on stage)
let xrayStack;
if (stage !== 'dev') {
    xrayStack = new vj_xray_stack_1.VjXRayStack(app, `VjXRayStack-${stage}`, {
        ...stackProps,
        stage,
        lambdaFunctions: [apiStack.presetFunction, apiStack.connectionFunction]
    });
}
// Logging Stack (for production monitoring)
let loggingStack;
if (stage === 'prod' || stage === 'staging') {
    loggingStack = new vj_logging_stack_1.VjLoggingStack(app, `VjLoggingStack-${stage}`, {
        ...stackProps,
        stage,
        lambdaFunctions: [apiStack.presetFunction, apiStack.connectionFunction]
    });
}
// Monitoring Stack (depends on all other stacks)
const monitoringStack = new vj_monitoring_stack_1.VjMonitoringStack(app, `VjMonitoringStack-${stage}`, {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw2REFBd0Q7QUFDeEQscUVBQWdFO0FBQ2hFLG1GQUE2RTtBQUM3RSwyRUFBc0U7QUFDdEUsbUVBQThEO0FBQzlELDZEQUF3RDtBQUN4RCwrREFBMEQ7QUFDMUQscUVBQWdFO0FBRWhFLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLDhDQUE4QztBQUM5QyxNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0NBQ3RELENBQUM7QUFFRixxQ0FBcUM7QUFDckMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDO0FBU3ZELE1BQU0sWUFBWSxHQUFnQztJQUNoRCxHQUFHLEVBQUU7UUFDSCxVQUFVLEVBQUUsZ0JBQWdCO1FBQzVCLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLGdCQUFnQixFQUFFLEtBQUs7UUFDdkIsWUFBWSxFQUFFLEtBQUs7S0FDcEI7SUFDRCxPQUFPLEVBQUU7UUFDUCxVQUFVLEVBQUUseUJBQXlCO1FBQ3JDLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsWUFBWSxFQUFFLEtBQUs7S0FDcEI7SUFDRCxJQUFJLEVBQUU7UUFDSixVQUFVLEVBQUUsaUJBQWlCO1FBQzdCLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsWUFBWSxFQUFFLElBQUk7S0FDbkI7Q0FDRixDQUFDO0FBRUYsTUFBTSxNQUFN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RUFBRTtJQUMvRSxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtJQUNOLFFBQVE7SUFDUixZQUFZO0lBQ1osWUFBWTtDQUNiLENBQUMsQ0FBQztBQUVILHFCQUFxQjtBQUNyQixZQUFZLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3hDLFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDckMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUVyQyxJQUFJLFFBQVEsRUFBRTtJQUNaLFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7Q0FDdEM7QUFFRCxJQUFJLFNBQVMsRUFBRTtJQUNiLFNBQVMsQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7Q0FDbkM7QUFFRCxJQUFJLFlBQVksRUFBRTtJQUNoQixZQUFZLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0NBQ3RDO0FBRUQsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN4QyxlQUFlLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVDLGVBQWUsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFNUMsSUFBSSxRQUFRLEVBQUU7SUFDWixlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0NBQ3pDO0FBQ0QsSUFBSSxTQUFTLEVBQUU7SUFDYixlQUFlLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0NBQzFDO0FBQ0QsSUFBSSxZQUFZLEVBQUU7SUFDaEIsZUFBZSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztDQUM3QyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBWakFwaVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1hcGktc3RhY2snO1xuaW1wb3J0IHsgVmpTdG9yYWdlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLXN0b3JhZ2Utc3RhY2snO1xuaW1wb3J0IHsgVmpTdGF0aWNIb3N0aW5nU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLXN0YXRpYy1ob3N0aW5nLXN0YWNrJztcbmltcG9ydCB7IFZqTW9uaXRvcmluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1tb25pdG9yaW5nLXN0YWNrJztcbmltcG9ydCB7IFZqQ29uZmlnU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLWNvbmZpZy1zdGFjayc7XG5pbXBvcnQgeyBWakNkblN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1jZG4tc3RhY2snO1xuaW1wb3J0IHsgVmpYUmF5U3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLXhyYXktc3RhY2snO1xuaW1wb3J0IHsgVmpMb2dnaW5nU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLWxvZ2dpbmctc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgZW52aXJvbm1lbnQgZnJvbSBjb250ZXh0IG9yIHVzZSBkZWZhdWx0XG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnLFxufTtcblxuLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgY29uZmlndXJhdGlvblxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8ICdkZXYnO1xuXG5pbnRlcmZhY2UgU3RhZ2VDb25maWcge1xuICBkb21haW5OYW1lOiBzdHJpbmc7XG4gIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbn1cblxuY29uc3Qgc3RhZ2VDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBTdGFnZUNvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIGRvbWFpbk5hbWU6ICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgZW5hYmxlQXV0aDogZmFsc2UsXG4gICAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gICAgZW5hYmxlQmFja3VwOiBmYWxzZSxcbiAgfSxcbiAgc3RhZ2luZzoge1xuICAgIGRvbWFpbk5hbWU6ICdzdGFnaW5nLnYxejNyLnNjNHBlLm5ldCcsXG4gICAgZW5hYmxlQXV0aDogdHJ1ZSxcbiAgICBlbmFibGVDbG91ZEZyb250OiB0cnVlLFxuICAgIGVuYWJsZUJhY2t1cDogZmFsc2UsXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBkb21haW5OYW1lOiAndjF6M3Iuc2M0cGUubmV0JyxcbiAgICBlbmFibGVBdXRoOiB0cnVlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IHRydWUsXG4gICAgZW5hYmxlQmFja3VwOiB0cnVlLFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnOiBTdGFnZUNvbmZpZyA9IHN0YWdlQ29uZmlnc1tzdGFnZV0gfHwge1xuICBkb21haW5OYW1lOiAnbG9jYWxob3N0OjMwMDAnLFxuICBlbmFibGVBdXRoOiBmYWxzZSxcbiAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gIGVuYWJsZUJhY2t1cDogZmFsc2UsXG59O1xuXG4vLyBTaGFyZWQgc3RhY2sgcHJvcHNcbmNvbnN0IHN0YWNrUHJvcHM6IGNkay5TdGFja1Byb3BzID0ge1xuICBlbnYsXG4gIHRhZ3M6IHtcbiAgICBQcm9qZWN0OiAnVkotQXBwbGljYXRpb24nLFxuICAgIFN0YWdlOiBzdGFnZSxcbiAgICBPd25lcjogJ3ZqLXRlYW0nLFxuICB9LFxufTtcblxuLy8gQ29uZmlndXJhdGlvbiBTdGFjayAobXVzdCBiZSBkZXBsb3llZCBmaXJzdClcbmNvbnN0IGNvbmZpZ1N0YWNrID0gbmV3IFZqQ29uZmlnU3RhY2soYXBwLCBgVmpDb25maWdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbn0pO1xuXG4vLyBTdG9yYWdlIFN0YWNrXG5jb25zdCBzdG9yYWdlU3RhY2sgPSBuZXcgVmpTdG9yYWdlU3RhY2soYXBwLCBgVmpTdG9yYWdlU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGNvbmZpZ1RhYmxlOiBjb25maWdTdGFjay5jb25maWdUYWJsZSxcbn0pO1xuXG4vLyBBUEkgU3RhY2tcbmNvbnN0IGFwaVN0YWNrID0gbmV3IFZqQXBpU3RhY2soYXBwLCBgVmpBcGlTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgc2Vzc2lvblRhYmxlOiBzdG9yYWdlU3RhY2suc2Vzc2lvblRhYmxlLFxuICBwcmVzZXRUYWJsZTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLFxuICBjb25maWdUYWJsZTogY29uZmlnU3RhY2suY29uZmlnVGFibGUsXG59KTtcblxuLy8gU3RhdGljIEhvc3RpbmcgU3RhY2tcbmNvbnN0IGhvc3RpbmdTdGFjayA9IG5ldyBWalN0YXRpY0hvc3RpbmdTdGFjayhhcHAsIGBWalN0YXRpY0hvc3RpbmdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgYXBpVXJsOiBhcGlTdGFjay5hcGlVcmwsXG4gIHdlYnNvY2tldFVybDogYXBpU3RhY2sud2Vic29ja2V0VXJsLFxufSk7XG5cbi8vIENETiBTdGFjayAob3B0aW9uYWwgYmFzZWQgb24gY29uZmlnKVxubGV0IGNkblN0YWNrOiBWakNkblN0YWNrIHwgdW5kZWZpbmVkO1xuaWYgKGNvbmZpZy5lbmFibGVDbG91ZEZyb250KSB7XG4gIGNkblN0YWNrID0gbmV3IFZqQ2RuU3RhY2soYXBwLCBgVmpDZG5TdGFjay0ke3N0YWdlfWAsIHtcbiAgICAuLi5zdGFja1Byb3BzLFxuICAgIHN0YWdlOiBzdGFnZSBhcyAnZGV2JyB8ICdzdGFnaW5nJyB8ICdwcm9kJyxcbiAgICBzaXRlQnVja2V0OiBob3N0aW5nU3RhY2suc2l0ZUJ1Y2tldCxcbiAgICBkb21haW5OYW1lOiBjb25maWcuZG9tYWluTmFtZSxcbiAgfSk7XG59XG5cbi8vIFgtUmF5IFN0YWNrIChvcHRpb25hbCBiYXNlZCBvbiBzdGFnZSlcbmxldCB4cmF5U3RhY2s6IFZqWFJheVN0YWNrIHwgdW5kZWZpbmVkO1xuaWYgKHN0YWdlICE9PSAnZGV2Jykge1xuICB4cmF5U3RhY2sgPSBuZXcgVmpYUmF5U3RhY2soYXBwLCBgVmpYUmF5U3RhY2stJHtzdGFnZX1gLCB7XG4gICAgLi4uc3RhY2tQcm9wcyxcbiAgICBzdGFnZSxcbiAgICBsYW1iZGFGdW5jdGlvbnM6IFthcGlTdGFjay5wcmVzZXRGdW5jdGlvbiwgYXBpU3RhY2suY29ubmVjdGlvbkZ1bmN0aW9uXVxuICB9KTtcbn1cblxuLy8gTG9nZ2luZyBTdGFjayAoZm9yIHByb2R1Y3Rpb24gbW9uaXRvcmluZylcbmxldCBsb2dnaW5nU3RhY2s6IFZqTG9nZ2luZ1N0YWNrIHwgdW5kZWZpbmVkO1xuaWYgKHN0YWdlID09PSAncHJvZCcgfHwgc3RhZ2UgPT09ICdzdGFnaW5nJykge1xuICBsb2dnaW5nU3RhY2sgPSBuZXcgVmpMb2dnaW5nU3RhY2soYXBwLCBgVmpMb2dnaW5nU3RhY2stJHtzdGFnZX1gLCB7XG4gICAgLi4uc3RhY2tQcm9wcyxcbiAgICBzdGFnZSxcbiAgICBsYW1iZGFGdW5jdGlvbnM6IFthcGlTdGFjay5wcmVzZXRGdW5jdGlvbiwgYXBpU3RhY2suY29ubmVjdGlvbkZ1bmN0aW9uXVxuICB9KTtcbn1cblxuLy8gTW9uaXRvcmluZyBTdGFjayAoZGVwZW5kcyBvbiBhbGwgb3RoZXIgc3RhY2tzKVxuY29uc3QgbW9uaXRvcmluZ1N0YWNrID0gbmV3IFZqTW9uaXRvcmluZ1N0YWNrKGFwcCwgYFZqTW9uaXRvcmluZ1N0YWNrLSR7c3RhZ2V9YCwge1xuICAuLi5zdGFja1Byb3BzLFxuICBzdGFnZSxcbiAgY29uZmlnLFxuICBhcGlTdGFjayxcbiAgc3RvcmFnZVN0YWNrLFxuICBob3N0aW5nU3RhY2ssXG59KTtcblxuLy8gU3RhY2sgZGVwZW5kZW5jaWVzXG5zdG9yYWdlU3RhY2suYWRkRGVwZW5kZW5jeShjb25maWdTdGFjayk7XG5hcGlTdGFjay5hZGREZXBlbmRlbmN5KHN0b3JhZ2VTdGFjayk7XG5ob3N0aW5nU3RhY2suYWRkRGVwZW5kZW5jeShhcGlTdGFjayk7XG5cbmlmIChjZG5TdGFjaykge1xuICBjZG5TdGFjay5hZGREZXBlbmRlbmN5KGhvc3RpbmdTdGFjayk7XG59XG5cbmlmICh4cmF5U3RhY2spIHtcbiAgeHJheVN0YWNrLmFkZERlcGVuZGVuY3koYXBpU3RhY2spO1xufVxuXG5pZiAobG9nZ2luZ1N0YWNrKSB7XG4gIGxvZ2dpbmdTdGFjay5hZGREZXBlbmRlbmN5KGFwaVN0YWNrKTtcbn1cblxubW9uaXRvcmluZ1N0YWNrLmFkZERlcGVuZGVuY3koYXBpU3RhY2spO1xubW9uaXRvcmluZ1N0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGhvc3RpbmdTdGFjayk7XG5cbmlmIChjZG5TdGFjaykge1xuICBtb25pdG9yaW5nU3RhY2suYWRkRGVwZW5kZW5jeShjZG5TdGFjayk7XG59XG5pZiAoeHJheVN0YWNrKSB7XG4gIG1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KHhyYXlTdGFjayk7XG59XG5pZiAobG9nZ2luZ1N0YWNrKSB7XG4gIG1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGxvZ2dpbmdTdGFjayk7XG59Il19