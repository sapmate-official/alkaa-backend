import prisma from "../../db/connectDb.js";
// import { io } from "../../socket/socketHandler.js"; // Socket disabled for now

/**
 * Service for managing real-time attendance alerts
 * All alert types are configurable and can be disabled
 */
class RealTimeAlertService {
    constructor() {
        this.alertConfiguration = {
            IMMEDIATE_ALERTS: {
                GEOFENCE_VIOLATION: {
                    trigger: 'location_outside_bounds',
                    recipients: ['employee', 'manager'],
                    channels: ['push', 'email'],
                    priority: 'HIGH',
                    enabled: false // Default disabled
                },
                LATE_ARRIVAL: {
                    trigger: 'check_in_after_threshold',
                    recipients: ['employee', 'manager'],
                    channels: ['push'],
                    priority: 'MEDIUM',
                    enabled: false
                },
                UNAUTHORIZED_BREAK: {
                    trigger: 'break_exceeds_limit',
                    recipients: ['employee', 'supervisor'],
                    channels: ['push', 'sms'],
                    priority: 'HIGH',
                    enabled: false
                },
                EARLY_DEPARTURE: {
                    trigger: 'check_out_before_time',
                    recipients: ['employee', 'manager'],
                    channels: ['push', 'email'],
                    priority: 'MEDIUM',
                    enabled: false
                },
                MISSING_CHECKOUT: {
                    trigger: 'end_of_day_no_checkout',
                    recipients: ['employee', 'manager'],
                    channels: ['push', 'email'],
                    priority: 'MEDIUM',
                    enabled: false
                }
            },
            PERIODIC_ALERTS: {
                ATTENDANCE_SUMMARY: {
                    trigger: 'daily_end',
                    recipients: ['manager', 'hr'],
                    channels: ['email'],
                    priority: 'LOW',
                    enabled: false
                },
                PATTERN_VIOLATION: {
                    trigger: 'weekly_analysis',
                    recipients: ['hr', 'admin'],
                    channels: ['email', 'dashboard'],
                    priority: 'MEDIUM',
                    enabled: false
                },
                COMPLIANCE_REPORT: {
                    trigger: 'monthly_analysis',
                    recipients: ['admin', 'management'],
                    channels: ['email', 'dashboard'],
                    priority: 'LOW',
                    enabled: false
                }
            }
        };

        // Initialize alert queue (would integrate with Redis or similar in production)
        this.alertQueue = [];
    }

    /**
     * Trigger an alert
     * @param {string} alertType - Type of alert
     * @param {Object} data - Alert data
     * @param {Array} recipients - List of recipient user IDs
     * @param {Object} context - Additional context
     * @returns {Object} Alert processing result
     */
    async triggerAlert(alertType, data, recipients, context = {}) {
        try {
            const alertConfig = this.getAlertConfiguration(alertType);
            
            if (!alertConfig || !alertConfig.enabled) {
                return {
                    success: false,
                    reason: 'ALERT_TYPE_DISABLED',
                    message: `Alert type ${alertType} is not enabled`
                };
            }

            const alert = {
                id: this.generateAlertId(),
                type: alertType,
                data: data,
                recipients: recipients,
                timestamp: new Date(),
                priority: alertConfig.priority,
                channels: alertConfig.channels,
                context,
                status: 'PENDING'
            };

            // Save alert to database
            const savedAlert = await this.saveAlert(alert);

            // Add to processing queue
            this.alertQueue.push(alert);

            // Send immediate notifications for high priority alerts
            if (alert.priority === 'HIGH' || alert.priority === 'CRITICAL') {
                await this.sendImmediateNotifications(alert);
            } else {
                // Process in background for lower priority alerts
                this.processAlertAsync(alert);
            }

            return {
                success: true,
                alertId: alert.id,
                alert: savedAlert,
                message: 'Alert triggered successfully'
            };

        } catch (error) {
            console.error('Error triggering alert:', error);
            throw error;
        }
    }

    /**
     * Send immediate notifications for high priority alerts
     * @param {Object} alert - Alert object
     */
    async sendImmediateNotifications(alert) {
        try {
            const notificationPromises = alert.recipients.map(async (recipientId) => {
                // Get recipient details
                const recipient = await this.getRecipientDetails(recipientId);
                if (!recipient) return;

                // Send WebSocket notification
                if (alert.channels.includes('push')) {
                    this.sendWebSocketNotification(recipientId, alert);
                }

                // Send push notification
                if (alert.channels.includes('push') && recipient.pushEnabled) {
                    await this.sendPushNotification(recipient, alert);
                }

                // Send email for critical alerts
                if (alert.channels.includes('email') && 
                    (alert.priority === 'CRITICAL' || alert.priority === 'HIGH')) {
                    await this.sendEmailNotification(recipient, alert);
                }

                // Send SMS for critical alerts (if enabled)
                if (alert.channels.includes('sms') && 
                    alert.priority === 'CRITICAL' && 
                    recipient.smsEnabled) {
                    await this.sendSMSNotification(recipient, alert);
                }
            });

            await Promise.all(notificationPromises);

            // Update alert status
            await this.updateAlertStatus(alert.id, 'SENT');

        } catch (error) {
            console.error('Error sending immediate notifications:', error);
            await this.updateAlertStatus(alert.id, 'FAILED', error.message);
        }
    }

    /**
     * Process alert asynchronously (for lower priority alerts)
     * @param {Object} alert - Alert object
     */
    async processAlertAsync(alert) {
        try {
            // Delay processing for non-critical alerts to batch them
            setTimeout(async () => {
                await this.sendImmediateNotifications(alert);
            }, 5000); // 5 second delay
        } catch (error) {
            console.error('Error processing alert async:', error);
        }
    }

    /**
     * Send WebSocket notification
     * @param {string} recipientId - Recipient user ID
     * @param {Object} alert - Alert object
     */
    sendWebSocketNotification(recipientId, alert) {
        try {
            // WebSocket functionality disabled until socket server is implemented
            console.log(`Would send WebSocket notification to ${recipientId}:`, {
                id: alert.id,
                type: alert.type,
                priority: alert.priority,
                title: this.getAlertTitle(alert.type),
                message: this.getAlertMessage(alert),
                data: alert.data,
                timestamp: alert.timestamp
            });
            
            // TODO: Implement when socket server is ready
            // if (io) {
            //     io.to(recipientId).emit('attendance-alert', {
            //         id: alert.id,
            //         type: alert.type,
            //         priority: alert.priority,
            //         title: this.getAlertTitle(alert.type),
            //         message: this.getAlertMessage(alert),
            //         data: alert.data,
            //         timestamp: alert.timestamp
            //     });
            // }
        } catch (error) {
            console.error('Error sending WebSocket notification:', error);
        }
    }

    /**
     * Send push notification (placeholder - integrate with actual push service)
     * @param {Object} recipient - Recipient details
     * @param {Object} alert - Alert object
     */
    async sendPushNotification(recipient, alert) {
        try {
            // This would integrate with your push notification service
            // (Firebase, OneSignal, etc.)
            console.log(`Sending push notification to ${recipient.email}:`, {
                title: this.getAlertTitle(alert.type),
                body: this.getAlertMessage(alert),
                data: { alertId: alert.id, type: alert.type }
            });

            // Simulate sending push notification
            return true;
        } catch (error) {
            console.error('Error sending push notification:', error);
            return false;
        }
    }

    /**
     * Send email notification (placeholder - integrate with email service)
     * @param {Object} recipient - Recipient details
     * @param {Object} alert - Alert object
     */
    async sendEmailNotification(recipient, alert) {
        try {
            // This would integrate with your email service
            console.log(`Sending email notification to ${recipient.email}:`, {
                subject: this.getAlertTitle(alert.type),
                body: this.getDetailedAlertMessage(alert),
                priority: alert.priority
            });

            // Simulate sending email
            return true;
        } catch (error) {
            console.error('Error sending email notification:', error);
            return false;
        }
    }

    /**
     * Send SMS notification (placeholder - integrate with SMS service)
     * @param {Object} recipient - Recipient details
     * @param {Object} alert - Alert object
     */
    async sendSMSNotification(recipient, alert) {
        try {
            if (!recipient.mobileNumber) return false;

            // This would integrate with your SMS service (Twilio, etc.)
            console.log(`Sending SMS to ${recipient.mobileNumber}:`, {
                message: this.getSMSAlertMessage(alert)
            });

            // Simulate sending SMS
            return true;
        } catch (error) {
            console.error('Error sending SMS notification:', error);
            return false;
        }
    }

    /**
     * Get alert configuration
     * @param {string} alertType - Alert type
     * @returns {Object|null} Alert configuration
     */
    getAlertConfiguration(alertType) {
        // Check immediate alerts
        if (this.alertConfiguration.IMMEDIATE_ALERTS[alertType]) {
            return this.alertConfiguration.IMMEDIATE_ALERTS[alertType];
        }

        // Check periodic alerts
        if (this.alertConfiguration.PERIODIC_ALERTS[alertType]) {
            return this.alertConfiguration.PERIODIC_ALERTS[alertType];
        }

        return null;
    }

    /**
     * Generate alert title based on type
     * @param {string} alertType - Alert type
     * @returns {string} Alert title
     */
    getAlertTitle(alertType) {
        const titles = {
            GEOFENCE_VIOLATION: 'Location Violation Alert',
            LATE_ARRIVAL: 'Late Arrival Notification',
            UNAUTHORIZED_BREAK: 'Break Time Violation',
            EARLY_DEPARTURE: 'Early Departure Alert',
            MISSING_CHECKOUT: 'Missing Check-out',
            ATTENDANCE_SUMMARY: 'Daily Attendance Summary',
            PATTERN_VIOLATION: 'Attendance Pattern Alert',
            COMPLIANCE_REPORT: 'Compliance Report'
        };

        return titles[alertType] || 'Attendance Alert';
    }

    /**
     * Generate alert message
     * @param {Object} alert - Alert object
     * @returns {string} Alert message
     */
    getAlertMessage(alert) {
        const { type, data } = alert;

        switch (type) {
            case 'GEOFENCE_VIOLATION':
                return `Location check failed. You are ${Math.round(data.distance)}m away from the allowed area.`;
            
            case 'LATE_ARRIVAL':
                return `Late arrival detected. You are ${data.lateMinutes} minutes late.`;
            
            case 'UNAUTHORIZED_BREAK':
                return `Break time violation. Break exceeded allowed duration by ${data.excessMinutes} minutes.`;
            
            case 'EARLY_DEPARTURE':
                return `Early departure detected. You left ${data.earlyMinutes} minutes before scheduled time.`;
            
            case 'MISSING_CHECKOUT':
                return 'Please remember to check out before leaving the office.';
            
            default:
                return 'Attendance notification';
        }
    }

    /**
     * Generate detailed alert message for emails
     * @param {Object} alert - Alert object
     * @returns {string} Detailed message
     */
    getDetailedAlertMessage(alert) {
        const baseMessage = this.getAlertMessage(alert);
        const timestamp = alert.timestamp.toLocaleString();
        
        return `${baseMessage}\n\nTime: ${timestamp}\nEmployee: ${alert.data.employeeName || 'Unknown'}\nAlert ID: ${alert.id}`;
    }

    /**
     * Generate SMS alert message (short format)
     * @param {Object} alert - Alert object
     * @returns {string} SMS message
     */
    getSMSAlertMessage(alert) {
        const { type, data } = alert;

        switch (type) {
            case 'GEOFENCE_VIOLATION':
                return `ALERT: Location violation detected. Distance: ${Math.round(data.distance)}m`;
            
            case 'UNAUTHORIZED_BREAK':
                return `ALERT: Break violation. Exceeded by ${data.excessMinutes}min`;
            
            default:
                return 'ALERT: Attendance notification. Please check your app.';
        }
    }

    /**
     * Get recipient details
     * @param {string} recipientId - Recipient user ID
     * @returns {Object|null} Recipient details
     */
    async getRecipientDetails(recipientId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: recipientId },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    mobileNumber: true,
                    // Add notification preferences fields when available
                }
            });

            if (!user) return null;

            return {
                ...user,
                pushEnabled: true, // Would check user preferences
                smsEnabled: true,  // Would check user preferences
                emailEnabled: true // Would check user preferences
            };
        } catch (error) {
            console.error('Error fetching recipient details:', error);
            return null;
        }
    }

    /**
     * Save alert to database
     * @param {Object} alert - Alert object
     * @returns {Object} Saved alert record
     */
    async saveAlert(alert) {
        try {
            // Save alert for each recipient
            const savedAlerts = await Promise.all(
                alert.recipients.map(recipientId => 
                    prisma.attendanceAlert.create({
                        data: {
                            userId: recipientId,
                            alertType: alert.type,
                            priority: alert.priority,
                            message: this.getAlertMessage(alert),
                            data: alert.data,
                            sentChannels: alert.channels
                        }
                    })
                )
            );

            return savedAlerts[0]; // Return first saved alert as representative
        } catch (error) {
            console.error('Error saving alert:', error);
            throw error;
        }
    }

    /**
     * Update alert status
     * @param {string} alertId - Alert ID
     * @param {string} status - New status
     * @param {string} error - Error message if failed
     */
    async updateAlertStatus(alertId, status, error = null) {
        try {
            await prisma.attendanceAlert.updateMany({
                where: {
                    id: alertId
                },
                data: {
                    isSent: status === 'SENT',
                    sentChannels: status === 'SENT' ? undefined : { error }
                }
            });
        } catch (err) {
            console.error('Error updating alert status:', err);
        }
    }

    /**
     * Get alerts for user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Array} User alerts
     */
    async getUserAlerts(userId, options = {}) {
        try {
            const {
                limit = 50,
                unreadOnly = false,
                priority = null,
                days = 7
            } = options;

            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const where = {
                userId,
                createdAt: {
                    gte: fromDate
                }
            };

            if (unreadOnly) {
                where.isRead = false;
            }

            if (priority) {
                where.priority = priority;
            }

            return await prisma.attendanceAlert.findMany({
                where,
                orderBy: {
                    createdAt: 'desc'
                },
                take: limit
            });
        } catch (error) {
            console.error('Error fetching user alerts:', error);
            return [];
        }
    }

    /**
     * Mark alert as read
     * @param {string} alertId - Alert ID
     * @param {string} userId - User ID
     * @returns {Object} Update result
     */
    async markAlertAsRead(alertId, userId) {
        try {
            const updatedAlert = await prisma.attendanceAlert.updateMany({
                where: {
                    id: alertId,
                    userId
                },
                data: {
                    isRead: true,
                    readAt: new Date()
                }
            });

            return {
                success: updatedAlert.count > 0,
                message: updatedAlert.count > 0 ? 'Alert marked as read' : 'Alert not found'
            };
        } catch (error) {
            console.error('Error marking alert as read:', error);
            throw error;
        }
    }

    /**
     * Get alert statistics
     * @param {string} orgId - Organization ID
     * @param {number} days - Number of days to analyze
     * @returns {Object} Alert statistics
     */
    async getAlertStatistics(orgId, days = 30) {
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const alerts = await prisma.attendanceAlert.findMany({
                where: {
                    user: {
                        orgId
                    },
                    createdAt: {
                        gte: fromDate
                    }
                },
                include: {
                    user: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            });

            const stats = {
                totalAlerts: alerts.length,
                byPriority: {},
                byType: {},
                byUser: {},
                readRate: 0,
                responseTime: {
                    average: 0,
                    fastest: null,
                    slowest: null
                }
            };

            let totalReadTime = 0;
            let readCount = 0;

            alerts.forEach(alert => {
                // Group by priority
                if (!stats.byPriority[alert.priority]) {
                    stats.byPriority[alert.priority] = 0;
                }
                stats.byPriority[alert.priority]++;

                // Group by type
                if (!stats.byType[alert.alertType]) {
                    stats.byType[alert.alertType] = 0;
                }
                stats.byType[alert.alertType]++;

                // Group by user
                const userName = `${alert.user.firstName} ${alert.user.lastName}`;
                if (!stats.byUser[userName]) {
                    stats.byUser[userName] = 0;
                }
                stats.byUser[userName]++;

                // Calculate read statistics
                if (alert.isRead && alert.readAt) {
                    readCount++;
                    const readTime = new Date(alert.readAt) - new Date(alert.createdAt);
                    totalReadTime += readTime;

                    if (!stats.responseTime.fastest || readTime < stats.responseTime.fastest) {
                        stats.responseTime.fastest = readTime;
                    }
                    if (!stats.responseTime.slowest || readTime > stats.responseTime.slowest) {
                        stats.responseTime.slowest = readTime;
                    }
                }
            });

            stats.readRate = alerts.length > 0 ? Math.round((readCount / alerts.length) * 100) : 0;
            stats.responseTime.average = readCount > 0 ? totalReadTime / readCount : 0;

            return stats;
        } catch (error) {
            console.error('Error getting alert statistics:', error);
            return {};
        }
    }

    /**
     * Generate unique alert ID
     * @returns {string} Unique alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Configure organization alert settings
     * @param {string} orgId - Organization ID
     * @param {Object} alertSettings - Alert configuration
     * @returns {Object} Update result
     */
    async configureOrganizationAlerts(orgId, alertSettings) {
        try {
            // Update organization settings with alert configuration
            const settings = await prisma.organizationSettings.findFirst({
                where: { orgId }
            });

            if (settings) {
                await prisma.organizationSettings.update({
                    where: { id: settings.id },
                    data: {
                        settings: {
                            ...settings.settings,
                            alertConfiguration: alertSettings
                        }
                    }
                });
            } else {
                await prisma.organizationSettings.create({
                    data: {
                        orgId,
                        settings: {
                            alertConfiguration: alertSettings
                        }
                    }
                });
            }

            return {
                success: true,
                message: 'Alert configuration updated successfully'
            };
        } catch (error) {
            console.error('Error configuring organization alerts:', error);
            throw error;
        }
    }
}

export default RealTimeAlertService;
