// Enhanced logging and monitoring configuration
const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Define log colors
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white'
};

// Add colors to winston
winston.addColors(logColors);

// Create custom format
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Create console format
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Create transports
const transports = [
    // Console transport
    new winston.transports.Console({
        format: consoleFormat,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    
    // File transport for errors
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/error.log'),
        level: 'error',
        format: customFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
        filename: path.join(__dirname, '../logs/combined.log'),
        format: customFormat,
        maxsize: 5242880, // 5MB
        maxFiles: 5
    })
];

// Add additional transports for production
if (process.env.NODE_ENV === 'production') {
    // Add HTTP transport for external logging service
    if (process.env.LOG_WEBHOOK_URL) {
        transports.push(
            new winston.transports.Http({
                host: process.env.LOG_WEBHOOK_URL,
                path: '/logs',
                level: 'error'
            })
        );
    }
    
    // Add file transport for access logs
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '../logs/access.log'),
            level: 'http',
            format: customFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 10
        })
    );
}

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: customFormat,
    transports,
    exitOnError: false
});

// Create stream for Morgan HTTP logger
logger.stream = {
    write: (message) => {
        logger.http(message.trim());
    }
};

// Add request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            userId: req.user?.id || 'anonymous'
        };
        
        if (res.statusCode >= 400) {
            logger.warn('HTTP Request Error', logData);
        } else {
            logger.http('HTTP Request', logData);
        }
    });
    
    next();
};

// Performance monitoring
const performanceMonitor = {
    trackTunnelCreation: (userId, duration, success) => {
        logger.info('Tunnel Creation Performance', {
            userId,
            duration: `${duration}ms`,
            success,
            metric: 'tunnel_creation_time'
        });
    },
    
    trackDataTransfer: (tunnelId, bytes, direction) => {
        logger.info('Data Transfer', {
            tunnelId,
            bytes,
            direction, // 'inbound' or 'outbound'
            metric: 'data_transfer'
        });
    },
    
    trackApiResponse: (endpoint, method, statusCode, duration) => {
        logger.info('API Response Time', {
            endpoint,
            method,
            statusCode,
            duration: `${duration}ms`,
            metric: 'api_response_time'
        });
    },
    
    trackWebSocketConnection: (event, tunnelId, userId) => {
        logger.info('WebSocket Event', {
            event, // 'connect', 'disconnect', 'error'
            tunnelId,
            userId,
            metric: 'websocket_connection'
        });
    }
};

// Error tracking
const errorTracker = {
    trackError: (error, context = {}) => {
        logger.error('Application Error', {
            error: error.message,
            stack: error.stack,
            ...context
        });
    },
    
    trackTunnelError: (tunnelId, error, context = {}) => {
        logger.error('Tunnel Error', {
            tunnelId,
            error: error.message,
            stack: error.stack,
            ...context
        });
    },
    
    trackStripeError: (event, error, context = {}) => {
        logger.error('Stripe Error', {
            event,
            error: error.message,
            stack: error.stack,
            ...context
        });
    }
};

// Metrics collection
const metricsCollector = {
    collect: () => {
        const metrics = {
            timestamp: new Date().toISOString(),
            process: {
                pid: process.pid,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage()
            },
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version
            }
        };
        
        logger.info('System Metrics', metrics);
        return metrics;
    },
    
    startCollection: (intervalMs = 60000) => {
        setInterval(() => {
            metricsCollector.collect();
        }, intervalMs);
    }
};

// Health check logging
const healthCheck = {
    log: (component, status, details = {}) => {
        const logLevel = status === 'healthy' ? 'info' : 'warn';
        logger[logLevel]('Health Check', {
            component,
            status,
            ...details
        });
    }
};

// Security logging
const securityLogger = {
    logAuthAttempt: (email, success, ip, userAgent) => {
        logger.info('Authentication Attempt', {
            email,
            success,
            ip,
            userAgent,
            type: 'auth_attempt'
        });
    },
    
    logSuspiciousActivity: (type, details) => {
        logger.warn('Suspicious Activity', {
            type,
            ...details,
            category: 'security'
        });
    },
    
    logRateLimitExceeded: (ip, endpoint, limit) => {
        logger.warn('Rate Limit Exceeded', {
            ip,
            endpoint,
            limit,
            type: 'rate_limit'
        });
    }
};

module.exports = {
    logger,
    requestLogger,
    performanceMonitor,
    errorTracker,
    metricsCollector,
    healthCheck,
    securityLogger
};
