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
exports.EnvironmentValidator = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
class EnvironmentValidator {
    static requiredVariables = [
        {
            name: 'STAGE',
            description: 'Deployment stage (dev/staging/prod)',
            defaultValue: 'dev'
        },
        {
            name: 'CONFIG_TABLE',
            description: 'DynamoDB config table name'
        },
        {
            name: 'PRESET_TABLE',
            description: 'DynamoDB preset table name'
        },
        {
            name: 'SESSION_TABLE',
            description: 'DynamoDB session table name'
        },
        {
            name: 'PRESET_BUCKET',
            description: 'S3 bucket for preset storage'
        },
        {
            name: 'BACKUP_BUCKET',
            description: 'S3 bucket for backups'
        },
        {
            name: 'LOG_LEVEL',
            description: 'Logging level',
            defaultValue: 'INFO'
        },
        {
            name: 'WEBSOCKET_ENDPOINT',
            description: 'WebSocket API endpoint URL'
        }
    ];
    /**
     * Validates that all required environment variables are set
     * @param environment The environment variables object
     * @returns Validated environment object
     */
    static validate(environment) {
        const validated = {};
        const missing = [];
        for (const variable of this.requiredVariables) {
            const value = environment[variable.name] || variable.defaultValue;
            if (!value) {
                missing.push(`${variable.name}: ${variable.description}`);
            }
            else {
                validated[variable.name] = value;
                // Log non-sensitive variables
                if (!variable.sensitive) {
                    console.log(`✓ ${variable.name}: ${value}`);
                }
                else {
                    console.log(`✓ ${variable.name}: [REDACTED]`);
                }
            }
        }
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables:\n${missing.join('\n')}`);
        }
        return validated;
    }
    /**
     * Creates a CloudFormation output for environment validation
     */
    static createValidationOutput(stack, validated) {
        new cdk.CfnOutput(stack, 'EnvironmentValidation', {
            value: JSON.stringify({
                timestamp: new Date().toISOString(),
                stage: validated.STAGE,
                variableCount: Object.keys(validated).length,
                status: 'validated'
            }),
            description: 'Environment validation result'
        });
    }
    /**
     * Generates environment variable documentation
     */
    static generateDocumentation() {
        const docs = ['# Required Environment Variables\n'];
        for (const variable of this.requiredVariables) {
            docs.push(`## ${variable.name}`);
            docs.push(`- Description: ${variable.description}`);
            if (variable.defaultValue) {
                docs.push(`- Default: ${variable.defaultValue}`);
            }
            if (variable.sensitive) {
                docs.push(`- Sensitive: Yes (will be redacted in logs)`);
            }
            docs.push('');
        }
        return docs.join('\n');
    }
}
exports.EnvironmentValidator = EnvironmentValidator;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW52aXJvbm1lbnQtdmFsaWRhdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZW52aXJvbm1lbnQtdmFsaWRhdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBU25DLE1BQWEsb0JBQW9CO0lBQ3ZCLE1BQU0sQ0FBQyxpQkFBaUIsR0FBa0M7UUFDaEU7WUFDRSxJQUFJLEVBQUUsT0FBTztZQUNiLFdBQVcsRUFBRSxxQ0FBcUM7WUFDbEQsWUFBWSxFQUFFLEtBQUs7U0FDcEI7UUFDRDtZQUNFLElBQUksRUFBRSxjQUFjO1lBQ3BCLFdBQVcsRUFBRSw0QkFBNEI7U0FDMUM7UUFDRDtZQUNFLElBQUksRUFBRSxjQUFjO1lBQ3BCLFdBQVcsRUFBRSw0QkFBNEI7U0FDMUM7UUFDRDtZQUNFLElBQUksRUFBRSxlQUFlO1lBQ3JCLFdBQVcsRUFBRSw2QkFBNkI7U0FDM0M7UUFDRDtZQUNFLElBQUksRUFBRSxlQUFlO1lBQ3JCLFdBQVcsRUFBRSw4QkFBOEI7U0FDNUM7UUFDRDtZQUNFLElBQUksRUFBRSxlQUFlO1lBQ3JCLFdBQVcsRUFBRSx1QkFBdUI7U0FDckM7UUFDRDtZQUNFLElBQUksRUFBRSxXQUFXO1lBQ2pCLFdBQVcsRUFBRSxlQUFlO1lBQzVCLFlBQVksRUFBRSxNQUFNO1NBQ3JCO1FBQ0Q7WUFDRSxJQUFJLEVBQUUsb0JBQW9CO1lBQzFCLFdBQVcsRUFBRSw0QkFBNEI7U0FDMUM7S0FDRixDQUFDO0lBRUY7Ozs7T0FJRztJQUNJLE1BQU0sQ0FBQyxRQUFRLENBQUMsV0FBc0M7UUFDM0QsTUFBTSxTQUFTLEdBQThCLEVBQUUsQ0FBQztRQUNoRCxNQUFNLE9BQU8sR0FBYSxFQUFFLENBQUM7UUFFN0IsS0FBSyxNQUFNLFFBQVEsSUFBSSxJQUFJLENBQUMsaUJBQWlCLEVBQUU7WUFDN0MsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxRQUFRLENBQUMsWUFBWSxDQUFDO1lBRWxFLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ1YsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7YUFDM0Q7aUJBQU07Z0JBQ0wsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7Z0JBRWpDLDhCQUE4QjtnQkFDOUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUU7b0JBQ3ZCLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsSUFBSSxLQUFLLEtBQUssRUFBRSxDQUFDLENBQUM7aUJBQzdDO3FCQUFNO29CQUNMLE9BQU8sQ0FBQyxHQUFHLENBQUMsS0FBSyxRQUFRLENBQUMsSUFBSSxjQUFjLENBQUMsQ0FBQztpQkFDL0M7YUFDRjtTQUNGO1FBRUQsSUFBSSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUN0QixNQUFNLElBQUksS0FBSyxDQUNiLDRDQUE0QyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQ2pFLENBQUM7U0FDSDtRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFFRDs7T0FFRztJQUNJLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxLQUFnQixFQUFFLFNBQW9DO1FBQ3pGLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsdUJBQXVCLEVBQUU7WUFDaEQsS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3BCLFNBQVMsRUFBRSxJQUFJLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRTtnQkFDbkMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxLQUFLO2dCQUN0QixhQUFhLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxNQUFNO2dCQUM1QyxNQUFNLEVBQUUsV0FBVzthQUNwQixDQUFDO1lBQ0YsV0FBVyxFQUFFLCtCQUErQjtTQUM3QyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxNQUFNLENBQUMscUJBQXFCO1FBQ2pDLE1BQU0sSUFBSSxHQUFHLENBQUMsb0NBQW9DLENBQUMsQ0FBQztRQUVwRCxLQUFLLE1BQU0sUUFBUSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtZQUM3QyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7WUFDakMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLENBQUM7WUFDcEQsSUFBSSxRQUFRLENBQUMsWUFBWSxFQUFFO2dCQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsUUFBUSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFJLFFBQVEsQ0FBQyxTQUFTLEVBQUU7Z0JBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsNkNBQTZDLENBQUMsQ0FBQzthQUMxRDtZQUNELElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDZjtRQUVELE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN6QixDQUFDOztBQTNHSCxvREE0R0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlcXVpcmVkRW52aXJvbm1lbnRWYXJpYWJsZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgZGVzY3JpcHRpb246IHN0cmluZztcbiAgZGVmYXVsdFZhbHVlPzogc3RyaW5nO1xuICBzZW5zaXRpdmU/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgRW52aXJvbm1lbnRWYWxpZGF0b3Ige1xuICBwcml2YXRlIHN0YXRpYyByZXF1aXJlZFZhcmlhYmxlczogUmVxdWlyZWRFbnZpcm9ubWVudFZhcmlhYmxlW10gPSBbXG4gICAge1xuICAgICAgbmFtZTogJ1NUQUdFJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRGVwbG95bWVudCBzdGFnZSAoZGV2L3N0YWdpbmcvcHJvZCknLFxuICAgICAgZGVmYXVsdFZhbHVlOiAnZGV2J1xuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ0NPTkZJR19UQUJMRScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIGNvbmZpZyB0YWJsZSBuYW1lJ1xuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ1BSRVNFVF9UQUJMRScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0R5bmFtb0RCIHByZXNldCB0YWJsZSBuYW1lJ1xuICAgIH0sXG4gICAge1xuICAgICAgbmFtZTogJ1NFU1NJT05fVEFCTEUnLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBzZXNzaW9uIHRhYmxlIG5hbWUnXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnUFJFU0VUX0JVQ0tFVCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgcHJlc2V0IHN0b3JhZ2UnXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnQkFDS1VQX0JVQ0tFVCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBmb3IgYmFja3VwcydcbiAgICB9LFxuICAgIHtcbiAgICAgIG5hbWU6ICdMT0dfTEVWRUwnLFxuICAgICAgZGVzY3JpcHRpb246ICdMb2dnaW5nIGxldmVsJyxcbiAgICAgIGRlZmF1bHRWYWx1ZTogJ0lORk8nXG4gICAgfSxcbiAgICB7XG4gICAgICBuYW1lOiAnV0VCU09DS0VUX0VORFBPSU5UJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2ViU29ja2V0IEFQSSBlbmRwb2ludCBVUkwnXG4gICAgfVxuICBdO1xuXG4gIC8qKlxuICAgKiBWYWxpZGF0ZXMgdGhhdCBhbGwgcmVxdWlyZWQgZW52aXJvbm1lbnQgdmFyaWFibGVzIGFyZSBzZXRcbiAgICogQHBhcmFtIGVudmlyb25tZW50IFRoZSBlbnZpcm9ubWVudCB2YXJpYWJsZXMgb2JqZWN0XG4gICAqIEByZXR1cm5zIFZhbGlkYXRlZCBlbnZpcm9ubWVudCBvYmplY3RcbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgdmFsaWRhdGUoZW52aXJvbm1lbnQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0pOiB7IFtrZXk6IHN0cmluZ106IHN0cmluZyB9IHtcbiAgICBjb25zdCB2YWxpZGF0ZWQ6IHsgW2tleTogc3RyaW5nXTogc3RyaW5nIH0gPSB7fTtcbiAgICBjb25zdCBtaXNzaW5nOiBzdHJpbmdbXSA9IFtdO1xuXG4gICAgZm9yIChjb25zdCB2YXJpYWJsZSBvZiB0aGlzLnJlcXVpcmVkVmFyaWFibGVzKSB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGVudmlyb25tZW50W3ZhcmlhYmxlLm5hbWVdIHx8IHZhcmlhYmxlLmRlZmF1bHRWYWx1ZTtcbiAgICAgIFxuICAgICAgaWYgKCF2YWx1ZSkge1xuICAgICAgICBtaXNzaW5nLnB1c2goYCR7dmFyaWFibGUubmFtZX06ICR7dmFyaWFibGUuZGVzY3JpcHRpb259YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YWxpZGF0ZWRbdmFyaWFibGUubmFtZV0gPSB2YWx1ZTtcbiAgICAgICAgXG4gICAgICAgIC8vIExvZyBub24tc2Vuc2l0aXZlIHZhcmlhYmxlc1xuICAgICAgICBpZiAoIXZhcmlhYmxlLnNlbnNpdGl2ZSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGDinJMgJHt2YXJpYWJsZS5uYW1lfTogJHt2YWx1ZX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhg4pyTICR7dmFyaWFibGUubmFtZX06IFtSRURBQ1RFRF1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChtaXNzaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYE1pc3NpbmcgcmVxdWlyZWQgZW52aXJvbm1lbnQgdmFyaWFibGVzOlxcbiR7bWlzc2luZy5qb2luKCdcXG4nKX1gXG4gICAgICApO1xuICAgIH1cblxuICAgIHJldHVybiB2YWxpZGF0ZWQ7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIENsb3VkRm9ybWF0aW9uIG91dHB1dCBmb3IgZW52aXJvbm1lbnQgdmFsaWRhdGlvblxuICAgKi9cbiAgcHVibGljIHN0YXRpYyBjcmVhdGVWYWxpZGF0aW9uT3V0cHV0KHN0YWNrOiBjZGsuU3RhY2ssIHZhbGlkYXRlZDogeyBba2V5OiBzdHJpbmddOiBzdHJpbmcgfSk6IHZvaWQge1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHN0YWNrLCAnRW52aXJvbm1lbnRWYWxpZGF0aW9uJywge1xuICAgICAgdmFsdWU6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgdGltZXN0YW1wOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gICAgICAgIHN0YWdlOiB2YWxpZGF0ZWQuU1RBR0UsXG4gICAgICAgIHZhcmlhYmxlQ291bnQ6IE9iamVjdC5rZXlzKHZhbGlkYXRlZCkubGVuZ3RoLFxuICAgICAgICBzdGF0dXM6ICd2YWxpZGF0ZWQnXG4gICAgICB9KSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW52aXJvbm1lbnQgdmFsaWRhdGlvbiByZXN1bHQnXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2VuZXJhdGVzIGVudmlyb25tZW50IHZhcmlhYmxlIGRvY3VtZW50YXRpb25cbiAgICovXG4gIHB1YmxpYyBzdGF0aWMgZ2VuZXJhdGVEb2N1bWVudGF0aW9uKCk6IHN0cmluZyB7XG4gICAgY29uc3QgZG9jcyA9IFsnIyBSZXF1aXJlZCBFbnZpcm9ubWVudCBWYXJpYWJsZXNcXG4nXTtcbiAgICBcbiAgICBmb3IgKGNvbnN0IHZhcmlhYmxlIG9mIHRoaXMucmVxdWlyZWRWYXJpYWJsZXMpIHtcbiAgICAgIGRvY3MucHVzaChgIyMgJHt2YXJpYWJsZS5uYW1lfWApO1xuICAgICAgZG9jcy5wdXNoKGAtIERlc2NyaXB0aW9uOiAke3ZhcmlhYmxlLmRlc2NyaXB0aW9ufWApO1xuICAgICAgaWYgKHZhcmlhYmxlLmRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBkb2NzLnB1c2goYC0gRGVmYXVsdDogJHt2YXJpYWJsZS5kZWZhdWx0VmFsdWV9YCk7XG4gICAgICB9XG4gICAgICBpZiAodmFyaWFibGUuc2Vuc2l0aXZlKSB7XG4gICAgICAgIGRvY3MucHVzaChgLSBTZW5zaXRpdmU6IFllcyAod2lsbCBiZSByZWRhY3RlZCBpbiBsb2dzKWApO1xuICAgICAgfVxuICAgICAgZG9jcy5wdXNoKCcnKTtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGRvY3Muam9pbignXFxuJyk7XG4gIH1cbn0iXX0=