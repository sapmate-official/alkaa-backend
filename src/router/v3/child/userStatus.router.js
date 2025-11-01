import express from 'express';
import { authenticateToken } from '../../../middleware/auth.middleware.js';
import * as userStatusController from '../../../controller/v3/User/userStatusController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// =====================================================
// USER STATUS MANAGEMENT ROUTES
// =====================================================

// Update user status (activate, suspend, terminate)
router.patch('/:userId/status', userStatusController.updateUserStatus);

// Get user status history
router.get('/:userId/status/history', userStatusController.getUserStatusHistory);

// Reactivate terminated user
router.post('/:userId/reactivate', userStatusController.reactivateUser);

// Get users with pending termination
router.get('/pending-termination', userStatusController.getPendingTerminations);

export default router;
