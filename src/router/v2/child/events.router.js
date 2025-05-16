import express from 'express';
import { getSpecialEvents } from '../../../controller/v2/SpecialEvents/specialEvents.controller.js';
import validateToken from '../../../middleware/validateToken.js';

const router = express.Router();

// Protected routes requiring authentication
router.use(validateToken);

// Get special events for the logged-in user
router.get('/', getSpecialEvents);

export default router;
