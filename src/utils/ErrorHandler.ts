import { Notice } from 'obsidian';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export enum ErrorCategory {
    INDEXING_ERROR = 'IndexingError',
    SEARCH_ERROR = 'SearchError',
    STORAGE_ERROR = 'StorageError',
    NETWORK_ERROR = 'NetworkError',
    CONFIG_ERROR = 'ConfigError',
    VALIDATION_ERROR = 'ValidationError'
}

export interface ErrorContext {
    category: ErrorCategory;
    operation: string;
    component: string;
    metadata?: Record<string, unknown>;
    stack?: string;
    timestamp: number;
}

export interface UserFriendlyError {
    message: string;
    suggestion?: string;
    action?: string;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private currentLogLevel: LogLevel = LogLevel.INFO;
    private isDevelopment: boolean;
    private errorCount: Map<ErrorCategory, number> = new Map();

    private constructor() {
        this.isDevelopment = process?.env?.NODE_ENV === 'development';
        this.currentLogLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
    }

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    setLogLevel(level: LogLevel): void {
        this.currentLogLevel = level;
    }

    private shouldLog(level: LogLevel): boolean {
        return level >= this.currentLogLevel;
    }

    private formatLogMessage(level: LogLevel, message: string, context?: Partial<ErrorContext>): string {
        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level];
        const contextStr = context ? ` [${context.component}::${context.operation}]` : '';
        return `[${timestamp}] ${levelStr}${contextStr}: ${message}`;
    }

    debug(message: string, context?: Partial<ErrorContext>): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.debug(this.formatLogMessage(LogLevel.DEBUG, message, context));
        }
    }

    info(message: string, context?: Partial<ErrorContext>): void {
        if (this.shouldLog(LogLevel.INFO)) {
            console.info(this.formatLogMessage(LogLevel.INFO, message, context));
        }
    }

    warn(message: string, context?: Partial<ErrorContext>): void {
        if (this.shouldLog(LogLevel.WARN)) {
            console.warn(this.formatLogMessage(LogLevel.WARN, message, context));
        }
    }

    error(message: string, error?: Error, context?: Partial<ErrorContext>): void {
        const fullContext: ErrorContext = {
            category: context?.category ?? ErrorCategory.INDEXING_ERROR,
            operation: context?.operation ?? 'unknown',
            component: context?.component ?? 'unknown',
            metadata: context?.metadata,
            stack: error?.stack ?? new Error('Stack trace').stack,
            timestamp: Date.now()
        };

        this.incrementErrorCount(fullContext.category);

        if (this.shouldLog(LogLevel.ERROR)) {
            console.error(this.formatLogMessage(LogLevel.ERROR, message, fullContext));
            if (this.isDevelopment && error?.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    }

    private incrementErrorCount(category: ErrorCategory): void {
        const current = this.errorCount.get(category) ?? 0;
        this.errorCount.set(category, current + 1);
    }

    handleError(error: Error, context: Partial<ErrorContext>, userMessage?: UserFriendlyError): void {
        this.error(error.message, error, context);

        if (userMessage) {
            this.notifyUser(userMessage);
        } else {
            const defaultMessage = this.getDefaultUserMessage(context.category ?? ErrorCategory.INDEXING_ERROR);
            this.notifyUser(defaultMessage);
        }
    }

    private getDefaultUserMessage(category: ErrorCategory): UserFriendlyError {
        const messages: Record<ErrorCategory, UserFriendlyError> = {
            [ErrorCategory.INDEXING_ERROR]: {
                message: 'Failed to index content',
                suggestion: 'Check file permissions and try again',
                action: 'Refresh index'
            },
            [ErrorCategory.SEARCH_ERROR]: {
                message: 'Search operation failed',
                suggestion: 'Try a different search term or check your query',
                action: 'Retry search'
            },
            [ErrorCategory.STORAGE_ERROR]: {
                message: 'Storage operation failed',
                suggestion: 'Check available disk space and permissions',
                action: 'Restart plugin'
            },
            [ErrorCategory.NETWORK_ERROR]: {
                message: 'Network request failed',
                suggestion: 'Check your internet connection',
                action: 'Retry operation'
            },
            [ErrorCategory.CONFIG_ERROR]: {
                message: 'Configuration error',
                suggestion: 'Check plugin settings',
                action: 'Reset to defaults'
            },
            [ErrorCategory.VALIDATION_ERROR]: {
                message: 'Invalid input provided',
                suggestion: 'Please check your input format',
                action: 'Try again'
            }
        };
        return messages[category];
    }

    private notifyUser(userMessage: UserFriendlyError): void {
        const noticeMessage = userMessage.suggestion
            ? `${userMessage.message}. ${userMessage.suggestion}`
            : userMessage.message;

        new Notice(noticeMessage, 5000);
    }

    getErrorMetrics(): Record<string, number> {
        return Object.fromEntries(this.errorCount);
    }

    clearMetrics(): void {
        this.errorCount.clear();
    }
}

export const errorHandler = ErrorHandler.getInstance();