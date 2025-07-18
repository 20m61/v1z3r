import * as cdk from 'aws-cdk-lib';

export interface RequiredEnvironmentVariable {
  name: string;
  description: string;
  defaultValue?: string;
  sensitive?: boolean;
}

export class EnvironmentValidator {
  private static requiredVariables: RequiredEnvironmentVariable[] = [
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
  public static validate(environment: { [key: string]: string }): { [key: string]: string } {
    const validated: { [key: string]: string } = {};
    const missing: string[] = [];

    for (const variable of this.requiredVariables) {
      const value = environment[variable.name] || variable.defaultValue;
      
      if (!value) {
        missing.push(`${variable.name}: ${variable.description}`);
      } else {
        validated[variable.name] = value;
        
        // Log non-sensitive variables
        if (!variable.sensitive) {
          console.log(`✓ ${variable.name}: ${value}`);
        } else {
          console.log(`✓ ${variable.name}: [REDACTED]`);
        }
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables:\n${missing.join('\n')}`
      );
    }

    return validated;
  }

  /**
   * Creates a CloudFormation output for environment validation
   */
  public static createValidationOutput(stack: cdk.Stack, validated: { [key: string]: string }): void {
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
  public static generateDocumentation(): string {
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