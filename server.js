import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { allowedOrigins, corsOptions } from './src/util/corsOptions.js'
import { fileURLToPath } from "url"
import path from "path"
import { configDotenv } from 'dotenv'
// import fs from 'fs'
import ServerlessHttp from 'serverless-http'
import { startScheduledJobs } from './src/jobs/scheduler.js'
import { bootstrapPayrollCycleQueue } from './src/jobs/payrollCycleQueue.js'
import { PayrollCycleService } from './src/controller/v3/Payroll/services/payrollCycleService.js'
// import morgan from 'morgan'
// import winston from 'winston'
// import 'winston-daily-rotate-file'
// import WinstonCloudWatch from 'winston-cloudwatch'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

configDotenv()
const app = express()
const port = process.env.PORT || 3000

// Middleware - consolidated to avoid duplicates
app.use(cors(corsOptions))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))       
app.use(cookieParser())

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' })
})

// Handle preflight requests
app.options('*', cors(corsOptions))

// Add in your middleware or authentication-related code
app.use((req, res, next) => {
  if (req.cookies.accessToken) {
    res.clearCookie('accessToken');
    res.cookie('accessToken', req.cookies.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none'  // Change this from 'strict' to 'none' for cross-domain
    });
  }
  next();
});

app.use((req, res, next) => {
  console.log(`Request Method: ${req.method}, Request URL: ${req.url}`);
  next();
}
)

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
import authRouter from './src/router/v1/auth.router.js'

app.use("/api/v1/auth/", authRouter)
app.use("/api/v1/manager/", manager)
app.use("/api/v1/employee/", employee)
app.use("/api/v1/general/", general)
app.use("/api/v1/leave/", leave)
app.use("/api/v1/attendance/", attendance)
app.use("/api/v1/salary/", salary)

import mainV2Router from './src/router/v2/main.router.js'
import mainv3Router from './src/router/v3/main.router.js'
import validateTokenMiddlewear from './src/middleware/validateToken.js'
// import apiService from './src/router/api/main.router.js'

// Conditional middleware that skips validation for specific public routes
app.use("/api/v2/", (req, res, next) => {
  console.log(`V2 Request Method: ${req.method}, Request URL: ${req.url}`);
  // Public routes that don't require authentication
  const publicRoutes = [
    '/onboarding/verify/',
    '/onboarding/submit/',
    '/public/',
    '/super-admin/'
  ];
  
  // Check if the current route starts with any public route
  const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
  
  if (isPublicRoute) {
    // Skip token validation for public routes
    return next();
  }
  
  // Apply token validation for protected routes
  return validateTokenMiddlewear(req, res, next);
  
  if (isPublicRoute) {
    // Skip authentication for public routes
    next();
  } else {
    // Apply authentication for all other routes
    validateTokenMiddlewear(req, res, next);
  }
}, mainV2Router);

app.use("/api/v3/",validateTokenMiddlewear, mainv3Router)
// app.use("/service/api/",apiService)

// Import the bill controllers
import { getBillById, processBillPayment } from './src/controller/v2/superAdmin/superAdmin.controller.js';
// Import the demo request controller
import { sendDemoRequestEmail } from './src/controller/v2/public/public.controller.js';

// Public billing routes
app.get("/api/public/billing/:id", getBillById);
app.post("/api/public/billing/:id/payment", processBillPayment);

// Public demo request route
app.post("/api/public/demo-request", sendDemoRequestEmail);

app.get('/', (req, res) => {
    res.sendFile(path.join(dirname, 'public', 'interface.html'))
})

bootstrapPayrollCycleQueue((job) => PayrollCycleService.processPayrollCycleJob(job))
  .then(() => console.log('Payroll cycle queue ready'))
  .catch((error) => console.error('Failed to bootstrap payroll cycle queue:', error));

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
      // Start the job scheduler
      startScheduledJobs();
  })
}

// Export for serverless
export default ServerlessHttp(app)