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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyw2REFBd0Q7QUFDeEQscUVBQWdFO0FBQ2hFLG1GQUE2RTtBQUM3RSwyRUFBc0U7QUFDdEUsbUVBQThEO0FBRTlELE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRTFCLDhDQUE4QztBQUM5QyxNQUFNLEdBQUcsR0FBRztJQUNWLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFtQjtJQUN4QyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsSUFBSSxXQUFXO0NBQ3RELENBQUM7QUFFRixxQ0FBcUM7QUFDckMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxDQUFDO0FBU3ZELE1BQU0sWUFBWSxHQUFnQztJQUNoRCxHQUFHLEVBQUU7UUFDSCxVQUFVLEVBQUUsZUFBZTtRQUMzQixVQUFVLEVBQUUsS0FBSztRQUNqQixnQkFBZ0IsRUFBRSxLQUFLO1FBQ3ZCLFlBQVksRUFBRSxLQUFLO0tBQ3BCO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsVUFBVSxFQUFFLG1CQUFtQjtRQUMvQixVQUFVLEVBQUUsSUFBSTtRQUNoQixnQkFBZ0IsRUFBRSxJQUFJO1FBQ3RCLFlBQVksRUFBRSxJQUFJO0tBQ25CO0lBQ0QsSUFBSSxFQUFFO1FBQ0osVUFBVSxFQUFFLFdBQVc7UUFDdkIsVUFBVSxFQUFFLElBQUk7UUFDaEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixZQUFZLEVBQUUsSUFBSTtLQUNuQjtDQUNGLENBQUM7QUFFRixNQUFNLE1BQU0sR0FBZ0IsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJO0lBQ2pELFVBQVUsRUFBRSxnQkFBZ0I7SUFDNUIsVUFBVSxFQUFFLEtBQUs7SUFDakIsZ0JBQWdCLEVBQUUsS0FBSztJQUN2QixZQUFZLEVBQUUsS0FBSztDQUNwQixDQUFDO0FBRUYscUJBQXFCO0FBQ3JCLE1BQU0sVUFBVSxHQUFtQjtJQUNqQyxHQUFHO0lBQ0gsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLGdCQUFnQjtRQUN6QixLQUFLLEVBQUUsS0FBSztRQUNaLEtBQUssRUFBRSxTQUFTO0tBQ2pCO0NBQ0YsQ0FBQztBQUVGLCtDQUErQztBQUMvQyxNQUFNLFdBQVcsR0FBRyxJQUFJLCtCQUFhLENBQUMsR0FBRyxFQUFFLGlCQUFpQixLQUFLLEVBQUUsRUFBRTtJQUNuRSxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtDQUNQLENBQUMsQ0FBQztBQUVILGdCQUFnQjtBQUNoQixNQUFNLFlBQVksR0FBRyxJQUFJLGlDQUFjLENBQUMsR0FBRyxFQUFFLGtCQUFrQixLQUFLLEVBQUUsRUFBRTtJQUN0RSxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtJQUNOLFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVztDQUNyQyxDQUFDLENBQUM7QUFFSCxZQUFZO0FBQ1osTUFBTSxRQUFRLEdBQUcsSUFBSSx5QkFBVSxDQUFDLEdBQUcsRUFBRSxjQUFjLEtBQUssRUFBRSxFQUFFO0lBQzFELEdBQUcsVUFBVTtJQUNiLEtBQUs7SUFDTCxNQUFNO0lBQ04sWUFBWSxFQUFFLFlBQVksQ0FBQyxZQUFZO0lBQ3ZDLFdBQVcsRUFBRSxZQUFZLENBQUMsV0FBVztJQUNyQyxXQUFXLEVBQUUsV0FBVyxDQUFDLFdBQVc7Q0FDckMsQ0FBQyxDQUFDO0FBRUgsdUJBQXVCO0FBQ3ZCLE1BQU0sWUFBWSxHQUFHLElBQUksOENBQW9CLENBQUMsR0FBRyxFQUFFLHdCQUF3QixLQUFLLEVBQUUsRUFBRTtJQUNsRixHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtJQUNOLE1BQU0sRUFBRSxRQUFRLENBQUMsTUFBTTtJQUN2QixZQUFZLEVBQUUsUUFBUSxDQUFDLFlBQVk7Q0FDcEMsQ0FBQyxDQUFDO0FBRUgsaURBQWlEO0FBQ2pELE1BQU0sZUFBZSxHQUFHLElBQUksdUNBQWlCLENBQUMsR0FBRyxFQUFFLHFCQUFxQixLQUFLLEVBQUUsRUFBRTtJQUMvRSxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsTUFBTTtJQUNOLFFBQVE7SUFDUixZQUFZO0lBQ1osWUFBWTtDQUNiLENBQUMsQ0FBQztBQUVILHFCQUFxQjtBQUNyQixZQUFZLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0FBQ3hDLFFBQVEsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDckMsWUFBWSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNyQyxlQUFlLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3hDLGVBQWUsQ0FBQyxhQUFhLENBQUMsWUFBWSxDQUFDLENBQUM7QUFDNUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgeyBWakFwaVN0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1hcGktc3RhY2snO1xuaW1wb3J0IHsgVmpTdG9yYWdlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLXN0b3JhZ2Utc3RhY2snO1xuaW1wb3J0IHsgVmpTdGF0aWNIb3N0aW5nU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLXN0YXRpYy1ob3N0aW5nLXN0YWNrJztcbmltcG9ydCB7IFZqTW9uaXRvcmluZ1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy92ai1tb25pdG9yaW5nLXN0YWNrJztcbmltcG9ydCB7IFZqQ29uZmlnU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLWNvbmZpZy1zdGFjayc7XG5cbmNvbnN0IGFwcCA9IG5ldyBjZGsuQXBwKCk7XG5cbi8vIEdldCBlbnZpcm9ubWVudCBmcm9tIGNvbnRleHQgb3IgdXNlIGRlZmF1bHRcbmNvbnN0IGVudiA9IHtcbiAgYWNjb3VudDogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfQUNDT1VOVCxcbiAgcmVnaW9uOiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9SRUdJT04gfHwgJ3VzLWVhc3QtMScsXG59O1xuXG4vLyBFbnZpcm9ubWVudC1zcGVjaWZpYyBjb25maWd1cmF0aW9uXG5jb25zdCBzdGFnZSA9IGFwcC5ub2RlLnRyeUdldENvbnRleHQoJ3N0YWdlJykgfHwgJ2Rldic7XG5cbmludGVyZmFjZSBTdGFnZUNvbmZpZyB7XG4gIGRvbWFpbk5hbWU6IHN0cmluZztcbiAgZW5hYmxlQXV0aDogYm9vbGVhbjtcbiAgZW5hYmxlQ2xvdWRGcm9udDogYm9vbGVhbjtcbiAgZW5hYmxlQmFja3VwOiBib29sZWFuO1xufVxuXG5jb25zdCBzdGFnZUNvbmZpZ3M6IFJlY29yZDxzdHJpbmcsIFN0YWdlQ29uZmlnPiA9IHtcbiAgZGV2OiB7XG4gICAgZG9tYWluTmFtZTogJ2Rldi52MXozci5hcHAnLFxuICAgIGVuYWJsZUF1dGg6IGZhbHNlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IGZhbHNlLFxuICAgIGVuYWJsZUJhY2t1cDogZmFsc2UsXG4gIH0sXG4gIHN0YWdpbmc6IHtcbiAgICBkb21haW5OYW1lOiAnc3RhZ2luZy52MXozci5hcHAnLFxuICAgIGVuYWJsZUF1dGg6IHRydWUsXG4gICAgZW5hYmxlQ2xvdWRGcm9udDogdHJ1ZSxcbiAgICBlbmFibGVCYWNrdXA6IHRydWUsXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBkb21haW5OYW1lOiAndjF6M3IuYXBwJyxcbiAgICBlbmFibGVBdXRoOiB0cnVlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IHRydWUsXG4gICAgZW5hYmxlQmFja3VwOiB0cnVlLFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnOiBTdGFnZUNvbmZpZyA9IHN0YWdlQ29uZmlnc1tzdGFnZV0gfHwge1xuICBkb21haW5OYW1lOiAnbG9jYWxob3N0OjMwMDAnLFxuICBlbmFibGVBdXRoOiBmYWxzZSxcbiAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gIGVuYWJsZUJhY2t1cDogZmFsc2UsXG59O1xuXG4vLyBTaGFyZWQgc3RhY2sgcHJvcHNcbmNvbnN0IHN0YWNrUHJvcHM6IGNkay5TdGFja1Byb3BzID0ge1xuICBlbnYsXG4gIHRhZ3M6IHtcbiAgICBQcm9qZWN0OiAnVkotQXBwbGljYXRpb24nLFxuICAgIFN0YWdlOiBzdGFnZSxcbiAgICBPd25lcjogJ3ZqLXRlYW0nLFxuICB9LFxufTtcblxuLy8gQ29uZmlndXJhdGlvbiBTdGFjayAobXVzdCBiZSBkZXBsb3llZCBmaXJzdClcbmNvbnN0IGNvbmZpZ1N0YWNrID0gbmV3IFZqQ29uZmlnU3RhY2soYXBwLCBgVmpDb25maWdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbn0pO1xuXG4vLyBTdG9yYWdlIFN0YWNrXG5jb25zdCBzdG9yYWdlU3RhY2sgPSBuZXcgVmpTdG9yYWdlU3RhY2soYXBwLCBgVmpTdG9yYWdlU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBjb25maWcsXG4gIGNvbmZpZ1RhYmxlOiBjb25maWdTdGFjay5jb25maWdUYWJsZSxcbn0pO1xuXG4vLyBBUEkgU3RhY2tcbmNvbnN0IGFwaVN0YWNrID0gbmV3IFZqQXBpU3RhY2soYXBwLCBgVmpBcGlTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgc2Vzc2lvblRhYmxlOiBzdG9yYWdlU3RhY2suc2Vzc2lvblRhYmxlLFxuICBwcmVzZXRUYWJsZTogc3RvcmFnZVN0YWNrLnByZXNldFRhYmxlLFxuICBjb25maWdUYWJsZTogY29uZmlnU3RhY2suY29uZmlnVGFibGUsXG59KTtcblxuLy8gU3RhdGljIEhvc3RpbmcgU3RhY2tcbmNvbnN0IGhvc3RpbmdTdGFjayA9IG5ldyBWalN0YXRpY0hvc3RpbmdTdGFjayhhcHAsIGBWalN0YXRpY0hvc3RpbmdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgYXBpVXJsOiBhcGlTdGFjay5hcGlVcmwsXG4gIHdlYnNvY2tldFVybDogYXBpU3RhY2sud2Vic29ja2V0VXJsLFxufSk7XG5cbi8vIE1vbml0b3JpbmcgU3RhY2sgKGRlcGVuZHMgb24gYWxsIG90aGVyIHN0YWNrcylcbmNvbnN0IG1vbml0b3JpbmdTdGFjayA9IG5ldyBWak1vbml0b3JpbmdTdGFjayhhcHAsIGBWak1vbml0b3JpbmdTdGFjay0ke3N0YWdlfWAsIHtcbiAgLi4uc3RhY2tQcm9wcyxcbiAgc3RhZ2UsXG4gIGNvbmZpZyxcbiAgYXBpU3RhY2ssXG4gIHN0b3JhZ2VTdGFjayxcbiAgaG9zdGluZ1N0YWNrLFxufSk7XG5cbi8vIFN0YWNrIGRlcGVuZGVuY2llc1xuc3RvcmFnZVN0YWNrLmFkZERlcGVuZGVuY3koY29uZmlnU3RhY2spO1xuYXBpU3RhY2suYWRkRGVwZW5kZW5jeShzdG9yYWdlU3RhY2spO1xuaG9zdGluZ1N0YWNrLmFkZERlcGVuZGVuY3koYXBpU3RhY2spO1xubW9uaXRvcmluZ1N0YWNrLmFkZERlcGVuZGVuY3koYXBpU3RhY2spO1xubW9uaXRvcmluZ1N0YWNrLmFkZERlcGVuZGVuY3koc3RvcmFnZVN0YWNrKTtcbm1vbml0b3JpbmdTdGFjay5hZGREZXBlbmRlbmN5KGhvc3RpbmdTdGFjayk7Il19