import { createMiddleware } from "@tanstack/react-start";
import * as os from "os";
import { type ILogObj, Logger } from "tslog";

// Environment detection
const isDevelopment = process.env.NODE_ENV !== "production";
const isTest = process.env.NODE_ENV === "test";

// Application metadata (best practice: include service identification)
const APP_METADATA = {
  service: process.env.SERVICE_NAME || "my-tanstack-start-app",
  version: process.env.npm_package_version || "1.0.0",
  environment: process.env.NODE_ENV || "development",
  hostname: os.hostname,
  platform: os.platform,
  nodeVersion: process.version,
};

// Log levels mapping (production best practice)
const LOG_LEVEL_MAP = {
  development: 2, // debug
  test: 4, // warn
  production: 3, // info
} as const;

/**
 * Production-grade logger configuration with all best practices:
 * - Structured JSON logging in production
 * - Pretty printing in development
 * - Sensitive data masking
 * - Performance tracking
 * - Request correlation
 * - Service metadata
 * - OpenTelemetry compatible
 */
export const logger = new Logger<ILogObj>({
  name: APP_METADATA.service,
  minLevel:
    LOG_LEVEL_MAP[APP_METADATA.environment as keyof typeof LOG_LEVEL_MAP] || 3,

  // Best practice: JSON in production, pretty in dev
  type: isDevelopment ? "pretty" : "json",

  // Pretty formatting for development
  ...(isDevelopment && {
    prettyLogTemplate:
      "{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t[{{name}}]\t",
    prettyErrorTemplate:
      "\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}",
    prettyErrorStackTemplate:
      "  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}",
    stylePrettyLogs: true,
    prettyLogTimeZone: "local",
  }),

  // Best practice: Mask all sensitive data
  maskValuesOfKeys: [
    "password",
    "token",
    "authorization",
    "cookie",
    "secret",
    "api_key",
    "apiKey",
    "access_token",
    "accessToken",
    "refresh_token",
    "refreshToken",
    "session",
    "sessionId",
    "session_id",
    "auth",
    "credentials",
    "credit_card",
    "creditCard",
    "cvv",
    "ssn",
    "private_key",
    "privateKey",
  ],

  // Hide file positions in production for performance
  hideLogPositionForProduction: !isDevelopment,

  // Suppress logs in test environment
  ...(isTest && { type: "hidden" }),
});

/**
 * Request context interface for correlation and tracing
 */
export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string; // OpenTelemetry trace ID
  spanId?: string; // OpenTelemetry span ID
}

/**
 * Best practice: Create child logger with standard metadata
 * Returns a logger with request context attached to all logs
 */
export function createRequestLogger(context: RequestContext) {
  // Create sub-logger with context attached
  const subLogger = logger.getSubLogger({
    name: "request",
  });

  // Attach transport that injects request context into every log
  subLogger.attachTransport((logObj) => {
    // Attach correlation IDs for distributed tracing
    (logObj as any).requestId = context.requestId;
    (logObj as any).traceId = context.traceId;
    (logObj as any).spanId = context.spanId;
    (logObj as any).method = context.method;
    (logObj as any).url = context.url;
    (logObj as any).userAgent = context.userAgent;
    (logObj as any).ip = context.ip;
    (logObj as any).userId = context.userId;
    (logObj as any).sessionId = context.sessionId;
  });

  return subLogger;
}

/**
 * Best practice: Extract correlation IDs from headers
 */
function extractCorrelationIds(request: Request) {
  return {
    // Standard correlation ID patterns
    requestId:
      request.headers.get("x-request-id") ||
      request.headers.get("x-correlation-id") ||
      crypto.randomUUID(),

    // OpenTelemetry standard headers
    traceId: request.headers.get("traceparent")?.split("-")[1] || undefined,
    spanId: request.headers.get("traceparent")?.split("-")[2] || undefined,

    // User context
    userAgent: request.headers.get("user-agent") || undefined,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      undefined,
  };
}

/**
 * Production-grade logging middleware with comprehensive best practices:
 * - Request/response logging
 * - Performance tracking
 * - Error tracking with full context
 * - Correlation IDs for distributed tracing
 * - HTTP metadata (status, method, headers)
 * - Memory and performance metrics
 */
export const loggerMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const { method, url } = request;
    const startTime = Date.now();
    const startMemory = process.memoryUsage();

    // Extract correlation IDs from headers (best practice)
    const correlationIds = extractCorrelationIds(request);

    // Create request-scoped logger with full context
    const requestLogger = createRequestLogger({
      requestId: correlationIds.requestId,
      traceId: correlationIds.traceId,
      spanId: correlationIds.spanId,
      method,
      url,
      userAgent: correlationIds.userAgent,
      ip: correlationIds.ip,
    });

    // Log request start with metadata
    requestLogger.info("Request started", {
      ...APP_METADATA,
      timestamp: new Date().toISOString(),
    });

    try {
      const result = await next();
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();

      // Calculate memory delta
      const memoryDelta = {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        rss: endMemory.rss - startMemory.rss,
      };

      // Best practice: Structured success log with all relevant metadata
      requestLogger.info("Request completed", {
        status: "success",
        duration,
        durationMs: duration,
        performance: {
          durationMs: duration,
          memoryDelta: {
            heapUsedMB: (memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
            rssMB: (memoryDelta.rss / 1024 / 1024).toFixed(2),
          },
        },
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();

      const memoryDelta = {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        rss: endMemory.rss - startMemory.rss,
      };

      // Best practice: Comprehensive error logging with classification
      const errorDetails = {
        status: "error",
        duration,
        durationMs: duration,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : "UnknownError",
          stack: error instanceof Error ? error.stack : undefined,
          // Error classification for monitoring/alerting
          type: error instanceof Error ? error.constructor.name : "Unknown",
          code: (error as any).code,
          statusCode: (error as any).statusCode || (error as any).status,
        },
        performance: {
          durationMs: duration,
          memoryDelta: {
            heapUsedMB: (memoryDelta.heapUsed / 1024 / 1024).toFixed(2),
            rssMB: (memoryDelta.rss / 1024 / 1024).toFixed(2),
          },
        },
        timestamp: new Date().toISOString(),
      };

      requestLogger.error("Request failed", errorDetails);

      throw error;
    }
  }
);

/**
 * Helper to log business events (best practice: separate from request logs)
 */
export function logBusinessEvent(
  event: string,
  data: Record<string, any>,
  level: "info" | "warn" | "error" = "info"
) {
  const eventLogger = logger.getSubLogger({
    name: "business-event",
  });

  eventLogger[level](event, {
    ...data,
    timestamp: new Date().toISOString(),
    ...APP_METADATA,
  });
}

/**
 * Helper to log security events (best practice: track auth/security separately)
 */
export function logSecurityEvent(
  event: string,
  data: {
    userId?: string;
    ip?: string;
    action: string;
    success: boolean;
    reason?: string;
  }
) {
  const securityLogger = logger.getSubLogger({
    name: "security",
  });

  securityLogger.warn(event, {
    ...data,
    timestamp: new Date().toISOString(),
    ...APP_METADATA,
  });
}

/**
 * Helper to log performance metrics (best practice: separate performance logging)
 */
export function logPerformanceMetric(
  metric: string,
  value: number,
  unit: string,
  tags?: Record<string, string>
) {
  const perfLogger = logger.getSubLogger({
    name: "performance",
  });

  perfLogger.debug(metric, {
    metric,
    value,
    unit,
    tags,
    timestamp: new Date().toISOString(),
    ...APP_METADATA,
  });
}
