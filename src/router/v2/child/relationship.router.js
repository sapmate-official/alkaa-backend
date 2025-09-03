import express from 'express';
import { getUserRelationship } from '../../../controller/v2/relationship/relationship.controller.js';
import validateToken from '../../../middleware/validateToken.js';

const router = express.Router();

// Get relationship with specific user
router.get('/user/:targetUserId', validateToken, getUserRelationship);

// Get general organization relationship
router.get('/organization', validateToken, getUserRelationship);

export default router;
