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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const vj_api_stack_1 = require("../lib/stacks/vj-api-stack");
const vj_storage_stack_1 = require("../lib/stacks/vj-storage-stack");
const vj_static_hosting_stack_1 = require("../lib/stacks/vj-static-hosting-stack");
const vj_monitoring_stack_1 = require("../lib/stacks/vj-monitoring-stack");
const vj_config_stack_1 = require("../lib/stacks/vj-config-stack");
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
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(storageStack);
monitoringStack.addDependency(hostingStack);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLHVDQUFxQztBQUNyQyxpREFBbUM7QUFDbkMsNkRBQXdEO0FBQ3hELHFFQUFnRTtBQUNoRSxtRkFBNkU7QUFDN0UsMkVBQXNFO0FBQ3RFLG1FQUE4RDtBQUU5RCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQiw4Q0FBOEM7QUFDOUMsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYscUNBQXFDO0FBQ3JDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQztBQVN2RCxNQUFNLFlBQVksR0FBZ0M7SUFDaEQsR0FBRyxFQUFFO1FBQ0gsVUFBVSxFQUFFLGVBQWU7UUFDM0IsVUFBVSxFQUFFLEtBQUs7UUFDakIsZ0JBQWdCLEVBQUUsS0FBSztRQUN2QixZQUFZLEVBQUUsS0FBSztLQUNwQjtJQUNELE9BQU8sRUFBRTtRQUNQLFVBQVUsRUFBRSxtQkFBbUI7UUFDL0IsVUFBVSxFQUFFLElBQUk7UUFDaEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixZQUFZLEVBQUUsSUFBSTtLQUNuQjtJQUNELElBQUksRUFBRTtRQUNKLFVBQVUsRUFBRSxXQUFXO1FBQ3ZCLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsWUFBWSxFQUFFLElBQUk7S0FDbkI7Q0FDRixDQUFDO0FBRUYsTUFBTSxNQUFNLEdBQWdCLFlBQVksQ0FBQyxLQUFLLENBQUMsSUFBSTtJQUNqRCxVQUFVLEVBQUUsZ0JBQWdCO0lBQzVCLFVBQVUsRUFBRSxLQUFLO0lBQ2pCLGdCQUFnQixFQUFFLEtBQUs7SUFDdkIsWUFBWSxFQUFFLEtBQUs7Q0FDcEIsQ0FBQztBQUVGLHFCQUFxQjtBQUNyQixNQUFNLFVBQVUsR0FBbUI7SUFDakMsR0FBRztJQUNILElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxnQkFBZ0I7UUFDekIsS0FBSyxFQUFFLEtBQUs7UUFDWixLQUFLLEVBQUUsU0FBUztLQUNqQjtDQUNGLENBQUM7QUFFRiwrQ0FBK0M7QUFDL0MsTUFBTSxXQUFXLEdBQUcsSUFBSSwrQkFBYSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsS0FBSyxFQUFFLEVBQUU7SUFDbkUsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07Q0FDUCxDQUFDLENBQUM7QUFFSCxnQkFBZ0I7QUFDaEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxpQ0FBYyxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsS0FBSyxFQUFFLEVBQUU7SUFDdEUsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixXQUFXLEVBQUUsV0FBVyxDQUFDLFdBQVc7Q0FDckMsQ0FBQyxDQUFDO0FBRUgsWUFBWTtBQUNaLE1BQU0sUUFBUSxHQUFHLElBQUkseUJBQVUsQ0FBQyxHQUFHLEVBQUUsY0FBYyxLQUFLLEVBQUUsRUFBRTtJQUMxRCxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtJQUNOLFlBQVksRUFBRSxZQUFZLENBQUMsWUFBWTtJQUN2QyxXQUFXLEVBQUUsWUFBWSxDQUFDLFdBQVc7SUFDckMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxXQUFXO0NBQ3JDLENBQUMsQ0FBQztBQUVILHVCQUF1QjtBQUN2QixNQUFNLFlBQVksR0FBRyxJQUFJLDhDQUFvQixDQUFDLEdBQUcsRUFBRSx3QkFBd0IsS0FBSyxFQUFFLEVBQUU7SUFDbEYsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU07SUFDdkIsWUFBWSxFQUFFLFFBQVEsQ0FBQyxZQUFZO0NBQ3BDLENBQUMsQ0FBQztBQUVILGlEQUFpRDtBQUNqRCxNQUFNLGVBQWUsR0FBRyxJQUFJLHVDQUFpQixDQUFDLEdBQUcsRUFBRSxxQkFBcUIsS0FBSyxFQUFFLEVBQUU7SUFDL0UsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixRQUFRO0lBQ1IsWUFBWTtJQUNaLFlBQVk7Q0FDYixDQUFDLENBQUM7QUFFSCxxQkFBcUI7QUFDckIsWUFBWSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN4QyxRQUFRLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLFlBQVksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDckMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN4QyxlQUFlLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVDLGVBQWUsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVmpBcGlTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotYXBpLXN0YWNrJztcbmltcG9ydCB7IFZqU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1zdG9yYWdlLXN0YWNrJztcbmltcG9ydCB7IFZqU3RhdGljSG9zdGluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1zdGF0aWMtaG9zdGluZy1zdGFjayc7XG5pbXBvcnQgeyBWak1vbml0b3JpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotbW9uaXRvcmluZy1zdGFjayc7XG5pbXBvcnQgeyBWakNvbmZpZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1jb25maWctc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgZW52aXJvbm1lbnQgZnJvbSBjb250ZXh0IG9yIHVzZSBkZWZhdWx0XG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnLFxufTtcblxuLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgY29uZmlndXJhdGlvblxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8ICdkZXYnO1xuXG5pbnRlcmZhY2UgU3RhZ2VDb25maWcge1xuICBkb21haW5OYW1lOiBzdHJpbmc7XG4gIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbn1cblxuY29uc3Qgc3RhZ2VDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBTdGFnZUNvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIGRvbWFpbk5hbWU6ICdkZXYudjF6M3IuYXBwJyxcbiAgICBlbmFibGVBdXRoOiBmYWxzZSxcbiAgICBlbmFibGVDbG91ZEZyb250OiBmYWxzZSxcbiAgICBlbmFibGVCYWNrdXA6IGZhbHNlLFxuICB9LFxuICBzdGFnaW5nOiB7XG4gICAgZG9tYWluTmFtZTogJ3N0YWdpbmcudjF6M3IuYXBwJyxcbiAgICBlbmFibGVBdXRoOiB0cnVlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IHRydWUsXG4gICAgZW5hYmxlQmFja3VwOiB0cnVlLFxuICB9LFxuICBwcm9kOiB7XG4gICAgZG9tYWluTmFtZTogJ3YxejNyLmFwcCcsXG4gICAgZW5hYmxlQXV0aDogdHJ1ZSxcbiAgICBlbmFibGVDbG91ZEZyb250OiB0cnVlLFxuICAgIGVuYWJsZUJhY2t1cDogdHJ1ZSxcbiAgfSxcbn07XG5cbmNvbnN0IGNvbmZpZzogU3RhZ2VDb25maWcgPSBzdGFnZUNvbmZpZ3Nbc3RhZ2VdIHx8IHtcbiAgZG9tYWluTmFtZTogJ2xvY2FsaG9zdDozMDAwJyxcbiAgZW5hYmxlQXV0aDogZmFsc2UsXG4gIGVuYWJsZUNsb3VkRnJvbnQ6IGZhbHNlLFxuICBlbmFibGVCYWNrdXA6IGZhbHNlLFxufTtcblxuLy8gU2hhcmVkIHN0YWNrIHByb3BzXG5jb25zdCBzdGFja1Byb3BzOiBjZGsuU3RhY2tQcm9wcyA9IHtcbiAgZW52LFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ1ZKLUFwcGxpY2F0aW9uJyxcbiAgICBTdGFnZTogc3RhZ2UsXG4gICAgT3duZXI6ICd2ai10ZWFtJyxcbiAgfSxcbn07XG5cbi8vIENvbmZpZ3VyYXRpb24gU3RhY2sgKG11c3QgYmUgZGVwbG95ZWQgZmlyc3QpXG5jb25zdCBjb25maWdTdGFjayA9IG5ldyBWakNvbmZpZ1N0YWNrKGFwcCwgYFZqQ29uZmlnU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG59KTtcblxuLy8gU3RvcmFnZSBTdGFja1xuY29uc3Qgc3RvcmFnZVN0YWNrID0gbmV3IFZqU3RvcmFnZVN0YWNrKGFwcCwgYFZqU3RvcmFnZVN0YWNrLSR7c3RhZ2V9YCwge1xuICAuLi5zdGFja1Byb3BzLFxuICBzdGFnZSxcbiAgY29uZmlnLFxuICBjb25maWdUYWJsZTogY29uZmlnU3RhY2suY29uZmlnVGFibGUsXG59KTtcblxuLy8gQVBJIFN0YWNrXG5jb25zdCBhcGlTdGFjayA9IG5ldyBWakFwaVN0YWNrKGFwcCwgYFZqQXBpU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIHNlc3Npb25UYWJsZTogc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZSxcbiAgcHJlc2V0VGFibGU6IHN0b3JhZ2VTdGFjay5wcmVzZXRUYWJsZSxcbiAgY29uZmlnVGFibGU6IGNvbmZpZ1N0YWNrLmNvbmZpZ1RhYmxlLFxufSk7XG5cbi8vIFN0YXRpYyBIb3N0aW5nIFN0YWNrXG5jb25zdCBob3N0aW5nU3RhY2sgPSBuZXcgVmpTdGF0aWNIb3N0aW5nU3RhY2soYXBwLCBgVmpTdGF0aWNIb3N0aW5nU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGFwaVVybDogYXBpU3RhY2suYXBpVXJsLFxuICB3ZWJzb2NrZXRVcmw6IGFwaVN0YWNrLndlYnNvY2tldFVybCxcbn0pO1xuXG4vLyBNb25pdG9yaW5nIFN0YWNrIChkZXBlbmRzIG9uIGFsbCBvdGhlciBzdGFja3MpXG5jb25zdCBtb25pdG9yaW5nU3RhY2sgPSBuZXcgVmpNb25pdG9yaW5nU3RhY2soYXBwLCBgVmpNb25pdG9yaW5nU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGFwaVN0YWNrLFxuICBzdG9yYWdlU3RhY2ssXG4gIGhvc3RpbmdTdGFjayxcbn0pO1xuXG4vLyBTdGFjayBkZXBlbmRlbmNpZXNcbnN0b3JhZ2VTdGFjay5hZGREZXBlbmRlbmN5KGNvbmZpZ1N0YWNrKTtcbmFwaVN0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcbmhvc3RpbmdTdGFjay5hZGREZXBlbmRlbmN5KGFwaVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGFwaVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KHN0b3JhZ2VTdGFjayk7XG5tb25pdG9yaW5nU3RhY2suYWRkRGVwZW5kZW5jeShob3N0aW5nU3RhY2spOyJdfQ==