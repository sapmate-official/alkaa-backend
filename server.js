import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { corsOptions } from './src/util/corsOptions.js'
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

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl
  })
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  })
})

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