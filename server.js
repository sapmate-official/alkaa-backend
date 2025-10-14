import app from './src/app.js'
import { startScheduledJobs } from './src/jobs/scheduler.js'

const port = process.env.PORT || 3000

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port ${port}`);
      // Start the job scheduler
      startScheduledJobs();
  })
}