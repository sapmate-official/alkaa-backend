import prisma from "../../../db/connectDb.js";

/**
 * Create a new employee draft
 */
export const createDraft = async (req, res) => {
  try {
    const { formData, step, orgId, userId } = req.body;

    // Validate required fields
    if (!formData || step === undefined || !orgId || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: formData, step, orgId, userId'
      });
    }

    // Ensure the user belongs to the specified organization
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.orgId !== orgId) {
      return res.status(403).json({
        error: 'User does not belong to the specified organization'
      });
    }

    // Create draft in database
    const draft = await prisma.draft.create({
      data: {
        formData,
        step,
        userId,
        orgId
      }
    });

    return res.status(201).json({
      message: 'Draft created successfully',
      id: draft.id
    });
  } catch (error) {
    console.error('Error creating draft:', error);
    return res.status(500).json({
      error: 'Failed to create draft',
      details: error.message
    });
  }
};

/**
 * Update an existing draft
 */
export const updateDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const { formData, step } = req.body;
    
    // Find the existing draft
    const existingDraft = await prisma.draft.findUnique({
      where: { id }
    });

    // Check if draft exists
    if (!existingDraft) {
      return res.status(404).json({
        error: 'Draft not found'
      });
    }

    // Check if user has permission to update this draft
    if (existingDraft.userId !== req.user.id) {
      return res.status(403).json({
        error: 'You do not have permission to update this draft'
      });
    }

    // Update the draft
    const updatedDraft = await prisma.draft.update({
      where: { id },
      data: {
        formData,
        step,
        updatedAt: new Date()
      }
    });

    return res.status(200).json({
      message: 'Draft updated successfully',
      id: updatedDraft.id
    });
  } catch (error) {
    console.error('Error updating draft:', error);
    return res.status(500).json({
      error: 'Failed to update draft',
      details: error.message
    });
  }
};

/**
 * Get all drafts for the current user
 */
export const getAllDrafts = async (req, res) => {
  try {
    const userId = req.user.id;
    const orgId = req.user.orgId;

    const drafts = await prisma.draft.findMany({
      where: {
        userId,
        orgId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return res.status(200).json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return res.status(500).json({
      error: 'Failed to fetch drafts',
      details: error.message
    });
  }
};

/**
 * Get a specific draft by ID
 */
export const getDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const draft = await prisma.draft.findUnique({
      where: { id }
    });

    // Check if draft exists
    if (!draft) {
      return res.status(404).json({
        error: 'Draft not found'
      });
    }

    // Check if user has permission to access this draft
    if (draft.userId !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to access this draft'
      });
    }

    return res.status(200).json(draft);
  } catch (error) {
    console.error('Error fetching draft:', error);
    return res.status(500).json({
      error: 'Failed to fetch draft',
      details: error.message
    });
  }
};

/**
 * Delete a draft
 */
export const deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the draft
    const draft = await prisma.draft.findUnique({
      where: { id }
    });

    // Check if draft exists
    if (!draft) {
      return res.status(404).json({
        error: 'Draft not found'
      });
    }

    // Check if user has permission to delete this draft
    if (draft.userId !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to delete this draft'
      });
    }

    // Delete the draft
    await prisma.draft.delete({
      where: { id }
    });

    return res.status(200).json({
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return res.status(500).json({
      error: 'Failed to delete draft',
      details: error.message
    });
  }
};