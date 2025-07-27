# 認証設定ガイド

## 概要
Lambda関数で適切な認証を実装するため、AWS Cognito User Poolを使用した認証システムの設定手順です。

## 実装済みの変更
Lambda関数（`infra/cdk/lambda/preset/preset.js`）では、以下の認証実装が完了しています：

```javascript
// ユーザーIDの取得
const userId = requestContext?.authorizer?.claims?.sub || 
              requestContext?.authorizer?.principalId || 
              'anonymous';

// 本番環境での認証チェック
if (userId === 'anonymous' && process.env.ENVIRONMENT === 'production') {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Authentication required' })
  };
}
```

## CDKスタックへの認証設定追加

### 1. Cognito User Poolの作成

`infra/cdk/lib/stacks/vj-auth-stack.ts`を新規作成：

```typescript
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class VjAuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // User Poolの作成
    this.userPool = new cognito.UserPool(this, 'VjUserPool', {
      userPoolName: 'vj-app-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // User Pool Clientの作成
    this.userPoolClient = new cognito.UserPoolClient(this, 'VjUserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'http://localhost:3000/callback',
          'https://your-domain.com/callback', // 本番環境のURL
        ],
        logoutUrls: [
          'http://localhost:3000',
          'https://your-domain.com',
        ],
      },
    });

    // Outputの定義
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: 'VjUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: 'VjUserPoolClientId',
    });
  }
}
```

### 2. API Gatewayへの認証設定

`infra/cdk/lib/stacks/vj-api-stack.ts`を更新：

```typescript
// Cognito Authorizerの追加
const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'VjAuthorizer', {
  cognitoUserPools: [userPool],
  authorizerName: 'VjCognitoAuthorizer',
});

// Lambda統合に認証を追加
const presetIntegration = new apigateway.LambdaIntegration(presetFunction, {
  requestTemplates: {
    'application/json': '{ "statusCode": "200" }'
  }
});

// APIリソースに認証を設定
const presetResource = api.root.addResource('presets');
presetResource.addMethod('GET', presetIntegration, {
  authorizer: authorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO,
});
```

### 3. Lambda環境変数の更新

```typescript
const presetFunction = new lambda.Function(this, 'PresetFunction', {
  // ... 他の設定
  environment: {
    PRESET_TABLE_NAME: presetTable.tableName,
    ENVIRONMENT: props.environment || 'development',
    CORS_ORIGIN: props.corsOrigin || '*',
  },
});
```

## フロントエンドの認証実装

### 1. AWS Amplifyのインストール

```bash
npm install aws-amplify @aws-amplify/ui-react
```

### 2. 認証コンポーネントの作成

`src/components/Auth/AuthProvider.tsx`:

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Amplify, Auth } from 'aws-amplify';
import { CognitoUser } from '@aws-amplify/auth';

// Amplify設定
Amplify.configure({
  Auth: {
    region: process.env.NEXT_PUBLIC_AWS_REGION,
    userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
    userPoolWebClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
  },
});

interface AuthContextType {
  user: CognitoUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const user = await Auth.signIn(email, password);
    setUser(user);
    setIsAuthenticated(true);
  };

  const signUp = async (email: string, password: string) => {
    await Auth.signUp({
      username: email,
      password,
      attributes: { email },
    });
  };

  const signOut = async () => {
    await Auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, signIn, signUp, signOut, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### 3. APIリクエストへの認証トークン追加

`src/services/api.ts`:

```typescript
import { Auth } from 'aws-amplify';

export const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
  try {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // 開発環境では認証なしでリクエスト
    if (process.env.NODE_ENV === 'development') {
      return fetch(url, options);
    }
    throw error;
  }
};
```

## 環境変数の設定

### `.env.local`:
```
NEXT_PUBLIC_AWS_REGION=ap-northeast-1
NEXT_PUBLIC_USER_POOL_ID=<User Pool ID>
NEXT_PUBLIC_USER_POOL_CLIENT_ID=<User Pool Client ID>
NEXT_PUBLIC_API_ENDPOINT=<API Gateway URL>
```

## デプロイ手順

1. 認証スタックのデプロイ：
```bash
cd infra/cdk
cdk deploy VjAuthStack
```

2. APIスタックの更新：
```bash
cdk deploy VjApiStack
```

3. フロントエンドの環境変数を更新して再デプロイ

## セキュリティベストプラクティス

1. **トークンの安全な管理**
   - トークンをローカルストレージに保存しない
   - セキュアなHTTPOnlyクッキーの使用を検討

2. **CORS設定**
   - 本番環境では特定のドメインのみ許可
   - 開発環境と本番環境で異なる設定

3. **レート制限**
   - API Gatewayでスロットリング設定
   - DDoS攻撃への対策

4. **監査ログ**
   - CloudTrailで認証イベントを記録
   - 不審なアクセスパターンの検知

## トラブルシューティング

### 認証エラーが発生する場合
1. Cognito User Poolの設定確認
2. API Gatewayの認証設定確認
3. CORSヘッダーの確認
4. トークンの有効期限確認

### 開発環境での認証スキップ
開発環境では`ENVIRONMENT=development`を設定することで、認証をスキップできます。

## 更新履歴
- 2025-07-05: 初版作成