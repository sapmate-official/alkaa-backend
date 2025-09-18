import prisma from "../../db/connectDb.js";

/**
 * Service for processing attendance rules and violations
 * Note: All rules are disabled by default and must be explicitly enabled
 */
class AttendanceRulesProcessor {
    constructor() {
        this.defaultRules = {
            lateArrival: {
                isActive: false, // Default to disabled
                thresholds: [
                    { minutes: 15, deductionType: 'warning', count: 1 },
                    { minutes: 30, deductionType: 'hourly', percentage: 2 },
                    { minutes: 60, deductionType: 'daily', percentage: 12.5 }
                ],
                progressiveSteps: [
                    { occurrences: 3, action: 'deduct_half_day' },
                    { occurrences: 5, action: 'deduct_full_day' },
                    { occurrences: 10, action: 'disciplinary_action' }
                ]
            },
            earlyDeparture: {
                isActive: false, // Default to disabled
                thresholds: [
                    { minutes: 30, deductionType: 'hourly', percentage: 5 },
                    { minutes: 60, deductionType: 'half_day', percentage: 50 }
                ]
            },
            absenteeism: {
                isActive: false, // Default to disabled
                consecutive: {
                    3: { action: 'warning', notification: 'manager' },
                    5: { action: 'deduct_double', notification: 'hr' },
                    7: { action: 'termination_review', notification: 'admin' }
                }
            },
            minimumHours: {
                isActive: false, // Default to disabled
                dailyMinimum: 8,
                deductionPerHour: 12.5
            },
            breakViolation: {
                isActive: false, // Default to disabled
                penalties: {
                    unauthorized: 25,
                    overtime: 0.5 // per minute
                }
            }
        };
    }

    /**
     * Get organization-specific attendance rules
     * @param {string} orgId - Organization ID
     * @returns {Object} Organization attendance rules
     */
    async getOrganizationRules(orgId) {
        try {
            const rules = await prisma.organizationAttendanceRules.findMany({
                where: { orgId },
                orderBy: { createdAt: 'desc' }
            });

            // Convert to organized format
            const organizedRules = {};
            rules.forEach(rule => {
                const ruleKey = rule.ruleType.toLowerCase().replace(/_/g, '');
                const mappedKey = {
                    'latearrival': 'lateArrival',
                    'earlydeparture': 'earlyDeparture',
                    'minimumhours': 'minimumHours',
                    'absenteeism': 'absenteeism',
                    'breakviolation': 'breakViolation'
                }[ruleKey] || ruleKey;
                
                organizedRules[mappedKey] = {
                    id: rule.id,
                    isActive: rule.isActive,
                    threshold: rule.threshold,
                    penalty: rule.penalty,
                    updatedAt: rule.updatedAt
                };
            });

            // If no rules exist in DB, create default rules
            if (rules.length === 0) {
                await this.createDefaultRules(orgId);
                // Re-fetch after creating defaults
                return await this.getOrganizationRules(orgId);
            }

            // Merge with defaults for missing rules
            return { ...this.defaultRules, ...organizedRules };
        } catch (error) {
            console.error('Error fetching organization rules:', error);
            return this.defaultRules;
        }
    }

    /**
     * Create default rules for organization
     * @param {string} orgId - Organization ID
     */
    async createDefaultRules(orgId) {
        try {
            const defaultRuleTypes = [
                {
                    ruleType: 'LATE_ARRIVAL',
                    threshold: { minutes: 15 },
                    penalty: { amount: 0, type: 'warning' }
                },
                {
                    ruleType: 'EARLY_DEPARTURE', 
                    threshold: { minutes: 30 },
                    penalty: { amount: 0, type: 'warning' }
                },
                {
                    ruleType: 'MINIMUM_HOURS',
                    threshold: { hours: 8 },
                    penalty: { amount: 0, type: 'hourly_deduction' }
                },
                {
                    ruleType: 'ABSENTEEISM',
                    threshold: { consecutive_days: 3 },
                    penalty: { amount: 0, type: 'daily_deduction' }
                },
                {
                    ruleType: 'BREAK_VIOLATION',
                    threshold: { minutes: 60 },
                    penalty: { amount: 0, type: 'warning' }
                }
            ];

            await prisma.organizationAttendanceRules.createMany({
                data: defaultRuleTypes.map(rule => ({
                    orgId,
                    ruleType: rule.ruleType,
                    threshold: rule.threshold,
                    penalty: rule.penalty,
                    isActive: false // All rules start as disabled
                })),
                skipDuplicates: true
            });

            console.log(`Created default attendance rules for organization: ${orgId}`);
        } catch (error) {
            console.error('Error creating default rules:', error);
            throw error;
        }
    }

    /**
     * Create or update attendance rule for organization
     * @param {string} orgId - Organization ID
     * @param {string} ruleType - Type of rule
     * @param {Object} threshold - Rule threshold configuration
     * @param {Object} penalty - Penalty configuration
     * @param {boolean} isActive - Whether rule is active (default: false)
     */
    async createOrUpdateRule(orgId, ruleType, threshold, penalty, isActive = false) {
        try {
            return await prisma.organizationAttendanceRules.upsert({
                where: {
                    orgId_ruleType: {
                        orgId,
                        ruleType: ruleType.toUpperCase()
                    }
                },
                update: {
                    threshold,
                    penalty,
                    isActive,
                    updatedAt: new Date()
                },
                create: {
                    orgId,
                    ruleType: ruleType.toUpperCase(),
                    threshold,
                    penalty,
                    isActive
                }
            });
        } catch (error) {
            console.error('Error creating/updating rule:', error);
            throw error;
        }
    }

    /**
     * Process attendance record against organization rules
     * @param {Object} attendanceRecord - Attendance record to process
     * @param {Object} employeeHistory - Employee's historical data
     * @returns {Array} Array of violations found
     */
    async processAttendanceRecord(attendanceRecord, employeeHistory = null) {
        try {
            const orgRules = await this.getOrganizationRules(attendanceRecord.user.orgId);
            const violations = [];

            // Only process if rules are enabled
            if (orgRules.lateArrival?.isActive) {
                const lateViolation = await this.checkLateArrival(attendanceRecord, orgRules.lateArrival);
                if (lateViolation) violations.push(lateViolation);
            }

            if (orgRules.earlyDeparture?.isActive) {
                const earlyViolation = await this.checkEarlyDeparture(attendanceRecord, orgRules.earlyDeparture);
                if (earlyViolation) violations.push(earlyViolation);
            }

            if (orgRules.minimumHours?.isActive) {
                const hoursViolation = await this.checkMinimumHours(attendanceRecord, orgRules.minimumHours);
                if (hoursViolation) violations.push(hoursViolation);
            }

            // Process progressive patterns if we have history
            if (employeeHistory && orgRules.absenteeism?.isActive) {
                const progressiveViolations = await this.checkProgressivePatterns(
                    attendanceRecord.userId, 
                    employeeHistory, 
                    orgRules
                );
                violations.push(...progressiveViolations);
            }

            return violations;
        } catch (error) {
            console.error('Error processing attendance record:', error);
            return [];
        }
    }

    /**
     * Check for late arrival violations
     * @param {Object} attendanceRecord - Attendance record
     * @param {Object} lateRules - Late arrival rules
     * @returns {Object|null} Violation object or null
     */
    async checkLateArrival(attendanceRecord, lateRules) {
        if (!lateRules?.isActive) return null;

        const expectedStartTime = new Date(attendanceRecord.checkInTime);
        expectedStartTime.setHours(9, 0, 0, 0); // Default 9 AM start

        const actualStartTime = new Date(attendanceRecord.checkInTime);
        const lateMinutes = Math.max(0, (actualStartTime - expectedStartTime) / (1000 * 60));

        if (lateMinutes <= 0) return null;

        // Find applicable threshold
        const applicableThreshold = lateRules.thresholds
            ?.find(threshold => lateMinutes >= threshold.minutes) || null;

        if (!applicableThreshold) return null;

        return {
            type: 'LATE_ARRIVAL',
            severity: this.calculateSeverity(lateMinutes, lateRules.thresholds),
            details: {
                lateMinutes,
                expectedTime: expectedStartTime,
                actualTime: actualStartTime,
                threshold: applicableThreshold
            },
            attendanceId: attendanceRecord.id,
            userId: attendanceRecord.userId
        };
    }

    /**
     * Check for early departure violations
     * @param {Object} attendanceRecord - Attendance record
     * @param {Object} earlyRules - Early departure rules
     * @returns {Object|null} Violation object or null
     */
    async checkEarlyDeparture(attendanceRecord, earlyRules) {
        if (!earlyRules?.isActive || !attendanceRecord.checkOutTime) return null;

        const expectedEndTime = new Date(attendanceRecord.checkInTime);
        expectedEndTime.setHours(17, 0, 0, 0); // Default 5 PM end

        const actualEndTime = new Date(attendanceRecord.checkOutTime);
        const earlyMinutes = Math.max(0, (expectedEndTime - actualEndTime) / (1000 * 60));

        if (earlyMinutes <= 0) return null;

        const applicableThreshold = earlyRules.thresholds
            ?.find(threshold => earlyMinutes >= threshold.minutes) || null;

        if (!applicableThreshold) return null;

        return {
            type: 'EARLY_DEPARTURE',
            severity: this.calculateSeverity(earlyMinutes, earlyRules.thresholds),
            details: {
                earlyMinutes,
                expectedTime: expectedEndTime,
                actualTime: actualEndTime,
                threshold: applicableThreshold
            },
            attendanceId: attendanceRecord.id,
            userId: attendanceRecord.userId
        };
    }

    /**
     * Check for minimum hours violations
     * @param {Object} attendanceRecord - Attendance record
     * @param {Object} hoursRules - Minimum hours rules
     * @returns {Object|null} Violation object or null
     */
    async checkMinimumHours(attendanceRecord, hoursRules) {
        if (!hoursRules?.isActive || !attendanceRecord.checkOutTime) return null;

        const checkInTime = new Date(attendanceRecord.checkInTime);
        const checkOutTime = new Date(attendanceRecord.checkOutTime);
        const workedHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

        const minimumHours = hoursRules.dailyMinimum || 8;
        const shortfall = minimumHours - workedHours;

        if (shortfall <= 0) return null;

        return {
            type: 'MINIMUM_HOURS',
            severity: shortfall > 4 ? 'MAJOR' : 'MINOR',
            details: {
                workedHours,
                minimumHours,
                shortfall,
                deductionPerHour: hoursRules.deductionPerHour || 12.5
            },
            attendanceId: attendanceRecord.id,
            userId: attendanceRecord.userId
        };
    }

    /**
     * Check for progressive pattern violations
     * @param {string} userId - User ID
     * @param {Object} employeeHistory - Employee history data
     * @param {Object} rules - Organization rules
     * @returns {Array} Array of violations
     */
    async checkProgressivePatterns(userId, employeeHistory, rules) {
        const violations = [];

        if (!rules.absenteeism?.isActive) return violations;

        // Check consecutive absences
        const recentAttendance = employeeHistory.recentAttendance || [];
        let consecutiveAbsences = 0;

        for (let i = recentAttendance.length - 1; i >= 0; i--) {
            if (recentAttendance[i].status === 'ABSENT') {
                consecutiveAbsences++;
            } else {
                break;
            }
        }

        const absenteeismRules = rules.absenteeism.consecutive;
        for (const [threshold, action] of Object.entries(absenteeismRules)) {
            if (consecutiveAbsences >= parseInt(threshold)) {
                violations.push({
                    type: 'ABSENTEEISM',
                    severity: consecutiveAbsences >= 7 ? 'CRITICAL' : 'MAJOR',
                    details: {
                        consecutiveAbsences,
                        threshold: parseInt(threshold),
                        action: action.action,
                        notification: action.notification
                    },
                    userId
                });
                break; // Only apply the highest applicable threshold
            }
        }

        return violations;
    }

    /**
     * Calculate violation severity based on thresholds
     * @param {number} value - Violation value (minutes, hours, etc.)
     * @param {Array} thresholds - Rule thresholds
     * @returns {string} Severity level
     */
    calculateSeverity(value, thresholds) {
        if (!thresholds || thresholds.length === 0) return 'MINOR';

        if (value >= 60) return 'MAJOR';
        if (value >= 30) return 'MINOR';
        return 'WARNING';
    }

    /**
     * Save violation to database
     * @param {Object} violation - Violation object
     * @param {string} ruleId - Rule ID
     * @returns {Object} Saved violation record
     */
    async saveViolation(violation, ruleId) {
        try {
            return await prisma.attendanceRuleViolation.create({
                data: {
                    attendanceId: violation.attendanceId,
                    ruleId,
                    violationType: violation.type,
                    severity: violation.severity,
                    penaltyAmount: violation.details.penaltyAmount || null,
                    isApproved: false // Requires approval by default
                }
            });
        } catch (error) {
            console.error('Error saving violation:', error);
            throw error;
        }
    }

    /**
     * Get employee violation history
     * @param {string} userId - User ID
     * @param {number} days - Number of days to look back
     * @returns {Array} Violation history
     */
    async getEmployeeViolationHistory(userId, days = 30) {
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            return await prisma.attendanceRuleViolation.findMany({
                where: {
                    attendance: {
                        userId,
                        date: {
                            gte: fromDate
                        }
                    }
                },
                include: {
                    attendance: true,
                    rule: true
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });
        } catch (error) {
            console.error('Error fetching violation history:', error);
            return [];
        }
    }
}

export default AttendanceRulesProcessor;
