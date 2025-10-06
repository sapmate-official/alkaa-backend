import prisma from "../../db/connectDb.js";

/**
 * Service for managing employee break times and violations
 * All break rules are disabled by default
 */
class BreakManagementService {
    constructor() {
        this.defaultBreakConfiguration = {
            LUNCH: {
                isActive: false, // Default to disabled
                maxDuration: 60, // minutes
                timeWindow: { start: "12:00", end: "15:00" },
                mandatory: true,
                allowOvertime: false,
                overtimePenalty: 0.5 // percentage per minute
            },
            TEA_BREAK: {
                isActive: false,
                maxDuration: 15,
                maxFrequency: 2, // per day
                timeRestrictions: ["10:00-11:00", "15:00-16:00"],
                mandatory: false
            },
            PERSONAL: {
                isActive: false,
                maxDuration: 10,
                maxFrequency: 3,
                totalDailyLimit: 30,
                requiresApproval: false
            },
            MEDICAL: {
                isActive: false,
                maxDuration: 30,
                requiresApproval: true,
                documentation: true,
                noDeduction: true
            }
        };
    }

    /**
     * Get organization break rules
     * @param {string} orgId - Organization ID
     * @returns {Object} Break rules configuration
     */
    async getOrganizationBreakRules(orgId) {
        try {
            const rules = await prisma.organizationBreakRules.findMany({
                where: { orgId, isActive: true },
                orderBy: { createdAt: 'desc' }
            });

            const organizedRules = {};
            rules.forEach(rule => {
                organizedRules[rule.breakType] = {
                    id: rule.id,
                    maxDuration: rule.maxDuration,
                    maxFrequency: rule.maxFrequency,
                    timeWindow: rule.timeWindow,
                    mandatory: rule.mandatory,
                    requiresApproval: rule.requiresApproval,
                    penaltyPerMinute: rule.penaltyPerMinute,
                    isActive: rule.isActive
                };
            });

            // Merge with defaults
            return { ...this.defaultBreakConfiguration, ...organizedRules };
        } catch (error) {
            console.error('Error fetching break rules:', error);
            return this.defaultBreakConfiguration;
        }
    }

    /**
     * Create or update break rule for organization
     * @param {string} orgId - Organization ID
     * @param {string} breakType - Break type
     * @param {Object} ruleConfig - Rule configuration
     * @returns {Object} Created/updated rule
     */
    async createOrUpdateBreakRule(orgId, breakType, ruleConfig) {
        try {
            const {
                maxDuration,
                maxFrequency,
                timeWindow,
                mandatory = false,
                requiresApproval = false,
                penaltyPerMinute,
                isActive = false // Default to disabled
            } = ruleConfig;

            return await prisma.organizationBreakRules.upsert({
                where: {
                    orgId_breakType: {
                        orgId,
                        breakType
                    }
                },
                update: {
                    maxDuration,
                    maxFrequency,
                    timeWindow,
                    mandatory,
                    requiresApproval,
                    penaltyPerMinute,
                    isActive,
                    updatedAt: new Date()
                },
                create: {
                    orgId,
                    breakType,
                    maxDuration,
                    maxFrequency,
                    timeWindow,
                    mandatory,
                    requiresApproval,
                    penaltyPerMinute,
                    isActive
                }
            });
        } catch (error) {
            console.error('Error creating/updating break rule:', error);
            throw error;
        }
    }

    /**
     * Start a break for user
     * @param {string} userId - User ID
     * @param {string} breakType - Type of break
     * @param {string} note - Optional note
     * @param {string|null} attendanceId - Associated attendance record ID
     * @returns {Object} Break record
     */
    async startBreak(userId, breakType, note = '', attendanceId = null) {
        try {
            // Get user's organization
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { orgId: true }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Validate break eligibility
            const validation = await this.validateBreakStart(userId, breakType, user.orgId);
            if (!validation.valid) {
                throw new Error(validation.reason);
            }

            // End current active work session if exists
            await this.endCurrentWorkSession(userId);

            // Create break record
            const breakRecord = await prisma.breakRecord.create({
                data: {
                    userId,
                    attendanceId,
                    breakType,
                    startTime: new Date(),
                    note,
                    status: 'ACTIVE'
                },
                include: {
                    user: {
                        select: { firstName: true, lastName: true, orgId: true }
                    }
                }
            });

            return {
                success: true,
                breakRecord,
                message: `${breakType} break started successfully`
            };

        } catch (error) {
            console.error('Error starting break:', error);
            throw error;
        }
    }

    /**
     * End a break
     * @param {string} breakId - Break record ID
     * @param {string} note - Optional end note
     * @returns {Object} Updated break record with violation info
     */
    async endBreak(breakId, note = '') {
        try {
            const breakRecord = await prisma.breakRecord.findUnique({
                where: { id: breakId },
                include: {
                    user: {
                        select: { orgId: true }
                    }
                }
            });

            if (!breakRecord) {
                throw new Error('Break record not found');
            }

            if (breakRecord.status !== 'ACTIVE') {
                throw new Error('Break is not currently active');
            }

            const endTime = new Date();
            const duration = this.calculateBreakDuration(breakRecord.startTime, endTime);
            const violation = await this.checkBreakViolation(breakRecord, duration);

            // Update break record
            const updatedBreak = await prisma.breakRecord.update({
                where: { id: breakId },
                data: {
                    endTime,
                    duration: {
                        minutes: duration.minutes,
                        hours: duration.hours,
                        startTime: breakRecord.startTime,
                        endTime
                    },
                    status: 'COMPLETED',
                    note: `${breakRecord.note || ''} ${note}`.trim(),
                    violation: violation.hasViolation ? violation : null
                },
                include: {
                    user: {
                        select: { firstName: true, lastName: true }
                    }
                }
            });

            // Start new work session
            await this.startNewWorkSession(breakRecord.userId);

            return {
                success: true,
                breakRecord: updatedBreak,
                duration,
                violation,
                message: `Break ended successfully. Duration: ${duration.minutes} minutes`
            };

        } catch (error) {
            console.error('Error ending break:', error);
            throw error;
        }
    }

    /**
     * Get current active break for user
     * @param {string} userId - User ID
     * @returns {Object|null} Current break record or null
     */
    async getCurrentBreak(userId) {
        try {
            return await prisma.breakRecord.findFirst({
                where: {
                    userId,
                    status: 'ACTIVE'
                },
                orderBy: {
                    startTime: 'desc'
                }
            });
        } catch (error) {
            console.error('Error fetching current break:', error);
            return null;
        }
    }

    /**
     * Validate if user can start a break
     * @param {string} userId - User ID
     * @param {string} breakType - Break type
     * @param {string} orgId - Organization ID
     * @returns {Object} Validation result
     */
    async validateBreakStart(userId, breakType, orgId) {
        try {
            // Check if user already has an active break
            const activeBreak = await this.getCurrentBreak(userId);
            if (activeBreak) {
                return {
                    valid: false,
                    reason: 'User already has an active break'
                };
            }

            // Get organization break rules
            const breakRules = await this.getOrganizationBreakRules(orgId);
            const rule = breakRules[breakType];

            if (!rule || !rule.isActive) {
                return {
                    valid: false,
                    reason: `${breakType} breaks are not enabled for this organization`
                };
            }

            // Check frequency limits for today
            if (rule.maxFrequency) {
                const todayBreaks = await this.getTodayBreaksCount(userId, breakType);
                if (todayBreaks >= rule.maxFrequency) {
                    return {
                        valid: false,
                        reason: `Daily limit of ${rule.maxFrequency} ${breakType} breaks exceeded`
                    };
                }
            }

            // Check total daily time limit
            if (rule.totalDailyLimit) {
                const todayBreakTime = await this.getTodayBreakTime(userId, breakType);
                if (todayBreakTime >= rule.totalDailyLimit) {
                    return {
                        valid: false,
                        reason: `Daily time limit of ${rule.totalDailyLimit} minutes for ${breakType} breaks exceeded`
                    };
                }
            }

            // Check time window restrictions
            if (rule.timeWindow || rule.timeRestrictions) {
                const isInValidTime = this.isInValidTimeWindow(breakType, rule);
                if (!isInValidTime) {
                    return {
                        valid: false,
                        reason: `${breakType} breaks are not allowed at this time`
                    };
                }
            }

            return { valid: true };

        } catch (error) {
            console.error('Error validating break start:', error);
            return {
                valid: false,
                reason: 'Error validating break eligibility'
            };
        }
    }

    /**
     * Check for break violations
     * @param {Object} breakRecord - Break record
     * @param {Object} duration - Break duration
     * @returns {Object} Violation check result
     */
    async checkBreakViolation(breakRecord, duration) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: breakRecord.userId },
                select: { orgId: true }
            });

            const breakRules = await this.getOrganizationBreakRules(user.orgId);
            const rule = breakRules[breakRecord.breakType];

            if (!rule) {
                return { hasViolation: false };
            }

            const violations = [];

            // Check duration violation
            if (duration.minutes > rule.maxDuration) {
                const excessMinutes = duration.minutes - rule.maxDuration;
                violations.push({
                    type: 'DURATION_EXCEEDED',
                    severity: excessMinutes > 30 ? 'MAJOR' : 'MINOR',
                    details: {
                        allowedDuration: rule.maxDuration,
                        actualDuration: duration.minutes,
                        excessMinutes,
                        penaltyPerMinute: rule.penaltyPerMinute || 0
                    }
                });
            }

            // Check time window violation
            if (!this.isInValidTimeWindow(breakRecord.breakType, rule, breakRecord.startTime)) {
                violations.push({
                    type: 'INVALID_TIME_WINDOW',
                    severity: 'MINOR',
                    details: {
                        allowedWindow: rule.timeWindow || rule.timeRestrictions,
                        actualTime: breakRecord.startTime
                    }
                });
            }

            const hasViolation = violations.length > 0;
            let totalPenalty = 0;

            if (hasViolation) {
                // Calculate penalty
                violations.forEach(violation => {
                    if (violation.type === 'DURATION_EXCEEDED' && rule.penaltyPerMinute) {
                        totalPenalty += violation.details.excessMinutes * rule.penaltyPerMinute;
                    }
                });
            }

            return {
                hasViolation,
                violations,
                totalPenalty,
                requiresApproval: rule.requiresApproval && hasViolation
            };

        } catch (error) {
            console.error('Error checking break violation:', error);
            return { hasViolation: false };
        }
    }

    /**
     * Calculate break duration
     * @param {Date} startTime - Break start time
     * @param {Date} endTime - Break end time
     * @returns {Object} Duration breakdown
     */
    calculateBreakDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.round((minutes / 60) * 100) / 100;

        return {
            milliseconds: diffMs,
            minutes,
            hours,
            formatted: `${Math.floor(hours)}h ${minutes % 60}m`
        };
    }

    /**
     * Check if current time is in valid time window for break
     * @param {string} breakType - Break type
     * @param {Object} rule - Break rule
     * @param {Date|null} checkTime - Time to check (default: now)
     * @returns {boolean} True if in valid time window
     */
    isInValidTimeWindow(breakType, rule, checkTime = null) {
        const now = checkTime ? new Date(checkTime) : new Date();
        const currentTime = now.toTimeString().substr(0, 5); // HH:MM format

        // Check time window (for lunch breaks)
        if (rule.timeWindow) {
            const { start, end } = rule.timeWindow;
            return currentTime >= start && currentTime <= end;
        }

        // Check time restrictions (for tea breaks)
        if (rule.timeRestrictions) {
            return rule.timeRestrictions.some(window => {
                const [start, end] = window.split('-');
                return currentTime >= start && currentTime <= end;
            });
        }

        return true; // No time restrictions
    }

    /**
     * Get today's break count for user and type
     * @param {string} userId - User ID
     * @param {string} breakType - Break type
     * @returns {number} Number of breaks today
     */
    async getTodayBreaksCount(userId, breakType) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const count = await prisma.breakRecord.count({
                where: {
                    userId,
                    breakType,
                    startTime: {
                        gte: today,
                        lt: tomorrow
                    }
                }
            });

            return count;
        } catch (error) {
            console.error('Error getting today breaks count:', error);
            return 0;
        }
    }

    /**
     * Get total break time for today
     * @param {string} userId - User ID
     * @param {string} breakType - Break type
     * @returns {number} Total minutes
     */
    async getTodayBreakTime(userId, breakType) {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const breaks = await prisma.breakRecord.findMany({
                where: {
                    userId,
                    breakType,
                    startTime: {
                        gte: today,
                        lt: tomorrow
                    },
                    status: 'COMPLETED'
                },
                select: {
                    duration: true
                }
            });

            return breaks.reduce((total, breakRecord) => {
                return total + (breakRecord.duration?.minutes || 0);
            }, 0);
        } catch (error) {
            console.error('Error getting today break time:', error);
            return 0;
        }
    }

    /**
     * Get break history for user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Array} Break history
     */
    async getBreakHistory(userId, options = {}) {
        try {
            const {
                days = 30,
                breakType = null,
                includeViolations = false,
                limit = 50
            } = options;

            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const where = {
                userId,
                startTime: {
                    gte: fromDate
                }
            };

            if (breakType) {
                where.breakType = breakType;
            }

            const breaks = await prisma.breakRecord.findMany({
                where,
                orderBy: {
                    startTime: 'desc'
                },
                take: limit,
                include: {
                    user: {
                        select: { firstName: true, lastName: true }
                    }
                }
            });

            if (includeViolations) {
                return breaks.map(breakRecord => ({
                    ...breakRecord,
                    hasViolation: !!breakRecord.violation,
                    violationDetails: breakRecord.violation
                }));
            }

            return breaks;
        } catch (error) {
            console.error('Error fetching break history:', error);
            return [];
        }
    }

    /**
     * Get break analytics for user
     * @param {string} userId - User ID
     * @param {number} days - Number of days to analyze
     * @returns {Object} Break analytics
     */
    async getBreakAnalytics(userId, days = 30) {
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            const breaks = await prisma.breakRecord.findMany({
                where: {
                    userId,
                    startTime: {
                        gte: fromDate
                    },
                    status: 'COMPLETED'
                }
            });

            const analytics = {
                totalBreaks: breaks.length,
                totalTime: 0,
                averageBreakTime: 0,
                byType: {},
                violations: 0,
                complianceRate: 0,
                dailyAverage: 0
            };

            breaks.forEach(breakRecord => {
                const duration = breakRecord.duration?.minutes || 0;
                analytics.totalTime += duration;

                if (!analytics.byType[breakRecord.breakType]) {
                    analytics.byType[breakRecord.breakType] = {
                        count: 0,
                        totalTime: 0,
                        averageTime: 0,
                        violations: 0
                    };
                }

                analytics.byType[breakRecord.breakType].count++;
                analytics.byType[breakRecord.breakType].totalTime += duration;

                if (breakRecord.violation) {
                    analytics.violations++;
                    analytics.byType[breakRecord.breakType].violations++;
                }
            });

            // Calculate averages
            if (analytics.totalBreaks > 0) {
                analytics.averageBreakTime = Math.round(analytics.totalTime / analytics.totalBreaks);
                analytics.complianceRate = Math.round(((analytics.totalBreaks - analytics.violations) / analytics.totalBreaks) * 100);
                analytics.dailyAverage = Math.round(analytics.totalBreaks / days * 10) / 10;

                Object.keys(analytics.byType).forEach(type => {
                    const typeData = analytics.byType[type];
                    typeData.averageTime = Math.round(typeData.totalTime / typeData.count);
                });
            }

            return analytics;
        } catch (error) {
            console.error('Error getting break analytics:', error);
            return {};
        }
    }

    /**
     * End current work session (placeholder for integration)
     * @param {string} userId - User ID
     */
    async endCurrentWorkSession(userId) {
        // This would integrate with existing attendance system
        // to pause the current work session when break starts
        console.log(`Ending current work session for user ${userId}`);
    }

    /**
     * Start new work session (placeholder for integration)
     * @param {string} userId - User ID
     */
    async startNewWorkSession(userId) {
        // This would integrate with existing attendance system
        // to resume work session when break ends
        console.log(`Starting new work session for user ${userId}`);
    }

    /**
     * Cancel an active break
     * @param {string} breakId - Break record ID
     * @param {string} reason - Cancellation reason
     * @returns {Object} Updated break record
     */
    async cancelBreak(breakId, reason = '') {
        try {
            const updatedBreak = await prisma.breakRecord.update({
                where: { id: breakId },
                data: {
                    status: 'CANCELLED',
                    endTime: new Date(),
                    note: `Cancelled: ${reason}`.trim()
                }
            });

            // Restart work session
            await this.startNewWorkSession(updatedBreak.userId);

            return {
                success: true,
                breakRecord: updatedBreak,
                message: 'Break cancelled successfully'
            };
        } catch (error) {
            console.error('Error cancelling break:', error);
            throw error;
        }
    }
}

export default BreakManagementService;
