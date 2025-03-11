import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { allowedOrigins, corsOptions } from './src/util/corsOptions.js'
import { fileURLToPath } from "url"
import path from "path"
import { configDotenv } from 'dotenv'
import fs from 'fs'
import ServerlessHttp from 'serverless-http'
import morgan from 'morgan'
import winston from 'winston'
import 'winston-daily-rotate-file'
// import https from 'https'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

configDotenv()
const app = express()
const port = process.env.PORT || 3000

// Configure logging directory
const logDirectory = path.join(dirname, 'logs')
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory)

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'alkaa-backend' },
  transports: [
    // Write errors to error.log
    new winston.transports.DailyRotateFile({
      filename: path.join(logDirectory, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '30d',
      zippedArchive: true,
    }),
    // Write all logs to combined.log
    new winston.transports.DailyRotateFile({
      filename: path.join(logDirectory, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: true
    }),
  ],
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDirectory, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      zippedArchive: true
    })
  ]
})

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }))
}

// Add this after your existing logger configuration but before middleware definitions

// Create request-response detail logger transport
const detailedTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logDirectory, 'details-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '7d', // Keep for one week
  zippedArchive: true,
  level: 'debug'
});

// Add to existing logger
logger.add(detailedTransport);

// Capture request and response details middleware
app.use((req, res, next) => {
  // Skip logging for static content
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return next();
  }
  
  // Generate unique request ID for correlation
  const reqId = Date.now().toString(36) + Math.random().toString(36).substr(2);
  req.reqId = reqId;
  
  // Capture request details
  const requestDetails = {
    reqId,
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    params: req.params,
    query: req.query,
    headers: req.headers,
    cookies: req.cookies,
    ip: req.ip,
    body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
    // If you have authentication middleware: user: req.user?.id,
  };
  
  // Log request
  logger.debug({ type: 'request', ...requestDetails });
  
  // Intercept the response to capture details
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  let responseBody;
  let responseStartTime = Date.now();
  
  // Override send method
  res.send = function(body) {
    responseBody = body;
    return originalSend.apply(res, arguments);
  };
  
  // Override json method
  res.json = function(body) {
    responseBody = body;
    return originalJson.apply(res, arguments);
  };
  
  // Override end method
  res.end = function(chunk, encoding) {
    // Capture timing information
    const responseTime = Date.now() - responseStartTime;
    
    // If we have a chunk being sent in the end call, save it
    if (chunk && typeof chunk !== 'function') {
      responseBody = chunk;
    }
    
    // Build response log
    const responseDetails = {
      type: 'response',
      reqId,
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.getHeaders(),
      responseTime: responseTime,
      responseSize: responseBody ? 
        (typeof responseBody === 'string' ? responseBody.length : 
          JSON.stringify(responseBody).length) : 0
    };
    
    // Include full response body for errors or specific endpoints
    if (res.statusCode >= 400 || req.path.startsWith('/api')) {
      try {
        responseDetails.body = sanitizeResponseBody(responseBody);
      } catch (err) {
        responseDetails.bodyError = 'Could not capture response body: ' + err.message;
      }
    }
    
    // Log response with appropriate level based on status code
    if (res.statusCode >= 500) {
      logger.error(responseDetails);
    } else if (res.statusCode >= 400) {
      logger.warn(responseDetails);
    } else {
      logger.debug(responseDetails);
    }
    
    return originalEnd.apply(res, arguments);
  };
  
  next();
});

// Sanitize sensitive information from request/response
function sanitizeRequestBody(body) {
  if (!body) return undefined;
  
  // Create deep clone to avoid modifying original
  const sanitized = JSON.parse(JSON.stringify(body));
  
  // Sanitize sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'credit_card'];
  
  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    
    Object.keys(obj).forEach(key => {
      // Check if current key contains sensitive information
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        obj[key] = '[REDACTED]';
      } 
      // Recursively sanitize nested objects
      else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    });
  }
  
  sanitizeObject(sanitized);
  return sanitized;
}

function sanitizeResponseBody(body) {
  if (!body) return undefined;
  
  let parsed;
  try {
    // If it's a string that looks like JSON, parse it
    if (typeof body === 'string') {
      // Check if it looks like JSON
      if ((body.startsWith('{') && body.endsWith('}')) || 
          (body.startsWith('[') && body.endsWith(']'))) {
        parsed = JSON.parse(body);
      } else {
        // For HTML or other string responses, truncate if too long
        return body.length > 1000 ? body.substring(0, 1000) + '... [truncated]' : body;
      }
    } else {
      // If it's already an object, use as is
      parsed = body;
    }
    
    // Sanitize like we did with request
    return sanitizeRequestBody(parsed);
  } catch (e) {
    // If we can't parse or process, return safe representation
    return typeof body === 'string' ? 
      (body.length > 500 ? body.substring(0, 500) + '... [truncated]' : body) : 
      '[Unparseable response]';
  }
}

// Add this to ensure CORS preflight works correctly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', true);
  
  // Handle OPTIONS method
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Morgan HTTP request logger with Winston integration
const morganFormat = process.env.NODE_ENV !== 'production' ? 'dev' : 'combined'
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}))

// Static files
app.use('/', express.static(path.join(dirname, 'public')))

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.http({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip
    })
  })
  next()
})

// Enhanced error handling middleware - update the existing one
app.use((err, req, res, next) => {
  logger.error({
    type: 'error',
    reqId: req.reqId,
    message: err.message,
    name: err.name,
    code: err.code,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: sanitizeRequestBody(req.body),
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    requestId: req.reqId // Include for user to reference in reports
  });
});

// API Routes
import manager from './src/router/v1/manager.router.js'
import employee from './src/router/v1/employee.router.js'
import general from './src/router/v1/general.router.js'
import leave from './src/router/v1/leave.router.js'
import attendance from './src/router/v1/attendance.router.js'
import salary from './src/router/v1/salary.router.js'

app.use("/api/v1/manager/", manager)
app.use("/api/v1/employee/", employee)
app.use("/api/v1/general/", general)
app.use("/api/v1/leave/", leave)
app.use("/api/v1/attendance/", attendance)
app.use("/api/v1/salary/", salary)

import mainV2Router from './src/router/v2/main.router.js'
import mainv3Router from './src/router/v3/main.router.js'
app.use("/api/v2/", mainV2Router)
app.use("/api/v3/", mainv3Router)

app.get('/', (req, res) => {
    res.sendFile(path.join(dirname, 'public', 'interface.html'))
})

// Start server
app.listen(port, '0.0.0.0', () => {
    logger.info(`Server is running on port ${port}`)
})

// Export for serverless
// export const handler = ServerlessHttp(app)