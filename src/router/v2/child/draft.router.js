import express from 'express';
import {
  createDraft,
  updateDraft,
  getDraft,
  getAllDrafts,
  deleteDraft
} from '../../../controller/v2/EmployeeDraft/draft.controller.js';

const router = express.Router();


// Create a new draft
router.post('/', createDraft);

// Update an existing draft
router.put('/:id', updateDraft);

// Get all drafts for the current user
router.get('/', getAllDrafts);

// Get a specific draft by ID
router.get('/:id', getDraft);

// Delete a draft
router.delete('/:id', deleteDraft);

export default router;