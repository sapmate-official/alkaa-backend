import express from 'express';
import { authenticateToken } from '../../../middleware/auth.middleware.js';
import * as employmentTypePolicyController from '../../../controller/v3/EmploymentType/employmentTypePolicyController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// =====================================================
// EMPLOYMENT TYPE POLICY ROUTES
// =====================================================

// Get all employment type policies for an organization
router.get('/organizations/:orgId/policies', employmentTypePolicyController.getOrganizationPolicies);

// Get specific employment type policy
router.get('/organizations/:orgId/policies/:employmentType', employmentTypePolicyController.getPolicyByType);

// Create or update employment type policy
router.post('/organizations/:orgId/policies/:employmentType', employmentTypePolicyController.createOrUpdatePolicy);

// Delete employment type policy
router.delete('/organizations/:orgId/policies/:employmentType', employmentTypePolicyController.deletePolicy);

// Get employees by employment type
router.get('/organizations/:orgId/employees/:employmentType', employmentTypePolicyController.getEmployeesByType);

// Update user employment type
router.patch('/users/:userId/employment-type', employmentTypePolicyController.updateUserEmploymentType);

// Get expiring contracts for organization
router.get('/organizations/:orgId/expiring-contracts', employmentTypePolicyController.getExpiringContracts);

// Get user's employment type rules summary
router.get('/organizations/:orgId/users/:userId/rules-summary', employmentTypePolicyController.getUserRulesSummary);

export default router;
