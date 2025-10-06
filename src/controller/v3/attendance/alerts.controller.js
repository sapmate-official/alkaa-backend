import RealTimeAlertService from "../../../services/attendance/RealTimeAlertService.js";
import prisma from "../../../db/connectDb.js";

const alertService = new RealTimeAlertService();

/**
 * Get organization alert configuration
 */
export const getAlertConfiguration = async (req, res) => {
    try {
        const { orgId } = req.params;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const config = await prisma.organizationSettings.findUnique({
            where: { orgId },
            select: { alertConfiguration: true }
        });

        const defaultConfig = {
            enableRealTimeAlerts: false, // Disabled by default
            alertChannels: {
                email: false,
                sms: false,
                push: false,
                dashboard: true
            },
            alertTypes: {
                lateArrival: { enabled: false, threshold: 15 },
                earlyDeparture: { enabled: false, threshold: 15 },
                longBreak: { enabled: false, threshold: 60 },
                geofenceViolation: { enabled: false },
                absenteeism: { enabled: false },
                consecutiveViolations: { enabled: false, threshold: 3 }
            },
            recipients: {
                managers: true,
                hr: true,
                self: true
            },
            quietHours: {
                enabled: false,
                start: "18:00",
                end: "09:00"
            }
        };

        res.status(200).json({
            success: true,
            data: config?.alertConfiguration || defaultConfig
        });
    } catch (error) {
        console.error('Error getting alert configuration:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get alert configuration"
        });
    }
};

/**
 * Update organization alert configuration
 */
export const updateAlertConfiguration = async (req, res) => {
    try {
        const { orgId } = req.params;
        const configuration = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const updatedConfig = await prisma.organizationSettings.upsert({
            where: { orgId },
            update: {
                alertConfiguration: configuration,
                updatedAt: new Date()
            },
            create: {
                orgId,
                alertConfiguration: configuration
            }
        });

        res.status(200).json({
            success: true,
            data: updatedConfig.alertConfiguration,
            message: "Alert configuration updated successfully"
        });
    } catch (error) {
        console.error('Error updating alert configuration:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to update alert configuration"
        });
    }
};

/**
 * Trigger manual alert
 */
export const triggerAlert = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { type, userId, message, severity = 'MEDIUM', metadata } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (!type || !message) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "type and message are required"
            });
        }

        const alertData = {
            type,
            userId: userId || req.user.id,
            message,
            severity,
            metadata: metadata || {},
            triggeredBy: req.user.id
        };

        const alert = await alertService.triggerAlert(alertData);

        res.status(200).json({
            success: true,
            data: alert,
            message: "Alert triggered successfully"
        });
    } catch (error) {
        console.error('Error triggering alert:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to trigger alert"
        });
    }
};

/**
 * Get alerts for organization
 */
export const getOrganizationAlerts = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            userId, 
            type, 
            severity, 
            status,
            fromDate, 
            toDate,
            limit = 50, 
            offset = 0 
        } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const where = {
            user: { orgId }
        };

        if (userId) where.userId = userId;
        if (type) where.type = type;
        if (severity) where.severity = severity;
        if (status) where.status = status;
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate);
            if (toDate) where.createdAt.lte = new Date(toDate);
        }

        const [alerts, total] = await Promise.all([
            prisma.attendanceAlert.findMany({
                where,
                include: {
                    user: {
                        select: { firstName: true, lastName: true, employeeId: true }
                    },
                    acknowledgedByUser: {
                        select: { firstName: true, lastName: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.attendanceAlert.count({ where })
        ]);

        // Calculate summary stats
        const stats = {
            total,
            unread: alerts.filter(a => a.status === 'UNREAD').length,
            acknowledged: alerts.filter(a => a.status === 'ACKNOWLEDGED').length,
            bySeverity: {
                HIGH: alerts.filter(a => a.severity === 'HIGH').length,
                MEDIUM: alerts.filter(a => a.severity === 'MEDIUM').length,
                LOW: alerts.filter(a => a.severity === 'LOW').length
            }
        };

        res.status(200).json({
            success: true,
            data: {
                alerts,
                stats,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        console.error('Error getting organization alerts:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get alerts"
        });
    }
};

/**
 * Get alerts for current user
 */
export const getUserAlerts = async (req, res) => {
    try {
        const { userId } = req.params;
        const { 
            type, 
            status = 'UNREAD',
            limit = 20, 
            offset = 0 
        } = req.query;

        // Users can only access their own alerts or if they're from the same org
        if (req.user.id !== userId) {
            const targetUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { orgId: true }
            });
            
            if (!targetUser || req.user.orgId !== targetUser.orgId) {
                return res.status(403).json({
                    error: "Access denied"
                });
            }
        }

        const where = { userId };
        if (type) where.type = type;
        if (status) where.status = status;

        const [alerts, total] = await Promise.all([
            prisma.attendanceAlert.findMany({
                where,
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.attendanceAlert.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: {
                alerts,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        console.error('Error getting user alerts:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get user alerts"
        });
    }
};

/**
 * Acknowledge alert
 */
export const acknowledgeAlert = async (req, res) => {
    try {
        const { alertId } = req.params;

        const alert = await prisma.attendanceAlert.findUnique({
            where: { id: alertId },
            include: {
                user: { select: { orgId: true } }
            }
        });

        if (!alert) {
            return res.status(404).json({
                error: "Alert not found"
            });
        }

        // Users can acknowledge their own alerts or if they're from same org
        if (req.user.id !== alert.userId && req.user.orgId !== alert.user.orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const updatedAlert = await prisma.attendanceAlert.update({
            where: { id: alertId },
            data: {
                status: 'ACKNOWLEDGED',
                acknowledgedBy: req.user.id,
                acknowledgedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            data: updatedAlert,
            message: "Alert acknowledged successfully"
        });
    } catch (error) {
        console.error('Error acknowledging alert:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to acknowledge alert"
        });
    }
};

/**
 * Bulk acknowledge alerts
 */
export const bulkAcknowledgeAlerts = async (req, res) => {
    try {
        const { alertIds } = req.body;

        if (!Array.isArray(alertIds)) {
            return res.status(400).json({
                error: "Invalid data format",
                message: "alertIds must be an array"
            });
        }

        // Get alerts to verify permissions
        const alerts = await prisma.attendanceAlert.findMany({
            where: { 
                id: { in: alertIds } 
            },
            include: {
                user: { select: { orgId: true } }
            }
        });

        // Filter alerts user has permission to acknowledge
        const allowedAlertIds = alerts
            .filter(alert => 
                req.user.id === alert.userId || 
                req.user.orgId === alert.user.orgId
            )
            .map(alert => alert.id);

        const result = await prisma.attendanceAlert.updateMany({
            where: {
                id: { in: allowedAlertIds },
                status: { not: 'ACKNOWLEDGED' }
            },
            data: {
                status: 'ACKNOWLEDGED',
                acknowledgedBy: req.user.id,
                acknowledgedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            data: {
                acknowledged: result.count,
                requested: alertIds.length
            },
            message: `${result.count} alerts acknowledged successfully`
        });
    } catch (error) {
        console.error('Error bulk acknowledging alerts:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to acknowledge alerts"
        });
    }
};

/**
 * Get alert statistics
 */
export const getAlertStatistics = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { days = 30 } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        const alerts = await prisma.attendanceAlert.findMany({
            where: {
                user: { orgId },
                createdAt: { gte: fromDate }
            },
            include: {
                user: {
                    select: { firstName: true, lastName: true, department: true }
                }
            }
        });

        const stats = {
            totalAlerts: alerts.length,
            byType: {},
            bySeverity: {
                HIGH: 0,
                MEDIUM: 0,
                LOW: 0
            },
            byStatus: {
                UNREAD: 0,
                ACKNOWLEDGED: 0
            },
            byDepartment: {},
            responseTime: {
                average: 0,
                fastest: null,
                slowest: null
            },
            trends: {},
            topEmployees: {}
        };

        let totalResponseTime = 0;
        let responseTimeCount = 0;
        const responseTimes = [];

        alerts.forEach(alert => {
            // Count by type
            if (!stats.byType[alert.type]) {
                stats.byType[alert.type] = 0;
            }
            stats.byType[alert.type]++;

            // Count by severity
            stats.bySeverity[alert.severity]++;

            // Count by status
            stats.byStatus[alert.status]++;

            // Count by department
            const dept = alert.user.department || 'Unassigned';
            if (!stats.byDepartment[dept]) {
                stats.byDepartment[dept] = 0;
            }
            stats.byDepartment[dept]++;

            // Calculate response times
            if (alert.acknowledgedAt) {
                const responseTime = Math.floor((alert.acknowledgedAt - alert.createdAt) / 60000); // minutes
                responseTimes.push(responseTime);
                totalResponseTime += responseTime;
                responseTimeCount++;
            }

            // Daily trends
            const date = alert.createdAt.toISOString().split('T')[0];
            if (!stats.trends[date]) {
                stats.trends[date] = 0;
            }
            stats.trends[date]++;

            // Top employees with most alerts
            const employeeName = `${alert.user.firstName} ${alert.user.lastName}`;
            if (!stats.topEmployees[employeeName]) {
                stats.topEmployees[employeeName] = 0;
            }
            stats.topEmployees[employeeName]++;
        });

        // Calculate response time stats
        if (responseTimes.length > 0) {
            stats.responseTime.average = Math.round(totalResponseTime / responseTimeCount);
            stats.responseTime.fastest = Math.min(...responseTimes);
            stats.responseTime.slowest = Math.max(...responseTimes);
        }

        // Sort top employees
        stats.topEmployees = Object.entries(stats.topEmployees)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .reduce((obj, [name, count]) => {
                obj[name] = count;
                return obj;
            }, {});

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error getting alert statistics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get alert statistics"
        });
    }
};

/**
 * Test alert system
 */
export const testAlertSystem = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { channels = ['dashboard'] } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const testAlert = {
            type: 'SYSTEM_TEST',
            userId: req.user.id,
            message: 'This is a test alert to verify the alert system is working correctly.',
            severity: 'LOW',
            metadata: {
                testChannels: channels,
                triggeredAt: new Date().toISOString()
            },
            triggeredBy: req.user.id
        };

        const alert = await alertService.triggerAlert(testAlert);

        // Simulate sending to different channels
        const channelResults = {
            dashboard: true, // Always works
            email: channels.includes('email') ? 'simulated' : 'skipped',
            sms: channels.includes('sms') ? 'simulated' : 'skipped',
            push: channels.includes('push') ? 'simulated' : 'skipped'
        };

        res.status(200).json({
            success: true,
            data: {
                alert,
                channelResults,
                testCompleted: true
            },
            message: "Alert system test completed successfully"
        });
    } catch (error) {
        console.error('Error testing alert system:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to test alert system"
        });
    }
};

/**
 * Delete old alerts (cleanup)
 */
export const cleanupOldAlerts = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { days = 90 } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

        const result = await prisma.attendanceAlert.deleteMany({
            where: {
                user: { orgId },
                createdAt: { lte: cutoffDate },
                status: 'ACKNOWLEDGED'
            }
        });

        res.status(200).json({
            success: true,
            data: {
                deletedCount: result.count,
                cutoffDate: cutoffDate.toISOString()
            },
            message: `${result.count} old alerts cleaned up successfully`
        });
    } catch (error) {
        console.error('Error cleaning up alerts:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to cleanup alerts"
        });
    }
};
