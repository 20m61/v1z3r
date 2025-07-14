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
    monitoringStack.addDependency(cdnStack);
}
monitoringStack.addDependency(apiStack);
monitoringStack.addDependency(storageStack);
monitoringStack.addDependency(hostingStack);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw2REFBd0Q7QUFDeEQscUVBQWdFO0FBQ2hFLG1GQUE2RTtBQUM3RSwyRUFBc0U7QUFDdEUsbUVBQThEO0FBQzlELDZEQUF3RDtBQUV4RCxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQiw4Q0FBOEM7QUFDOUMsTUFBTSxHQUFHLEdBQUc7SUFDVixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYscUNBQXFDO0FBQ3JDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssQ0FBQztBQVN2RCxNQUFNLFlBQVksR0FBZ0M7SUFDaEQsR0FBRyxFQUFFO1FBQ0gsVUFBVSxFQUFFLGdCQUFnQjtRQUM1QixVQUFVLEVBQUUsS0FBSztRQUNqQixnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLFlBQVksRUFBRSxLQUFLO0tBQ3BCO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsVUFBVSxFQUFFLHlCQUF5QjtRQUNyQyxVQUFVLEVBQUUsSUFBSTtRQUNoQixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLFlBQVksRUFBRSxLQUFLO0tBQ3BCO0lBQ0QsSUFBSSxFQUFFO1FBQ0osVUFBVSxFQUFFLGlCQUFpQjtRQUM3QixVQUFVLEVBQUUsSUFBSTtRQUNoQixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLFlBQVksRUFBRSxJQUFJO0tBQ25CO0NBQ0YsQ0FBQztBQUVGLE1BQU0sTUFBTSxHQUFnQixZQUFZLENBQUMsS0FBSyxDQUFD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ZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVmpBcGlTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotYXBpLXN0YWNrJztcbmltcG9ydCB7IFZqU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1zdG9yYWdlLXN0YWNrJztcbmltcG9ydCB7IFZqU3RhdGljSG9zdGluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1zdGF0aWMtaG9zdGluZy1zdGFjayc7XG5pbXBvcnQgeyBWak1vbml0b3JpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotbW9uaXRvcmluZy1zdGFjayc7XG5pbXBvcnQgeyBWakNvbmZpZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1jb25maWctc3RhY2snO1xuaW1wb3J0IHsgVmpDZG5TdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotY2RuLXN0YWNrJztcblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKTtcblxuLy8gR2V0IGVudmlyb25tZW50IGZyb20gY29udGV4dCBvciB1c2UgZGVmYXVsdFxuY29uc3QgZW52ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbn07XG5cbi8vIEVudmlyb25tZW50LXNwZWNpZmljIGNvbmZpZ3VyYXRpb25cbmNvbnN0IHN0YWdlID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnc3RhZ2UnKSB8fCAnZGV2JztcblxuaW50ZXJmYWNlIFN0YWdlQ29uZmlnIHtcbiAgZG9tYWluTmFtZTogc3RyaW5nO1xuICBlbmFibGVBdXRoOiBib29sZWFuO1xuICBlbmFibGVDbG91ZEZyb250OiBib29sZWFuO1xuICBlbmFibGVCYWNrdXA6IGJvb2xlYW47XG59XG5cbmNvbnN0IHN0YWdlQ29uZmlnczogUmVjb3JkPHN0cmluZywgU3RhZ2VDb25maWc+ID0ge1xuICBkZXY6IHtcbiAgICBkb21haW5OYW1lOiAnbG9jYWxob3N0OjMwMDAnLFxuICAgIGVuYWJsZUF1dGg6IGZhbHNlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGZhbHNlLFxuICAgIGVuYWJsZUJhY2t1cDogZmFsc2UsXG4gIH0sXG4gIHN0YWdpbmc6IHtcbiAgICBkb21haW5OYW1lOiAnc3RhZ2luZy52MXozci5zYzRwZS5uZXQnLFxuICAgIGVuYWJsZUF1dGg6IHRydWUsXG4gICAgZW5hYmxlQ2xvdWRGcm9udDogdHJ1ZSxcbiAgICBlbmFibGVCYWNrdXA6IGZhbHNlLFxuICB9LFxuICBwcm9kOiB7XG4gICAgZG9tYWluTmFtZTogJ3YxejNyLnNjNHBlLm5ldCcsXG4gICAgZW5hYmxlQXV0aDogdHJ1ZSxcbiAgICBlbmFibGVDbG91ZEZyb250OiB0cnVlLFxuICAgIGVuYWJsZUJhY2t1cDogdHJ1ZSxcbiAgfSxcbn07XG5cbmNvbnN0IGNvbmZpZzogU3RhZ2VDb25maWcgPSBzdGFnZUNvbmZpZ3Nbc3RhZ2VdIHx8IHtcbiAgZG9tYWluTmFtZTogJ2xvY2FsaG9zdDozMDAwJyxcbiAgZW5hYmxlQXV0aDogZmFsc2UsXG4gIGVuYWJsZUNsb3VkRnJvbnQ6IGZhbHNlLFxuICBlbmFibGVCYWNrdXA6IGZhbHNlLFxufTtcblxuLy8gU2hhcmVkIHN0YWNrIHByb3BzXG5jb25zdCBzdGFja1Byb3BzOiBjZGsuU3RhY2tQcm9wcyA9IHtcbiAgZW52LFxuICB0YWdzOiB7XG4gICAgUHJvamVjdDogJ1ZKLUFwcGxpY2F0aW9uJyxcbiAgICBTdGFnZTogc3RhZ2UsXG4gICAgT3duZXI6ICd2ai10ZWFtJyxcbiAgfSxcbn07XG5cbi8vIENvbmZpZ3VyYXRpb24gU3RhY2sgKG11c3QgYmUgZGVwbG95ZWQgZmlyc3QpXG5jb25zdCBjb25maWdTdGFjayA9IG5ldyBWakNvbmZpZ1N0YWNrKGFwcCwgYFZqQ29uZmlnU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG59KTtcblxuLy8gU3RvcmFnZSBTdGFja1xuY29uc3Qgc3RvcmFnZVN0YWNrID0gbmV3IFZqU3RvcmFnZVN0YWNrKGFwcCwgYFZqU3RvcmFnZVN0YWNrLSR7c3RhZ2V9YCwge1xuICAuLi5zdGFja1Byb3BzLFxuICBzdGFnZSxcbiAgY29uZmlnLFxuICBjb25maWdUYWJsZTogY29uZmlnU3RhY2suY29uZmlnVGFibGUsXG59KTtcblxuLy8gQVBJIFN0YWNrXG5jb25zdCBhcGlTdGFjayA9IG5ldyBWakFwaVN0YWNrKGFwcCwgYFZqQXBpU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIHNlc3Npb25UYWJsZTogc3RvcmFnZVN0YWNrLnNlc3Npb25UYWJsZSxcbiAgcHJlc2V0VGFibGU6IHN0b3JhZ2VTdGFjay5wcmVzZXRUYWJsZSxcbiAgY29uZmlnVGFibGU6IGNvbmZpZ1N0YWNrLmNvbmZpZ1RhYmxlLFxufSk7XG5cbi8vIFN0YXRpYyBIb3N0aW5nIFN0YWNrXG5jb25zdCBob3N0aW5nU3RhY2sgPSBuZXcgVmpTdGF0aWNIb3N0aW5nU3RhY2soYXBwLCBgVmpTdGF0aWNIb3N0aW5nU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGFwaVVybDogYXBpU3RhY2suYXBpVXJsLFxuICB3ZWJzb2NrZXRVcmw6IGFwaVN0YWNrLndlYnNvY2tldFVybCxcbn0pO1xuXG4vLyBDRE4gU3RhY2sgKG9wdGlvbmFsIGJhc2VkIG9uIGNvbmZpZylcbmxldCBjZG5TdGFjazogVmpDZG5TdGFjayB8IHVuZGVmaW5lZDtcbmlmIChjb25maWcuZW5hYmxlQ2xvdWRGcm9udCkge1xuICBjZG5TdGFjayA9IG5ldyBWakNkblN0YWNrKGFwcCwgYFZqQ2RuU3RhY2stJHtzdGFnZX1gLCB7XG4gICAgLi4uc3RhY2tQcm9wcyxcbiAgICBzdGFnZTogc3RhZ2UgYXMgJ2RldicgfCAnc3RhZ2luZycgfCAncHJvZCcsXG4gICAgc2l0ZUJ1Y2tldDogaG9zdGluZ1N0YWNrLnNpdGVCdWNrZXQsXG4gICAgZG9tYWluTmFtZTogY29uZmlnLmRvbWFpbk5hbWUsXG4gIH0pO1xufVxuXG4vLyBNb25pdG9yaW5nIFN0YWNrIChkZXBlbmRzIG9uIGFsbCBvdGhlciBzdGFja3MpXG5jb25zdCBtb25pdG9yaW5nU3RhY2sgPSBuZXcgVmpNb25pdG9yaW5nU3RhY2soYXBwLCBgVmpNb25pdG9yaW5nU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGFwaVN0YWNrLFxuICBzdG9yYWdlU3RhY2ssXG4gIGhvc3RpbmdTdGFjayxcbn0pO1xuXG4vLyBTdGFjayBkZXBlbmRlbmNpZXNcbnN0b3JhZ2VTdGFjay5hZGREZXBlbmRlbmN5KGNvbmZpZ1N0YWNrKTtcbmFwaVN0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcbmhvc3RpbmdTdGFjay5hZGREZXBlbmRlbmN5KGFwaVN0YWNrKTtcbmlmIChjZG5TdGFjaykge1xuICBjZG5TdGFjay5hZGREZXBlbmRlbmN5KGhvc3RpbmdTdGFjayk7XG4gIG1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGNkblN0YWNrKTtcbn1cbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGFwaVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KHN0b3JhZ2VTdGFjayk7XG5tb25pdG9yaW5nU3RhY2suYWRkRGVwZW5kZW5jeShob3N0aW5nU3RhY2spOyJdfQ==