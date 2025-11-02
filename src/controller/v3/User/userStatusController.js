import prisma from '../../../db/connectDb.js';

/**
 * Update user status (activate, suspend, terminate)
 * @route PATCH /api/v3/users/:userId/status
 */
export const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, terminationDate, reason, notes } = req.body;
        const changedBy = req.user.id;

        // Validate status
        const validStatuses = ['active', 'inactive', 'suspended', 'terminated'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                status: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true
            }
        });

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent self-termination/suspension
        if (changedBy === userId && (status === 'terminated' || status === 'suspended')) {
            return res.status(403).json({
                success: false,
                message: 'You cannot suspend or terminate yourself'
            });
        }

        // Validate termination date
        if (status === 'terminated' && terminationDate) {
            const termDate = new Date(terminationDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (termDate < today) {
                return res.status(400).json({
                    success: false,
                    message: 'Termination date cannot be in the past'
                });
            }
        }

        // Determine if user should be deactivated
        let isActive = true;
        let effectiveDate = new Date();

        if (status === 'terminated') {
            if (terminationDate) {
                const termDate = new Date(terminationDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // If termination date is today or past, deactivate immediately
                if (termDate <= today) {
                    isActive = false;
                    effectiveDate = termDate;
                } else {
                    // Future termination - schedule it
                    effectiveDate = termDate;
                }
            } else {
                // Immediate termination
                isActive = false;
            }
        } else if (status === 'suspended') {
            isActive = false;
        } else if (status === 'active') {
            isActive = true;
        }

        // Update user status
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                status,
                isActive,
                ...(status === 'terminated' && terminationDate ? { terminationDate: new Date(terminationDate) } : {})
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                isActive: true,
                terminationDate: true
            }
        });

        // Create status history entry
        await prisma.userStatusHistory.create({
            data: {
                userId,
                previousStatus: currentUser.status,
                newStatus: status,
                changedBy,
                reason: reason || null,
                notes: notes || null,
                effectiveDate: effectiveDate,
                terminationDate: terminationDate ? new Date(terminationDate) : null
            }
        });

        // Create activity log
        await prisma.activityLog.create({
            data: {
                action: 'UPDATE',
                entity: 'USER',
                entityId: userId,
                description: `User status changed from ${currentUser.status} to ${status}${reason ? ` - Reason: ${reason}` : ''}`,
                actorId: changedBy,
                orgId: req.user.orgId,
                metadata: {
                    previousStatus: currentUser.status,
                    newStatus: status,
                    reason,
                    terminationDate,
                    isActive
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: `User status updated to ${status}`,
            data: updatedUser
        });

    } catch (error) {
        console.error('[USER_STATUS] Error updating user status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update user status',
            error: error.message
        });
    }
};

/**
 * Get user status history
 * @route GET /api/v3/users/:userId/status/history
 */
export const getUserStatusHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const history = await prisma.userStatusHistory.findMany({
            where: { userId },
            include: {
                changedByUser: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true
                    }
                }
            },
            orderBy: { changedAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });

        const total = await prisma.userStatusHistory.count({
            where: { userId }
        });

        return res.status(200).json({
            success: true,
            data: history,
            pagination: {
                total,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: parseInt(offset) + history.length < total
            }
        });

    } catch (error) {
        console.error('[USER_STATUS] Error fetching status history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch status history',
            error: error.message
        });
    }
};

/**
 * Reactivate a terminated user
 * @route POST /api/v3/users/:userId/reactivate
 */
export const reactivateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason, notes } = req.body;
        const changedBy = req.user.id;

        // Get current user
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                status: true,
                firstName: true,
                lastName: true,
                email: true
            }
        });

        if (!currentUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (currentUser.status !== 'terminated') {
            return res.status(400).json({
                success: false,
                message: 'Only terminated users can be reactivated'
            });
        }

        // Reactivate user
        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                status: 'active',
                isActive: true,
                terminationDate: null
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                isActive: true
            }
        });

        // Create status history entry
        await prisma.userStatusHistory.create({
            data: {
                userId,
                previousStatus: 'terminated',
                newStatus: 'active',
                changedBy,
                reason: reason || 'User reactivated',
                notes: notes || null,
                effectiveDate: new Date()
            }
        });

        // Create activity log
        await prisma.activityLog.create({
            data: {
                action: 'UPDATE',
                entity: 'USER',
                entityId: userId,
                description: `User reactivated from terminated to active${reason ? ` - Reason: ${reason}` : ''}`,
                actorId: changedBy,
                orgId: req.user.orgId,
                metadata: {
                    previousStatus: 'terminated',
                    newStatus: 'active',
                    reason,
                    notes
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'User reactivated successfully',
            data: updatedUser
        });

    } catch (error) {
        console.error('[USER_STATUS] Error reactivating user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reactivate user',
            error: error.message
        });
    }
};

/**
 * Get users with pending termination
 * @route GET /api/v3/users/pending-termination
 */
export const getPendingTerminations = async (req, res) => {
    try {
        const { orgId } = req.user;

        const users = await prisma.user.findMany({
            where: {
                orgId,
                status: 'terminated',
                isActive: true,
                terminationDate: {
                    gte: new Date()
                }
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                status: true,
                terminationDate: true,
                employmentType: true
            },
            orderBy: {
                terminationDate: 'asc'
            }
        });

        return res.status(200).json({
            success: true,
            data: users,
            count: users.length
        });

    } catch (error) {
        console.error('[USER_STATUS] Error fetching pending terminations:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending terminations',
            error: error.message
        });
    }
};
