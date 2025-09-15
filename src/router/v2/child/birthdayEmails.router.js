import express from 'express';
import { testBirthdayEmails, getBirthdayEmailLogs } from '../../../controller/v2/BirthdayEmails/birthdayEmails.controller.js';

const router = express.Router();

// Test birthday email functionality (Admin only)
router.post('/test', testBirthdayEmails);

// Get birthday email logs for monitoring (Admin only)
router.get('/logs', getBirthdayEmailLogs);

export default router;