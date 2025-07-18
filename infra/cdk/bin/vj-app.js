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
const vj_unified_stack_1 = require("../lib/stacks/vj-unified-stack");
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
// Unified Stack (all resources in one stack)
const unifiedStack = new vj_unified_stack_1.VjUnifiedStack(app, `VjUnifiedStack-${stage}`, {
    ...stackProps,
    stage,
    enableAuth: config.enableAuth,
    enableCloudFront: config.enableCloudFront,
    enableBackup: config.enableBackup,
    domainName: config.domainName,
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotYXBwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EsdUNBQXFDO0FBQ3JDLGlEQUFtQztBQUNuQyxxRUFBZ0U7QUFFaEUsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIsOENBQThDO0FBQzlDLE1BQU0sR0FBRyxHQUFHO0lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsbUJBQW1CO0lBQ3hDLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGtCQUFrQixJQUFJLFdBQVc7Q0FDdEQsQ0FBQztBQUVGLHFDQUFxQztBQUNyQyxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLENBQUM7QUFTdkQsTUFBTSxZQUFZLEdBQWdDO0lBQ2hELEdBQUcsRUFBRTtRQUNILFVBQVUsRUFBRSxnQkFBZ0I7UUFDNUIsVUFBVSxFQUFFLEtBQUs7UUFDakIsZ0JBQWdCLEVBQUUsS0FBSztRQUN2QixZQUFZLEVBQUUsS0FBSztLQUNwQjtJQUNELE9BQU8sRUFBRTtRQUNQLFVBQVUsRUFBRSx5QkFBeUI7UUFDckMsVUFBVSxFQUFFLElBQUk7UUFDaEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixZQUFZLEVBQUUsS0FBSztLQUNwQjtJQUNELElBQUksRUFBRTtRQUNKLFVBQVUsRUFBRSxpQkFBaUI7UUFDN0IsVUFBVSxFQUFFLElBQUk7UUFDaEIsZ0JBQWdCLEVBQUUsSUFBSTtRQUN0QixZQUFZLEVBQUUsSUFBSTtLQUNuQjtDQUNGLENBQUM7QUFFRixNQUFNLE1BQU0sR0FBZ0IsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJO0lBQ2pELFVBQVUsRUFBRSxnQkFBZ0I7SUFDNUIsVUFBVSxFQUFFLEtBQUs7SUFDakIsZ0JBQWdCLEVBQUUsS0FBSztJQUN2QixZQUFZLEVBQUUsS0FBSztDQUNwQixDQUFDO0FBRUYscUJBQXFCO0FBQ3JCLE1BQU0sVUFBVSxHQUFtQjtJQUNqQyxHQUFHO0lBQ0gsSUFBSSxFQUFFO1FBQ0osT0FBTyxFQUFFLGdCQUFnQjtRQUN6QixLQUFLLEVBQUUsS0FBSztRQUNaLEtBQUssRUFBRSxTQUFTO0tBQ2pCO0NBQ0YsQ0FBQztBQUVGLDZDQUE2QztBQUM3QyxNQUFNLFlBQVksR0FBRyxJQUFJLGlDQUFjLENBQUMsR0FBRyxFQUFFLGtCQUFrQixLQUFLLEVBQUUsRUFBRTtJQUN0RSxHQUFHLFVBQVU7SUFDYixLQUFLO0lBQ0wsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO0lBQzdCLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7SUFDekMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxZQUFZO0lBQ2pDLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVTtDQUM5QixDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG5pbXBvcnQgJ3NvdXJjZS1tYXAtc3VwcG9ydC9yZWdpc3Rlcic7XG5pbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgVmpVbmlmaWVkU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL3ZqLXVuaWZpZWQtc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgZW52aXJvbm1lbnQgZnJvbSBjb250ZXh0IG9yIHVzZSBkZWZhdWx0XG5jb25zdCBlbnYgPSB7XG4gIGFjY291bnQ6IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX0FDQ09VTlQsXG4gIHJlZ2lvbjogcHJvY2Vzcy5lbnYuQ0RLX0RFRkFVTFRfUkVHSU9OIHx8ICd1cy1lYXN0LTEnLFxufTtcblxuLy8gRW52aXJvbm1lbnQtc3BlY2lmaWMgY29uZmlndXJhdGlvblxuY29uc3Qgc3RhZ2UgPSBhcHAubm9kZS50cnlHZXRDb250ZXh0KCdzdGFnZScpIHx8ICdkZXYnO1xuXG5pbnRlcmZhY2UgU3RhZ2VDb25maWcge1xuICBkb21haW5OYW1lOiBzdHJpbmc7XG4gIGVuYWJsZUF1dGg6IGJvb2xlYW47XG4gIGVuYWJsZUNsb3VkRnJvbnQ6IGJvb2xlYW47XG4gIGVuYWJsZUJhY2t1cDogYm9vbGVhbjtcbn1cblxuY29uc3Qgc3RhZ2VDb25maWdzOiBSZWNvcmQ8c3RyaW5nLCBTdGFnZUNvbmZpZz4gPSB7XG4gIGRldjoge1xuICAgIGRvbWFpbk5hbWU6ICdsb2NhbGhvc3Q6MzAwMCcsXG4gICAgZW5hYmxlQXV0aDogZmFsc2UsXG4gICAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gICAgZW5hYmxlQmFja3VwOiBmYWxzZSxcbiAgfSxcbiAgc3RhZ2luZzoge1xuICAgIGRvbWFpbk5hbWU6ICdzdGFnaW5nLnYxejNyLnNjNHBlLm5ldCcsXG4gICAgZW5hYmxlQXV0aDogdHJ1ZSxcbiAgICBlbmFibGVDbG91ZEZyb250OiB0cnVlLFxuICAgIGVuYWJsZUJhY2t1cDogZmFsc2UsXG4gIH0sXG4gIHByb2Q6IHtcbiAgICBkb21haW5OYW1lOiAndjF6M3Iuc2M0cGUubmV0JyxcbiAgICBlbmFibGVBdXRoOiB0cnVlLFxuICAgIGVuYWJsZUNsb3VkRnJvbnQ6IHRydWUsXG4gICAgZW5hYmxlQmFja3VwOiB0cnVlLFxuICB9LFxufTtcblxuY29uc3QgY29uZmlnOiBTdGFnZUNvbmZpZyA9IHN0YWdlQ29uZmlnc1tzdGFnZV0gfHwge1xuICBkb21haW5OYW1lOiAnbG9jYWxob3N0OjMwMDAnLFxuICBlbmFibGVBdXRoOiBmYWxzZSxcbiAgZW5hYmxlQ2xvdWRGcm9udDogZmFsc2UsXG4gIGVuYWJsZUJhY2t1cDogZmFsc2UsXG59O1xuXG4vLyBTaGFyZWQgc3RhY2sgcHJvcHNcbmNvbnN0IHN0YWNrUHJvcHM6IGNkay5TdGFja1Byb3BzID0ge1xuICBlbnYsXG4gIHRhZ3M6IHtcbiAgICBQcm9qZWN0OiAnVkotQXBwbGljYXRpb24nLFxuICAgIFN0YWdlOiBzdGFnZSxcbiAgICBPd25lcjogJ3ZqLXRlYW0nLFxuICB9LFxufTtcblxuLy8gVW5pZmllZCBTdGFjayAoYWxsIHJlc291cmNlcyBpbiBvbmUgc3RhY2spXG5jb25zdCB1bmlmaWVkU3RhY2sgPSBuZXcgVmpVbmlmaWVkU3RhY2soYXBwLCBgVmpVbmlmaWVkU3RhY2stJHtzdGFnZX1gLCB7XG4gIC4uLnN0YWNrUHJvcHMsXG4gIHN0YWdlLFxuICBlbmFibGVBdXRoOiBjb25maWcuZW5hYmxlQXV0aCxcbiAgZW5hYmxlQ2xvdWRGcm9udDogY29uZmlnLmVuYWJsZUNsb3VkRnJvbnQsXG4gIGVuYWJsZUJhY2t1cDogY29uZmlnLmVuYWJsZUJhY2t1cCxcbiAgZG9tYWluTmFtZTogY29uZmlnLmRvbWFpbk5hbWUsXG59KTsiXX0=