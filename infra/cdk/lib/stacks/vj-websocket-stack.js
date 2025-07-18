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
exports.VjWebSocketStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayv2_integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
class VjWebSocketStack extends cdk.Stack {
    websocketApi;
    websocketStage;
    websocketUrl;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { stage, sessionTable, configTable, presetTable, connectionFunction, messageFunction, healthFunction } = props;
        // Create WebSocket API
        this.websocketApi = new apigatewayv2.WebSocketApi(this, 'VjWebSocketApi', {
            apiName: `vj-websocket-${stage}`,
            description: `VJ Application WebSocket API - ${stage}`,
            connectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ConnectIntegration', connectionFunction),
            },
            disconnectRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DisconnectIntegration', connectionFunction),
            },
            defaultRouteOptions: {
                integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('DefaultIntegration', messageFunction),
            },
        });
        // Add custom routes
        this.websocketApi.addRoute('ping', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('PingIntegration', messageFunction),
        });
        this.websocketApi.addRoute('sync', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('SyncIntegration', messageFunction),
        });
        this.websocketApi.addRoute('preset', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('PresetIntegration', messageFunction),
        });
        this.websocketApi.addRoute('performance', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('PerformanceIntegration', messageFunction),
        });
        this.websocketApi.addRoute('chat', {
            integration: new apigatewayv2_integrations.WebSocketLambdaIntegration('ChatIntegration', messageFunction),
        });
        // Create deployment stage
        this.websocketStage = new apigatewayv2.WebSocketStage(this, 'VjWebSocketStage', {
            webSocketApi: this.websocketApi,
            stageName: stage,
            autoDeploy: true,
            throttle: {
                rateLimit: stage === 'prod' ? 1000 : 100,
                burstLimit: stage === 'prod' ? 2000 : 200,
            },
        });
        // Create CloudWatch Log Group for WebSocket API
        const logGroup = new logs.LogGroup(this, 'WebSocketLogGroup', {
            logGroupName: `/aws/apigateway/websocket/${this.websocketApi.apiId}/${stage}`,
            retention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Grant permissions to Lambda functions
        const websocketManagementPolicy = new iam.PolicyStatement({
            actions: ['execute-api:ManageConnections'],
            resources: [
                `arn:aws:execute-api:${this.region}:${this.account}:${this.websocketApi.apiId}/${stage}/*`,
            ],
        });
        connectionFunction.addToRolePolicy(websocketManagementPolicy);
        messageFunction.addToRolePolicy(websocketManagementPolicy);
        // Update Lambda environment variables with WebSocket endpoint
        const websocketEndpoint = `https://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`;
        connectionFunction.addEnvironment('WEBSOCKET_ENDPOINT', websocketEndpoint);
        messageFunction.addEnvironment('WEBSOCKET_ENDPOINT', websocketEndpoint);
        healthFunction.addEnvironment('WEBSOCKET_ENDPOINT', websocketEndpoint);
        // Grant table permissions
        sessionTable.grantReadWriteData(connectionFunction);
        sessionTable.grantReadWriteData(messageFunction);
        configTable.grantReadWriteData(connectionFunction);
        configTable.grantReadWriteData(messageFunction);
        configTable.grantReadWriteData(healthFunction);
        presetTable.grantReadData(messageFunction);
        // Store WebSocket URL
        this.websocketUrl = `wss://${this.websocketApi.apiId}.execute-api.${this.region}.amazonaws.com/${stage}`;
        // Outputs
        new cdk.CfnOutput(this, 'WebSocketApiId', {
            value: this.websocketApi.apiId,
            description: 'WebSocket API ID',
        });
        new cdk.CfnOutput(this, 'WebSocketUrl', {
            value: this.websocketUrl,
            description: 'WebSocket URL',
        });
        new cdk.CfnOutput(this, 'WebSocketEndpoint', {
            value: websocketEndpoint,
            description: 'WebSocket Management Endpoint',
        });
        // Tags
        cdk.Tags.of(this).add('Component', 'WebSocket');
        cdk.Tags.of(this).add('Stage', stage);
    }
}
exports.VjWebSocketStack = VjWebSocketStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmotd2Vic29ja2V0LXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidmotd2Vic29ja2V0LXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBRW5DLDJFQUE2RDtBQUM3RCxxR0FBdUY7QUFFdkYseURBQTJDO0FBQzNDLDJEQUE2QztBQWE3QyxNQUFhLGdCQUFpQixTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQzdCLFlBQVksQ0FBNEI7SUFDeEMsY0FBYyxDQUE4QjtJQUM1QyxZQUFZLENBQVM7SUFFckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQ0osS0FBSyxFQUNMLFlBQVksRUFDWixXQUFXLEVBQ1gsV0FBVyxFQUNYLGtCQUFrQixFQUNsQixlQUFlLEVBQ2YsY0FBYyxFQUNmLEdBQUcsS0FBSyxDQUFDO1FBRVYsdUJBQXVCO1FBQ3ZCLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxnQkFBZ0IsRUFBRTtZQUN4RSxPQUFPLEVBQUUsZ0JBQWdCLEtBQUssRUFBRTtZQUNoQyxXQUFXLEVBQUUsa0NBQWtDLEtBQUssRUFBRTtZQUN0RCxtQkFBbUIsRUFBRTtnQkFDbkIsV0FBVyxFQUFFLElBQUkseUJBQXlCLENBQUMsMEJBQTBCLENBQ25FLG9CQUFvQixFQUNwQixrQkFBa0IsQ0FDbkI7YUFDRjtZQUNELHNCQUFzQixFQUFFO2dCQUN0QixXQUFXLEVBQUUsSUFBSSx5QkFBeUIsQ0FBQywwQkFBMEIsQ0FDbkUsdUJBQXVCLEVBQ3ZCLGtCQUFrQixDQUNuQjthQUNGO1lBQ0QsbUJBQW1CLEVBQUU7Z0JBQ25CLFdBQVcsRUFBRSxJQUFJLHlCQUF5QixDQUFDLDBCQUEwQixDQUNuRSxvQkFB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UUFFSCxPQUFPO1FBQ1AsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLENBQUMsR0FBRyxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUNoRCxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3hDLENBQUM7Q0FDRjtBQWpKRCw0Q0FpSkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djJfaW50ZWdyYXRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcblxuZXhwb3J0IGludGVyZmFjZSBWaldlYlNvY2tldFN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHN0YWdlOiBzdHJpbmc7XG4gIHNlc3Npb25UYWJsZTogZHluYW1vZGIuVGFibGU7XG4gIGNvbmZpZ1RhYmxlOiBkeW5hbW9kYi5UYWJsZTtcbiAgcHJlc2V0VGFibGU6IGR5bmFtb2RiLlRhYmxlO1xuICBjb25uZWN0aW9uRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgbWVzc2FnZUZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG4gIGhlYWx0aEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb247XG59XG5cbmV4cG9ydCBjbGFzcyBWaldlYlNvY2tldFN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldEFwaTogYXBpZ2F0ZXdheXYyLldlYlNvY2tldEFwaTtcbiAgcHVibGljIHJlYWRvbmx5IHdlYnNvY2tldFN0YWdlOiBhcGlnYXRld2F5djIuV2ViU29ja2V0U3RhZ2U7XG4gIHB1YmxpYyByZWFkb25seSB3ZWJzb2NrZXRVcmw6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogVmpXZWJTb2NrZXRTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IFxuICAgICAgc3RhZ2UsIFxuICAgICAgc2Vzc2lvblRhYmxlLCBcbiAgICAgIGNvbmZpZ1RhYmxlLCBcbiAgICAgIHByZXNldFRhYmxlLFxuICAgICAgY29ubmVjdGlvbkZ1bmN0aW9uLFxuICAgICAgbWVzc2FnZUZ1bmN0aW9uLFxuICAgICAgaGVhbHRoRnVuY3Rpb25cbiAgICB9ID0gcHJvcHM7XG5cbiAgICAvLyBDcmVhdGUgV2ViU29ja2V0IEFQSVxuICAgIHRoaXMud2Vic29ja2V0QXBpID0gbmV3IGFwaWdhdGV3YXl2Mi5XZWJTb2NrZXRBcGkodGhpcywgJ1ZqV2ViU29ja2V0QXBpJywge1xuICAgICAgYXBpTmFtZTogYHZqLXdlYnNvY2tldC0ke3N0YWdlfWAsXG4gICAgICBkZXNjcmlwdGlvbjogYFZKIEFwcGxpY2F0aW9uIFdlYlNvY2tldCBBUEkgLSAke3N0YWdlfWAsXG4gICAgICBjb25uZWN0Um91dGVPcHRpb25zOiB7XG4gICAgICAgIGludGVncmF0aW9uOiBuZXcgYXBpZ2F0ZXdheXYyX2ludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICAgICAnQ29ubmVjdEludGVncmF0aW9uJyxcbiAgICAgICAgICBjb25uZWN0aW9uRnVuY3Rpb25cbiAgICAgICAgKSxcbiAgICAgIH0sXG4gICAgICBkaXNjb25uZWN0Um91dGVPcHRpb25zOiB7XG4gICAgICAgIGludGVncmF0aW9uOiBuZXcgYXBpZ2F0ZXdheXYyX2ludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICAgICAnRGlzY29ubmVjdEludGVncmF0aW9uJyxcbiAgICAgICAgICBjb25uZWN0aW9uRnVuY3Rpb25cbiAgICAgICAgKSxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Um91dGVPcHRpb25zOiB7XG4gICAgICAgIGludGVncmF0aW9uOiBuZXcgYXBpZ2F0ZXdheXYyX2ludGVncmF0aW9ucy5XZWJTb2NrZXRMYW1iZGFJbnRlZ3JhdGlvbihcbiAgICAgICAgICAnRGVmYXVsdEludGVncmF0aW9uJyxcbiAgICAgICAgICBtZXNzYWdlRnVuY3Rpb25cbiAgICAgICAgKSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY3VzdG9tIHJvdXRlc1xuICAgIHRoaXMud2Vic29ja2V0QXBpLmFkZFJvdXRlKCdwaW5nJywge1xuICAgICAgaW50ZWdyYXRpb246IG5ldyBhcGlnYXRld2F5djJfaW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxuICAgICAgICAnUGluZ0ludGVncmF0aW9uJyxcbiAgICAgICAgbWVzc2FnZUZ1bmN0aW9uXG4gICAgICApLFxuICAgIH0pO1xuXG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJ3N5bmMnLCB7XG4gICAgICBpbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXl2Ml9pbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAgICdTeW5jSW50ZWdyYXRpb24nLFxuICAgICAgICBtZXNzYWdlRnVuY3Rpb25cbiAgICAgICksXG4gICAgfSk7XG5cbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgncHJlc2V0Jywge1xuICAgICAgaW50ZWdyYXRpb246IG5ldyBhcGlnYXRld2F5djJfaW50ZWdyYXRpb25zLldlYlNvY2tldExhbWJkYUludGVncmF0aW9uKFxuICAgICAgICAnUHJlc2V0SW50ZWdyYXRpb24nLFxuICAgICAgICBtZXNzYWdlRnVuY3Rpb25cbiAgICAgICksXG4gICAgfSk7XG5cbiAgICB0aGlzLndlYnNvY2tldEFwaS5hZGRSb3V0ZSgncGVyZm9ybWFuY2UnLCB7XG4gICAgICBpbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXl2Ml9pbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAgICdQZXJmb3JtYW5jZUludGVncmF0aW9uJyxcbiAgICAgICAgbWVzc2FnZUZ1bmN0aW9uXG4gICAgICApLFxuICAgIH0pO1xuXG4gICAgdGhpcy53ZWJzb2NrZXRBcGkuYWRkUm91dGUoJ2NoYXQnLCB7XG4gICAgICBpbnRlZ3JhdGlvbjogbmV3IGFwaWdhdGV3YXl2Ml9pbnRlZ3JhdGlvbnMuV2ViU29ja2V0TGFtYmRhSW50ZWdyYXRpb24oXG4gICAgICAgICdDaGF0SW50ZWdyYXRpb24nLFxuICAgICAgICBtZXNzYWdlRnVuY3Rpb25cbiAgICAgICksXG4gICAgfSk7XG5cbiAgICAvLyBDcmVhdGUgZGVwbG95bWVudCBzdGFnZVxuICAgIHRoaXMud2Vic29ja2V0U3RhZ2UgPSBuZXcgYXBpZ2F0ZXdheXYyLldlYlNvY2tldFN0YWdlKHRoaXMsICdWaldlYlNvY2tldFN0YWdlJywge1xuICAgICAgd2ViU29ja2V0QXBpOiB0aGlzLndlYnNvY2tldEFwaSxcbiAgICAgIHN0YWdlTmFtZTogc3RhZ2UsXG4gICAgICBhdXRvRGVwbG95OiB0cnVlLFxuICAgICAgdGhyb3R0bGU6IHtcbiAgICAgICAgcmF0ZUxpbWl0OiBzdGFnZSA9PT0gJ3Byb2QnID8gMTAwMCA6IDEwMCxcbiAgICAgICAgYnVyc3RMaW1pdDogc3RhZ2UgPT09ICdwcm9kJyA/IDIwMDAgOiAyMDAsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIENsb3VkV2F0Y2ggTG9nIEdyb3VwIGZvciBXZWJTb2NrZXQgQVBJXG4gICAgY29uc3QgbG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCAnV2ViU29ja2V0TG9nR3JvdXAnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2FwaWdhdGV3YXkvd2Vic29ja2V0LyR7dGhpcy53ZWJzb2NrZXRBcGkuYXBpSWR9LyR7c3RhZ2V9YCxcbiAgICAgIHJldGVudGlvbjogc3RhZ2UgPT09ICdwcm9kJyA/IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEggOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhIGZ1bmN0aW9uc1xuICAgIGNvbnN0IHdlYnNvY2tldE1hbmFnZW1lbnRQb2xpY3kgPSBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2V4ZWN1dGUtYXBpOk1hbmFnZUNvbm5lY3Rpb25zJ10sXG4gICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgYGFybjphd3M6ZXhlY3V0ZS1hcGk6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OiR7dGhpcy53ZWJzb2NrZXRBcGkuYXBpSWR9LyR7c3RhZ2V9LypgLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIGNvbm5lY3Rpb25GdW5jdGlvbi5hZGRUb1JvbGVQb2xpY3kod2Vic29ja2V0TWFuYWdlbWVudFBvbGljeSk7XG4gICAgbWVzc2FnZUZ1bmN0aW9uLmFkZFRvUm9sZVBvbGljeSh3ZWJzb2NrZXRNYW5hZ2VtZW50UG9saWN5KTtcblxuICAgIC8vIFVwZGF0ZSBMYW1iZGEgZW52aXJvbm1lbnQgdmFyaWFibGVzIHdpdGggV2ViU29ja2V0IGVuZHBvaW50XG4gICAgY29uc3Qgd2Vic29ja2V0RW5kcG9pbnQgPSBgaHR0cHM6Ly8ke3RoaXMud2Vic29ja2V0QXBpLmFwaUlkfS5leGVjdXRlLWFwaS4ke3RoaXMucmVnaW9ufS5hbWF6b25hd3MuY29tLyR7c3RhZ2V9YDtcbiAgICBcbiAgICBjb25uZWN0aW9uRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ1dFQlNPQ0tFVF9FTkRQT0lOVCcsIHdlYnNvY2tldEVuZHBvaW50KTtcbiAgICBtZXNzYWdlRnVuY3Rpb24uYWRkRW52aXJvbm1lbnQoJ1dFQlNPQ0tFVF9FTkRQT0lOVCcsIHdlYnNvY2tldEVuZHBvaW50KTtcbiAgICBoZWFsdGhGdW5jdGlvbi5hZGRFbnZpcm9ubWVudCgnV0VCU09DS0VUX0VORFBPSU5UJywgd2Vic29ja2V0RW5kcG9pbnQpO1xuXG4gICAgLy8gR3JhbnQgdGFibGUgcGVybWlzc2lvbnNcbiAgICBzZXNzaW9uVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGNvbm5lY3Rpb25GdW5jdGlvbik7XG4gICAgc2Vzc2lvblRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShjb25uZWN0aW9uRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuICAgIGNvbmZpZ1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShoZWFsdGhGdW5jdGlvbik7XG4gICAgcHJlc2V0VGFibGUuZ3JhbnRSZWFkRGF0YShtZXNzYWdlRnVuY3Rpb24pO1xuXG4gICAgLy8gU3RvcmUgV2ViU29ja2V0IFVSTFxuICAgIHRoaXMud2Vic29ja2V0VXJsID0gYHdzczovLyR7dGhpcy53ZWJzb2NrZXRBcGkuYXBpSWR9LmV4ZWN1dGUtYXBpLiR7dGhpcy5yZWdpb259LmFtYXpvbmF3cy5jb20vJHtzdGFnZX1gO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRBcGlJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLndlYnNvY2tldEFwaS5hcGlJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBJRCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnV2ViU29ja2V0VXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMud2Vic29ja2V0VXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdXZWJTb2NrZXQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdXZWJTb2NrZXRFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB3ZWJzb2NrZXRFbmRwb2ludCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IE1hbmFnZW1lbnQgRW5kcG9pbnQnLFxuICAgIH0pO1xuXG4gICAgLy8gVGFnc1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnQ29tcG9uZW50JywgJ1dlYlNvY2tldCcpO1xuICAgIGNkay5UYWdzLm9mKHRoaXMpLmFkZCgnU3RhZ2UnLCBzdGFnZSk7XG4gIH1cbn0iXX0=