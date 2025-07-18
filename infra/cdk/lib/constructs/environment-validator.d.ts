import * as cdk from 'aws-cdk-lib';
export interface RequiredEnvironmentVariable {
    name: string;
    description: string;
    defaultValue?: string;
    sensitive?: boolean;
}
export declare class EnvironmentValidator {
    private static requiredVariables;
    /**
     * Validates that all required environment variables are set
     * @param environment The environment variables object
     * @returns Validated environment object
     */
    static validate(environment: {
        [key: string]: string;
    }): {
        [key: string]: string;
    };
    /**
     * Creates a CloudFormation output for environment validation
     */
    static createValidationOutput(stack: cdk.Stack, validated: {
        [key: string]: string;
    }): void;
    /**
     * Generates environment variable documentation
     */
    static generateDocumentation(): string;
}
