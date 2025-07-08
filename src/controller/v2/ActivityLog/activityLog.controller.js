import prisma from '../../../db/connectDb.js';

/**
 * Get activity logs for managers to view what their subordinates are doing
 * Supports filtering by user, action type, entity type, and date range
 */
export const getActivityLogs = async (req, res) => {
    try {
        const { user } = req;
        const {
            page = 1,
            limit = 50,
            userId,
            action,
            entity,
            startDate,
            endDate,
            targetUserId
        } = req.query;

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Debug logging
        console.log('Prisma client status:', !!prisma);
        console.log('User object:', user);

        // Check user permissions and get orgId
        const userWithRoles = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                orgId: true,
                roles: {
                    select: {
                        role: {
                            select: {
                                permissions: {
                                    select: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!userWithRoles) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check for view all activities permission (for admins)
        const hasViewAllPermission = userWithRoles.roles.some(userRole =>
            userRole.role.permissions.some(permission =>
                permission.permission.key === 'view_all_activities'
            )
        );

        // Check for view subordinate activities permission (for managers)
        const hasViewSubordinatePermission = userWithRoles.roles.some(userRole =>
            userRole.role.permissions.some(permission =>
                permission.permission.key === 'view_subordinate_activities'
            )
        );

        // Base condition - ALWAYS filter by organization first
        let whereCondition = {
            orgId: userWithRoles.orgId,
            AND: []
        };

        // Apply access control based on permissions within the organization
        if (hasViewAllPermission) {
            // Admin can see all activities in the organization
            // No additional user filtering needed
        } else if (hasViewSubordinatePermission) {
            // Manager can see activities of their subordinates within the same org
            const subordinateIds = await prisma.user.findMany({
                where: {
                    managerId: user.id,
                    orgId: userWithRoles.orgId  // Ensure subordinates are from same org
                },
                select: { id: true }
            });

            const subordinateUserIds = subordinateIds.map(sub => sub.id);

            // Include activities where the actor or target is a subordinate
            whereCondition.AND.push({
                OR: [
                    { actorId: { in: subordinateUserIds } },
                    { targetId: { in: subordinateUserIds } }
                ]
            });
        } else {
            // Regular user can only see their own activities
            whereCondition.AND.push({
                OR: [
                    { actorId: user.id },
                    { targetId: user.id }
                ]
            });
        }

        // Apply additional filters
        if (userId) {
            whereCondition.AND.push({ actorId: userId });
        }

        if (targetUserId) {
            whereCondition.AND.push({ targetId: targetUserId });
        }

        if (action) {
            whereCondition.AND.push({ action: action });
        }

        if (entity) {
            whereCondition.AND.push({ entity: entity });
        }

        if (startDate || endDate) {
            const dateCondition = {};
            if (startDate) {
                dateCondition.gte = new Date(startDate);
            }
            if (endDate) {
                dateCondition.lte = new Date(endDate);
            }
            whereCondition.AND.push({ createdAt: dateCondition });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        console.log('About to call prisma.activityLog.count with whereCondition:', JSON.stringify(whereCondition));

        // Get total count for pagination - with error handling
        let totalCount = 0;
        try {
            totalCount = await prisma.activityLog.count({
                where: whereCondition
            });
        } catch (countError) {
            console.error('Error counting activity logs:', countError);
            // Return empty result set if count fails
            return res.status(200).json({
                success: true,
                data: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalCount: 0,
                    totalPages: 0
                }
            });
        }

        // Get activity logs with related user data
        const activityLogs = await prisma.activityLog.findMany({
            where: whereCondition,
            include: {
                actor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                target: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take: parseInt(limit)
        });

        // Format the response
        const formattedLogs = activityLogs.map(log => ({
            id: log.id,
            action: log.action,
            entity: log.entity,
            entityId: log.entityId,
            description: log.description,
            metadata: log.metadata,
            createdAt: log.createdAt,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            actor: {
                id: log.actor.id,
                name: `${log.actor.firstName} ${log.actor.lastName}`.trim(),
                email: log.actor.email,
                employeeId: log.actor.employeeId,
                department: log.actor.department?.name
            },
            target: log.target ? {
                id: log.target.id,
                name: `${log.target.firstName} ${log.target.lastName}`.trim(),
                email: log.target.email,
                employeeId: log.target.employeeId,
                department: log.target.department?.name
            } : null
        }));

        res.status(200).json({
            success: true,
            data: formattedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching activity logs:', error);
        console.error('Error stack:', error.stack);
        console.error('Prisma client at error:', !!prisma);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity logs',
            message: error.message
        });
    }
};

/**
 * Get activity statistics for dashboard
 */
export const getActivityStats = async (req, res) => {
    try {
        const { user } = req;
        const { period = '7d' } = req.query; // 7d, 30d, 90d

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Debug logging
        console.log('getActivityStats - Prisma client status:', !!prisma);
        console.log('getActivityStats - User object:', user);

        // Calculate date range based on period
        const now = new Date();
        let startDate;

        switch (period) {
            case '30d':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case '90d':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default: // 7d
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }

        // Check permissions (same logic as getActivityLogs) and get orgId
        const userWithRoles = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                orgId: true,
                roles: {
                    select: {
                        role: {
                            select: {
                                permissions: {
                                    select: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!userWithRoles) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hasViewAllPermission = userWithRoles?.roles.some(userRole =>
            userRole.role.permissions.some(permission =>
                permission.permission.key === 'view_all_activities'
            )
        );

        const hasViewSubordinatePermission = userWithRoles?.roles.some(userRole =>
            userRole.role.permissions.some(permission =>
                permission.permission.key === 'view_subordinate_activities'
            )
        );

        // Base condition - ALWAYS filter by organization first
        let whereCondition = {
            orgId: userWithRoles.orgId,
            createdAt: {
                gte: startDate
            },
            AND: []
        };

        // Apply access control within the organization
        if (hasViewAllPermission) {
            // Admin can see all activities within the org
        } else if (hasViewSubordinatePermission) {
            const subordinateIds = await prisma.user.findMany({
                where: {
                    managerId: user.id,
                    orgId: userWithRoles.orgId  // Ensure subordinates are from same org
                },
                select: { id: true }
            });

            const subordinateUserIds = subordinateIds.map(sub => sub.id);
            whereCondition.AND.push({
                OR: [
                    { actorId: { in: subordinateUserIds } },
                    { targetId: { in: subordinateUserIds } }
                ]
            });
        } else {
            whereCondition.AND.push({
                OR: [
                    { actorId: user.id },
                    { targetId: user.id }
                ]
            });
        }

        console.log('About to call prisma.activityLog.groupBy for action stats');

        // Get activity counts by action - with error handling
        let actionStats = [];
        try {
            actionStats = await prisma.activityLog.groupBy({
                by: ['action'],
                where: whereCondition,
                _count: {
                    action: true
                },
                orderBy: {
                    _count: {
                        action: 'desc'
                    }
                }
            });
        } catch (actionError) {
            console.error('Error getting action stats:', actionError);
        }

        console.log('About to call prisma.activityLog.groupBy for entity stats');

        // Get activity counts by entity - with error handling
        let entityStats = [];
        try {
            entityStats = await prisma.activityLog.groupBy({
                by: ['entity'],
                where: whereCondition,
                _count: {
                    entity: true
                },
                orderBy: {
                    _count: {
                        entity: 'desc'
                    }
                }
            });
        } catch (entityError) {
            console.error('Error getting entity stats:', entityError);
        }

        // Get daily activity counts for the period (simplified approach)
        const dailyStats = [];

        // Get most active users - with error handling
        let userStats = [];
        try {
            userStats = await prisma.activityLog.groupBy({
                by: ['actorId'],
                where: whereCondition,
                _count: {
                    actorId: true
                },
                orderBy: {
                    _count: {
                        actorId: 'desc'
                    }
                },
                take: 10
            });
        } catch (userError) {
            console.error('Error getting user stats:', userError);
        }

        // Get user details for the most active users - ensure same org
        const userIds = userStats.map(stat => stat.actorId);
        const users = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                orgId: userWithRoles.orgId  // Ensure users are from same org
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                employeeId: true
            }
        });

        const userStatsWithDetails = userStats.map(stat => {
            const userDetail = users.find(u => u.id === stat.actorId);
            return {
                userId: stat.actorId,
                name: userDetail ? `${userDetail.firstName} ${userDetail.lastName}`.trim() : 'Unknown',
                email: userDetail?.email,
                employeeId: userDetail?.employeeId,
                activityCount: stat._count.actorId
            };
        });

        const totalActivities = await prisma.activityLog.count({
            where: whereCondition
        });

        res.status(200).json({
            success: true,
            data: {
                totalActivities,
                period,
                actionStats: actionStats.map(stat => ({
                    action: stat.action,
                    count: stat._count.action
                })),
                entityStats: entityStats.map(stat => ({
                    entity: stat.entity,
                    count: stat._count.entity
                })),
                dailyStats,
                userStats: userStatsWithDetails
            }
        });

    } catch (error) {
        console.error('Error fetching activity statistics:', error);
        console.error('Error stack:', error.stack);
        console.error('Prisma client at error:', !!prisma);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch activity statistics',
            message: error.message
        });
    }
};

/**
 * Get recent activities for a specific user (for profile view)
 */
export const getUserRecentActivities = async (req, res) => {
    try {
        const { user } = req;
        const { targetUserId } = req.params;
        const { limit = 20 } = req.query;

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get user's orgId first
        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { orgId: true }
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if target user exists and is in the same organization
        const targetUser = await prisma.user.findFirst({
            where: {
                id: targetUserId,
                orgId: currentUser.orgId  // Ensure target user is from same org
            }
        });

        if (!targetUser) {
            return res.status(404).json({
                error: 'User not found or not in your organization'
            });
        }

        // Check if user has permission to view target user's activities
        const isOwnActivities = targetUserId === user.id;

        if (!isOwnActivities) {
            // Check if target user is a subordinate
            const isSubordinate = await prisma.user.findFirst({
                where: {
                    id: targetUserId,
                    managerId: user.id,
                    orgId: currentUser.orgId  // Ensure subordinate is from same org
                }
            });

            // Check admin permissions
            const userWithRoles = await prisma.user.findUnique({
                where: { id: user.id },
                include: {
                    roles: {
                        include: {
                            role: {
                                include: {
                                    permissions: {
                                        include: {
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const hasViewAllPermission = userWithRoles?.roles.some(userRole =>
                userRole.role.permissions.some(permission =>
                    permission.permission.key === 'view_all_activities'
                )
            );

            if (!isSubordinate && !hasViewAllPermission) {
                return res.status(403).json({
                    error: 'Access denied. You can only view activities of your subordinates.'
                });
            }
        }

        const activities = await prisma.activityLog.findMany({
            where: {
                orgId: currentUser.orgId,  // Always filter by organization
                OR: [
                    { actorId: targetUserId },
                    { targetId: targetUserId }
                ]
            },
            include: {
                actor: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                target: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            },
            take: parseInt(limit)
        });

        const formattedActivities = activities.map(activity => ({
            id: activity.id,
            action: activity.action,
            entity: activity.entity,
            description: activity.description,
            createdAt: activity.createdAt,
            actor: {
                name: `${activity.actor.firstName} ${activity.actor.lastName}`.trim(),
                email: activity.actor.email,
                isCurrentUser: activity.actorId === targetUserId
            },
            target: activity.target ? {
                name: `${activity.target.firstName} ${activity.target.lastName}`.trim(),
                email: activity.target.email,
                isCurrentUser: activity.targetId === targetUserId
            } : null
        }));

        res.status(200).json({
            success: true,
            data: formattedActivities
        });

    } catch (error) {
        console.error('Error fetching user recent activities:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user activities',
            message: error.message
        });
    }
};

export default {
    getActivityLogs,
    getActivityStats,
    getUserRecentActivities
};