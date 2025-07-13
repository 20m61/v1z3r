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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw2REFBd0Q7QUFDeEQscUVBQWdFO0FBQ2hFLG1GQUE2RTtBQUM3RSwyRUFBc0U7QUFDdEUsbUVBQThEO0FBRTlELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLDhDQUE4QztBQUM5QyxNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0NBQ3RELENBQUM7QUFFRixxQ0FBcUM7QUFDckMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDO0FBU3ZELE1BQU0sWUFBWSxHQUFnQztJQUNoRCxHQUFHLEVBQUU7UUFDSCxVQUFVLEVBQUUsZ0JBQWdCO1FBQzVCLFVBQVUsRUFBRSxLQUFLO1FBQ2pCLGdCQUFnQixFQUFFLEtBQUs7UUFDdkIsWUFBWSxFQUFFLEtBQUs7S0FDcEI7SUFDRCxPQUFPLEVBQUU7UUFDUCxVQUFVLEVBQUUseUJBQXlCO1FBQ3JDLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsWUFBWSxFQUFFLEtBQUs7S0FDcEI7SUFDRCxJQUFJLEVBQUU7UUFDSixVQUFVLEVBQUUsaUJBQWlCO1FBQzdCLFVBQVUsRUFBRSxJQUFJO1FBQ2hCLGdCQUFnQixFQUFFLElBQUk7UUFDdEIsWUFBWSxFQUFFLElBQUk7S0FDbkI7Q0FDRixDQUFDO0FBRUYsTUFBTSxNQUFNLEdBQWdCLFlBQVksQ0FBQyxLQUFLLENBQUMsSUFBSTtJQUNqRCxVQUFVLEVBQUUsZ0JBQWdCO0lBQzVCLFVBQVUsRUFBRSxLQUFLO0lBQ2pCLGdCQUFnQixFQUFFLEtBQUs7SUFDdkIsWUFBWSxFQUFFLEtBQUs7Q0FDcEIsQ0FBQztBQUVGLHFCQUFxQjtBQUNyQixNQUFNLFVBQVUsR0FBbUI7SUFDakMsR0FBRztJQUNILElBQUksRUFBRTtRQUNKLE9BQU8sRUFBRSxnQkFBZ0I7UUFDekIsS0FBSyxFQUFFLEtBQUs7UUFDWixLQUFLLEVBQUUsU0FBUztLQUNqQjtDQUNGLENBQUM7QUFFRiwrQ0FBK0M7QUFDL0MsTUFBTSxXQUFXLEdBQUcsSUFBSSwrQkFBYSxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsS0FBSyxFQUFFLEVBQUU7SUFDbkUsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07Q0FDUCxDQUFDLENBQUM7QUFFSCxnQkFBZ0I7QUFDaEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxpQ0FBYyxDQUFDLEdBQUcsRUFBRSxrQkFBa0IsS0FBSyxFQUFFLEVBQUU7SUFDdEUsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixXQUFXLEVBQUUsV0FBVyxDQUFDLFdBQVc7Q0FDckMsQ0FBQyxDQUFDO0FBRUgsWUFBWTtBQUNaLE1BQU0sUUFBUSxHQUFHLElBQUkseUJBQVUsQ0FBQyxHQUFHLEVBQUUsY0FBYyxLQUFLLEVBQUUsRUFBRTtJQUMxRCxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtJQUNOLFlBQVksRUFBRSxZQUFZLENBQUMsWUFBWTtJQUN2QyxXQUFXLEVBQUUsWUFBWSxDQUFDLFdBQVc7SUFDckMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxXQUFXO0NBQ3JDLENBQUMsQ0FBQztBQUVILHVCQUF1QjtBQUN2QixNQUFNLFlBQVksR0FBRyxJQUFJLDhDQUFvQixDQUFDLEdBQUcsRUFBRSx3QkFBd0IsS0FBSyxFQUFFLEVBQUU7SUFDbEYsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU07SUFDdkIsWUFBWSxFQUFFLFFBQVEsQ0FBQyxZQUFZO0NBQ3BDLENBQUMsQ0FBQztBQUVILGlEQUFpRDtBQUNqRCxNQUFNLGVBQWUsR0FBRyxJQUFJLHVDQUFpQixDQUFDLEdBQUcsRUFBRSxxQkFBcUIsS0FBSyxFQUFFLEVBQUU7SUFDL0UsR0FBRyxVQUFVO0lBQ2IsS0FBSztJQUNMLE1BQU07SUFDTixRQUFRO0lBQ1IsWUFBWTtJQUNaLFlBQVk7Q0FDYixDQUFDLENBQUM7QUFFSCxxQkFBcUI7QUFDckIsWUFBWSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUN4QyxRQUFRLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQ3JDLFlBQVksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDckMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUN4QyxlQUFlLENBQUMsYUFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDO0FBQzVDLGVBQWUsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVmpBcGlTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotYXBpLXN0YWNrJztcbmltcG9ydCB7IFZqU3RvcmFnZVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1zdG9yYWdlLXN0YWNrJztcbmltcG9ydCB7IFZqU3RhdGljSG9zdGluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1zdGF0aWMtaG9zdGluZy1zdGFjayc7XG5pbXBvcnQgeyBWak1vbml0b3JpbmdTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvdmotbW9uaXRvcmluZy1zdGFjayc7XG5pbXBvcnQgeyBWakNvbmZpZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1jb25maWctc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgZW52aXJvbm1lbnQgZnJvbSBjb250ZXh0IG9yIHVzZSBkZWZhdWx0XG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnLFxufTtcblxuLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgY29uZmlndXJhdGlvblxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8ICdkZXYnO1xuXG5pbnRlcmZhY2UgU3RhZ2VDb25maWcge1xuICBkb21haW5OYW1lOiBzdHJpbmc7XG4gIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbn1cblxuY29uc3Qgc3RhZ2VDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBTdGFnZUNvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIGRvbWFpbk5hbWU6ICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgZW5hYmxlQXV0aDogZmFsc2UsXG4gICAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gICAgZW5hYmxlQmFja3VwOiBmYWxzZSxcbiAgfSxcbiAgc3RhZ2luZzoge1xuICAgIGRvbWFpbk5hbWU6ICdzdGFnaW5nLnYxejNyLnNjNHBlLm5ldCcsXG4gICAgZW5hYmxlQXV0aDogdHJ1ZSxcbiAgICBlbmFibGVDbG91ZEZyb250OiB0cnVlLFxuICAgIGVuYWJsZUJhY2t1cDogZmFsc2UsXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBkb21haW5OYW1lOiAndjF6M3Iuc2M0cGUubmV0JyxcbiAgICBlbmFibGVBdXRoOiB0cnVlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IHRydWUsXG4gICAgZW5hYmxlQmFja3VwOiB0cnVlLFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnOiBTdGFnZUNvbmZpZyA9IHN0YWdlQ29uZmlnc1tzdGFnZV0gfHwge1xuICBkb21haW5OYW1lOiAnbG9jYWxob3N0OjMwMDAnLFxuICBlbmFibGVBdXRoOiBmYWxzZSxcbiAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gIGVuYWJsZUJhY2t1cDogZmFsc2UsXG59O1xuXG4vLyBTaGFyZWQgc3RhY2sgcHJvcHNcbmNvbnN0IHN0YWNrUHJvcHM6IGNkay5TdGFja1Byb3BzID0ge1xuICBlbnYsXG4gIHRhZ3M6IHtcbiAgICBQcm9qZWN0OiAnVkotQXBwbGljYXRpb24nLFxuICAgIFN0YWdlOiBzdGFnZSxcbiAgICBPd25lcjogJ3ZqLXRlYW0nLFxuICB9LFxufTtcblxuLy8gQ29uZmlndXJhdGlvbiBTdGFjayAobXVzdCBiZSBkZXBsb3llZCBmaXJzdClcbmNvbnN0IGNvbmZpZ1N0YWNrID0gbmV3IFZqQ29uZmlnU3RhY2soYXBwLCBgVmpDb25maWdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbn0pO1xuXG4vLyBTdG9yYWdlIFN0YWNrXG5jb25zdCBzdG9yYWdlU3RhY2sgPSBuZXcgVmpTdG9yYWdlU3RhY2soYXBwLCBgVmpTdG9yYWdlU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGNvbmZpZ1RhYmxlOiBjb25maWdTdGFjay5jb25maWdUYWJsZSxcbn0pO1xuXG4vLyBBUEkgU3RhY2tcbmNvbnN0IGFwaVN0YWNrID0gbmV3IFZqQXBpU3RhY2soYXBwLCBgVmpBcGlTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgc2Vzc2lvblRhYmxlOiBzdG9yYWdlU3RhY2suc2Vzc2lvblRhYmxlLFxuICBwcmVzZXRUYWJsZTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLFxuICBjb25maWdUYWJsZTogY29uZmlnU3RhY2suY29uZmlnVGFibGUsXG59KTtcblxuLy8gU3RhdGljIEhvc3RpbmcgU3RhY2tcbmNvbnN0IGhvc3RpbmdTdGFjayA9IG5ldyBWalN0YXRpY0hvc3RpbmdTdGFjayhhcHAsIGBWalN0YXRpY0hvc3RpbmdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgYXBpVXJsOiBhcGlTdGFjay5hcGlVcmwsXG4gIHdlYnNvY2tldFVybDogYXBpU3RhY2sud2Vic29ja2V0VXJsLFxufSk7XG5cbi8vIE1vbml0b3JpbmcgU3RhY2sgKGRlcGVuZHMgb24gYWxsIG90aGVyIHN0YWNrcylcbmNvbnN0IG1vbml0b3JpbmdTdGFjayA9IG5ldyBWak1vbml0b3JpbmdTdGFjayhhcHAsIGBWak1vbml0b3JpbmdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgYXBpU3RhY2ssXG4gIHN0b3JhZ2VTdGFjayxcbiAgaG9zdGluZ1N0YWNrLFxufSk7XG5cbi8vIFN0YWNrIGRlcGVuZGVuY2llc1xuc3RvcmFnZVN0YWNrLmFkZERlcGVuZGVuY3koY29uZmlnU3RhY2spO1xuYXBpU3RhY2suYWRkRGVwZW5kZW5jeShzdG9yYWdlU3RhY2spO1xuaG9zdGluZ1N0YWNrLmFkZERlcGVuZGVuY3koYXBpU3RhY2spO1xubW9uaXRvcmluZ1N0YWNrLmFkZERlcGVuZGVuY3koYXBpU3RhY2spO1xubW9uaXRvcmluZ1N0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGhvc3RpbmdTdGFjayk7Il19