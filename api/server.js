import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { allowedOrigins, corsOptions } from './src/util/corsOptions.js'
import { fileURLToPath } from "url"
import path from "path"
import { configDotenv } from 'dotenv'
// import fs from 'fs'
import ServerlessHttp from 'serverless-http'
// import morgan from 'morgan'
// import winston from 'winston'
// import 'winston-daily-rotate-file'
// import WinstonCloudWatch from 'winston-cloudwatch'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

configDotenv()
const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

// Add in your middleware or authentication-related code
app.use((req, res, next) => {
  if (req.cookies.accessToken) {
    res.clearCookie('accessToken');
    res.cookie('accessToken', req.cookies.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      domain: process.env.NODE_ENV === 'production' ? '.alkaa.online' : 'localhost'
    });
  }
  next();
});

const tokenValidationMiddleware = (req, res, next) => {
  next();
};

app.use('/api/v3', tokenValidationMiddleware);

// Static files
app.use('/', express.static(path.join(dirname, 'public')))

// Basic error handling
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
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
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`)
  })
}

// Export for serverless
export default ServerlessHttp(app)