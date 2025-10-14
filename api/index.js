import app from '../server.js'
import serverless from 'serverless-http';

export const handler = serverless(app);
export default app; 