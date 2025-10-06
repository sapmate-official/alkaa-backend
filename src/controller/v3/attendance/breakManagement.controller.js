import BreakManagementService from "../../../services/attendance/BreakManagementService.js";
import prisma from "../../../db/connectDb.js";

const breakService = new BreakManagementService();

/**
 * Start a break for an employee
 */
export const startBreak = async (req, res) => {
    try {
        const { userId } = req.params;
        const { breakType = 'REGULAR', location } = req.body;

        // Verify user has permission (self or manager)
        if (req.user.id !== userId && req.user.orgId !== (await getUserOrg(userId))) {
            return res.status(403).json({
                error: "Access denied",
                message: "You can only start breaks for yourself or employees in your organization"
            });
        }

        // Validate break type
        const validBreakTypes = ['LUNCH', 'TEA', 'REGULAR', 'EMERGENCY', 'PERSONAL'];
        if (!validBreakTypes.includes(breakType.toUpperCase())) {
            return res.status(400).json({
                error: "Invalid break type",
                message: `Break type must be one of: ${validBreakTypes.join(', ')}`
            });
        }

        const result = await breakService.startBreak(userId, breakType, location);

        if (!result.success) {
            return res.status(400).json({
                error: "Break start failed",
                message: result.message,
                details: result.details
            });
        }

        res.status(200).json({
            success: true,
            data: result.breakRecord,
            message: "Break started successfully"
        });
    } catch (error) {
        console.error('Error starting break:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to start break"
        });
    }
};

/**
 * End a break for an employee
 */
export const endBreak = async (req, res) => {
    try {
        const { userId, breakId } = req.params;
        const { location } = req.body;

        // Verify user has permission
        if (req.user.id !== userId && req.user.orgId !== (await getUserOrg(userId))) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const result = await breakService.endBreak(breakId, location);

        if (!result.success) {
            return res.status(400).json({
                error: "Break end failed",
                message: result.message,
                details: result.details
            });
        }

        res.status(200).json({
            success: true,
            data: result.breakRecord,
            message: "Break ended successfully",
            ...(result.violation && { violation: result.violation })
        });
    } catch (error) {
        console.error('Error ending break:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to end break"
        });
    }
};

/**
 * Get active break for an employee
 */
export const getActiveBreak = async (req, res) => {
    try {
        const { userId } = req.params;

        if (req.user.id !== userId && req.user.orgId !== (await getUserOrg(userId))) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const activeBreak = await prisma.breakRecord.findFirst({
            where: {
                userId,
                endTime: null
            },
            orderBy: {
                startTime: 'desc'
            }
        });

        if (!activeBreak) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "No active break found"
            });
        }

        // Calculate current duration
        const currentDuration = Math.floor((new Date() - activeBreak.startTime) / 60000); // in minutes

        res.status(200).json({
            success: true,
            data: {
                ...activeBreak,
                currentDuration: currentDuration,
                isOvertime: currentDuration > 60 // Assuming 60 min max break
            }
        });
    } catch (error) {
        console.error('Error getting active break:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get active break"
        });
    }
};

/**
 * Get break history for an employee
 */
export const getBreakHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            fromDate, 
            toDate, 
            breakType,
            limit = 50, 
            offset = 0 
        } = req.query;

        if (req.user.id !== userId && req.user.orgId !== (await getUserOrg(userId))) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const where = { userId };

        if (breakType) where.breakType = breakType;
        if (fromDate || toDate) {
            where.startTime = {};
            if (fromDate) where.startTime.gte = new Date(fromDate);
            if (toDate) where.startTime.lte = new Date(toDate);
        }

        const [breaks, total] = await Promise.all([
            prisma.breakRecord.findMany({
                where,
                orderBy: {
                    startTime: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.breakRecord.count({ where })
        ]);

        // Calculate analytics
        const analytics = {
            totalBreaks: total,
            averageDuration: 0,
            totalDuration: 0,
            breaksByType: {},
            violationsCount: 0
        };

        if (breaks.length > 0) {
            const completedBreaks = breaks.filter(b => b.endTime);
            const totalMinutes = completedBreaks.reduce((sum, b) => {
                const duration = Math.floor((b.endTime - b.startTime) / 60000);
                return sum + duration;
            }, 0);

            analytics.averageDuration = Math.round(totalMinutes / completedBreaks.length) || 0;
            analytics.totalDuration = totalMinutes;
            analytics.violationsCount = breaks.filter(b => b.hasViolation).length;

            // Group by type
            breaks.forEach(b => {
                if (!analytics.breaksByType[b.breakType]) {
                    analytics.breaksByType[b.breakType] = 0;
                }
                analytics.breaksByType[b.breakType]++;
            });
        }

        res.status(200).json({
            success: true,
            data: {
                breaks,
                analytics,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        console.error('Error getting break history:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get break history"
        });
    }
};

/**
 * Get organization break analytics
 */
export const getOrganizationBreakAnalytics = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { days = 30, department } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        const where = {
            user: { orgId },
            startTime: { gte: fromDate }
        };

        if (department) {
            where.user.department = department;
        }

        const breaks = await prisma.breakRecord.findMany({
            where,
            include: {
                user: {
                    select: { 
                        id: true, 
                        firstName: true, 
                        lastName: true, 
                        department: true 
                    }
                }
            }
        });

        // Calculate comprehensive analytics
        const analytics = {
            totalBreaks: breaks.length,
            totalEmployees: new Set(breaks.map(b => b.userId)).size,
            averageBreaksPerEmployee: 0,
            totalBreakTime: 0,
            averageBreakDuration: 0,
            breaksByType: {},
            breaksByDepartment: {},
            violationRate: 0,
            topBreakTakers: {},
            dailyTrends: {},
            peakBreakHours: {}
        };

        if (breaks.length > 0) {
            let totalMinutes = 0;
            let completedBreaks = 0;
            let violationsCount = 0;

            breaks.forEach(b => {
                // Calculate duration for completed breaks
                if (b.endTime) {
                    const duration = Math.floor((b.endTime - b.startTime) / 60000);
                    totalMinutes += duration;
                    completedBreaks++;
                }

                // Count violations
                if (b.hasViolation) {
                    violationsCount++;
                }

                // Group by type
                if (!analytics.breaksByType[b.breakType]) {
                    analytics.breaksByType[b.breakType] = { count: 0, totalDuration: 0 };
                }
                analytics.breaksByType[b.breakType].count++;
                
                if (b.endTime) {
                    const duration = Math.floor((b.endTime - b.startTime) / 60000);
                    analytics.breaksByType[b.breakType].totalDuration += duration;
                }

                // Group by department
                const dept = b.user.department || 'Unassigned';
                if (!analytics.breaksByDepartment[dept]) {
                    analytics.breaksByDepartment[dept] = 0;
                }
                analytics.breaksByDepartment[dept]++;

                // Track break takers
                const employeeName = `${b.user.firstName} ${b.user.lastName}`;
                if (!analytics.topBreakTakers[employeeName]) {
                    analytics.topBreakTakers[employeeName] = 0;
                }
                analytics.topBreakTakers[employeeName]++;

                // Daily trends
                const date = b.startTime.toISOString().split('T')[0];
                if (!analytics.dailyTrends[date]) {
                    analytics.dailyTrends[date] = 0;
                }
                analytics.dailyTrends[date]++;

                // Peak hours
                const hour = b.startTime.getHours();
                if (!analytics.peakBreakHours[hour]) {
                    analytics.peakBreakHours[hour] = 0;
                }
                analytics.peakBreakHours[hour]++;
            });

            analytics.totalBreakTime = totalMinutes;
            analytics.averageBreakDuration = Math.round(totalMinutes / completedBreaks) || 0;
            analytics.averageBreaksPerEmployee = Math.round(breaks.length / analytics.totalEmployees);
            analytics.violationRate = Math.round((violationsCount / breaks.length) * 100);

            // Sort top break takers
            analytics.topBreakTakers = Object.entries(analytics.topBreakTakers)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .reduce((obj, [name, count]) => {
                    obj[name] = count;
                    return obj;
                }, {});
        }

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting organization break analytics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get break analytics"
        });
    }
};

/**
 * Configure organization break policies
 */
export const configureBreakPolicies = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            maxBreakDuration = 60,
            maxDailyBreaks = 3,
            allowedBreakTypes = ['LUNCH', 'TEA', 'REGULAR'],
            requiresApproval = false,
            restrictedHours = []
        } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Store break policies in organization settings or create a new table
        const policies = await prisma.organizationSettings.upsert({
            where: { orgId },
            update: {
                breakPolicies: {
                    maxBreakDuration,
                    maxDailyBreaks,
                    allowedBreakTypes,
                    requiresApproval,
                    restrictedHours
                },
                updatedAt: new Date()
            },
            create: {
                orgId,
                breakPolicies: {
                    maxBreakDuration,
                    maxDailyBreaks,
                    allowedBreakTypes,
                    requiresApproval,
                    restrictedHours
                }
            }
        });

        res.status(200).json({
            success: true,
            data: policies.breakPolicies,
            message: "Break policies updated successfully"
        });
    } catch (error) {
        console.error('Error configuring break policies:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to configure break policies"
        });
    }
};

/**
 * Get organization break policies
 */
export const getBreakPolicies = async (req, res) => {
    try {
        const { orgId } = req.params;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const settings = await prisma.organizationSettings.findUnique({
            where: { orgId },
            select: { breakPolicies: true }
        });

        const defaultPolicies = {
            maxBreakDuration: 60,
            maxDailyBreaks: 3,
            allowedBreakTypes: ['LUNCH', 'TEA', 'REGULAR'],
            requiresApproval: false,
            restrictedHours: []
        };

        res.status(200).json({
            success: true,
            data: settings?.breakPolicies || defaultPolicies
        });
    } catch (error) {
        console.error('Error getting break policies:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get break policies"
        });
    }
};

/**
 * Force end break (manager action)
 */
export const forceEndBreak = async (req, res) => {
    try {
        const { breakId } = req.params;
        const { reason } = req.body;

        const breakRecord = await prisma.breakRecord.findUnique({
            where: { id: breakId },
            include: {
                user: { select: { orgId: true } }
            }
        });

        if (!breakRecord) {
            return res.status(404).json({
                error: "Break record not found"
            });
        }

        if (req.user.orgId !== breakRecord.user.orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const updatedBreak = await prisma.breakRecord.update({
            where: { id: breakId },
            data: {
                endTime: new Date(),
                forcedEndBy: req.user.id,
                forcedEndReason: reason,
                hasViolation: true
            }
        });

        res.status(200).json({
            success: true,
            data: updatedBreak,
            message: "Break force-ended successfully"
        });
    } catch (error) {
        console.error('Error force ending break:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to force end break"
        });
    }
};

// Helper function to get user organization
async function getUserOrg(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true }
    });
    return user?.orgId;
}
