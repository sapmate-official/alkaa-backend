import validateToken from './validateToken.js';

// Export the existing validateToken as authenticateToken for consistency
export const authenticateToken = validateToken;

// Re-export the super admin middleware as well
export { validateSuperAdminTokenMiddleware } from './validateToken.js';

export default validateToken;
