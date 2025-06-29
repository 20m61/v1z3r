/**
 * Production Error Handling and Logging Utilities
 * 
 * This module provides comprehensive error handling, logging, and monitoring
 * capabilities for the VJ application in production environments.
 */

// ログレベルの定義
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

// エラー分類
export enum ErrorCategory {
  AUDIO = 'audio',
  VISUAL = 'visual',
  NETWORK = 'network',
  STORAGE = 'storage',
  USER_INPUT = 'user_input',
  PERMISSION = 'permission',
  PERFORMANCE = 'performance',
  UNKNOWN = 'unknown'
}

// エラー情報の型定義
export interface ErrorInfo {
  category: ErrorCategory
  level: LogLevel
  message: string
  error?: Error
  context?: Record<string, any>
  timestamp: Date
  userAgent?: string
  url?: string
  userId?: string
  sessionId?: string
}

// ログ設定
interface LogConfig {
  level: LogLevel
  enableConsole: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  enablePerformanceMetrics: boolean
  enableUserTracking: boolean
}

class ErrorHandler {
  private config: LogConfig
  private sessionId: string
  private errorCount: number = 0
  private performanceMetrics: Map<string, number[]> = new Map()

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      level: process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
      enableConsole: process.env.NODE_ENV !== 'production',
      enableRemote: process.env.NODE_ENV === 'production',
      remoteEndpoint: process.env.NEXT_PUBLIC_ERROR_ENDPOINT,
      enablePerformanceMetrics: true,
      enableUserTracking: false,
      ...config
    }
    
    this.sessionId = this.generateSessionId()
    this.setupGlobalErrorHandlers()
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window === 'undefined') return

    // キャッチされていないエラーをハンドリング
    window.addEventListener('error', (event) => {
      this.logError({
        category: ErrorCategory.UNKNOWN,
        level: LogLevel.ERROR,
        message: event.message,
        error: event.error,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Promise rejection をハンドリング
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        category: ErrorCategory.UNKNOWN,
        level: LogLevel.ERROR,
        message: 'Unhandled Promise Rejection',
        error: event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        context: {
          type: 'unhandledrejection'
        }
      })
    })
  }

  // メインのログ関数
  public logError(errorInfo: Omit<ErrorInfo, 'timestamp' | 'userAgent' | 'url' | 'sessionId'>): void {
    if (errorInfo.level < this.config.level) return

    const fullErrorInfo: ErrorInfo = {
      ...errorInfo,
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      sessionId: this.sessionId
    }

    this.errorCount++

    // コンソール出力
    if (this.config.enableConsole) {
      this.logToConsole(fullErrorInfo)
    }

    // リモートログ送信
    if (this.config.enableRemote && this.config.remoteEndpoint) {
      this.sendToRemote(fullErrorInfo).catch(console.error)
    }

    // パフォーマンスメトリクス記録
    if (this.config.enablePerformanceMetrics) {
      this.recordMetric(errorInfo.category, errorInfo.level)
    }
  }

  private logToConsole(errorInfo: ErrorInfo): void {
    const prefix = `[${LogLevel[errorInfo.level]}] [${errorInfo.category}]`
    const message = `${prefix} ${errorInfo.message}`
    
    switch (errorInfo.level) {
      case LogLevel.DEBUG:
        console.debug(message, errorInfo.context, errorInfo.error)
        break
      case LogLevel.INFO:
        console.info(message, errorInfo.context)
        break
      case LogLevel.WARN:
        console.warn(message, errorInfo.context, errorInfo.error)
        break
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(message, errorInfo.context, errorInfo.error)
        break
    }
  }

  private async sendToRemote(errorInfo: ErrorInfo): Promise<void> {
    try {
      await fetch(this.config.remoteEndpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...errorInfo,
          error: errorInfo.error ? {
            name: errorInfo.error.name,
            message: errorInfo.error.message,
            stack: errorInfo.error.stack
          } : undefined
        })
      })
    } catch (error) {
      // リモートログ送信に失敗した場合でも、アプリケーションを停止させない
      console.error('Failed to send error to remote endpoint:', error)
    }
  }

  private recordMetric(category: string, level: LogLevel): void {
    const key = `${category}-${LogLevel[level]}`
    const metrics = this.performanceMetrics.get(key) || []
    metrics.push(Date.now())
    
    // 直近100件のみ保持
    if (metrics.length > 100) {
      metrics.shift()
    }
    
    this.performanceMetrics.set(key, metrics)
  }

  // 便利なショートカット関数
  public debug(message: string, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.UNKNOWN,
      level: LogLevel.DEBUG,
      message,
      context
    })
  }

  public info(message: string, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.UNKNOWN,
      level: LogLevel.INFO,
      message,
      context
    })
  }

  public warn(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.UNKNOWN,
      level: LogLevel.WARN,
      message,
      error,
      context
    })
  }

  public error(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.UNKNOWN,
      level: LogLevel.ERROR,
      message,
      error,
      context
    })
  }

  public critical(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.UNKNOWN,
      level: LogLevel.CRITICAL,
      message,
      error,
      context
    })
  }

  // 音声関連のエラー
  public audioError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.AUDIO,
      level: LogLevel.ERROR,
      message,
      error,
      context
    })
  }

  // ビジュアル関連のエラー
  public visualError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.VISUAL,
      level: LogLevel.ERROR,
      message,
      error,
      context
    })
  }

  // ネットワーク関連のエラー
  public networkError(message: string, error?: Error, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.NETWORK,
      level: LogLevel.ERROR,
      message,
      error,
      context
    })
  }

  // パフォーマンス関連のエラー
  public performanceWarning(message: string, context?: Record<string, any>): void {
    this.logError({
      category: ErrorCategory.PERFORMANCE,
      level: LogLevel.WARN,
      message,
      context
    })
  }

  // 統計情報の取得
  public getStats(): {
    errorCount: number
    sessionId: string
    metrics: Record<string, number>
  } {
    const metrics: Record<string, number> = {}
    
    this.performanceMetrics.forEach((values, key) => {
      metrics[key] = values.length
    })

    return {
      errorCount: this.errorCount,
      sessionId: this.sessionId,
      metrics
    }
  }

  // エラーレポートの生成
  public generateReport(): string {
    const stats = this.getStats()
    const now = new Date().toISOString()
    
    return `
VJ Application Error Report
Generated: ${now}
Session ID: ${stats.sessionId}
Total Errors: ${stats.errorCount}

Error Metrics:
${Object.entries(stats.metrics)
  .map(([key, count]) => `  ${key}: ${count}`)
  .join('\n')}

Environment:
  User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
  URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}
  Timestamp: ${now}
    `.trim()
  }
}

// グローバルインスタンス
export const errorHandler = new ErrorHandler()

// React Error Boundary用のヘルパー
export class VJErrorBoundary extends Error {
  constructor(
    message: string,
    public category: ErrorCategory = ErrorCategory.UNKNOWN,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = 'VJErrorBoundary'
  }
}

// 非同期処理のエラーハンドリング用ヘルパー
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  category: ErrorCategory = ErrorCategory.UNKNOWN
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args)
    } catch (error) {
      errorHandler.logError({
        category,
        level: LogLevel.ERROR,
        message: `Error in ${fn.name || 'anonymous function'}`,
        error: error instanceof Error ? error : new Error(String(error)),
        context: { args: args.length > 0 ? args : undefined }
      })
      throw error
    }
  }) as T
}

// デフォルトエクスポート
export default errorHandler