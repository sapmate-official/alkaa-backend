import prisma from "../../db/connectDb.js";

/**
 * Service for applying employment type specific rules
 */
class EmploymentTypeRuleService {
    /**
     * Check if user is eligible for leave based on employment type
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Object} Leave eligibility info
     */
    async checkLeaveEligibility(userId, orgId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { employmentType: true }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Get employment type policy
            const policy = await prisma.employmentTypePolicy.findUnique({
                where: {
                    orgId_employmentType: {
                        orgId,
                        employmentType: user.employmentType
                    }
                }
            });

            // If no policy or override not enabled, use default (all eligible)
            if (!policy || !policy.overrideLeaveEligibility) {
                return {
                    eligible: true,
                    reason: 'default_policy'
                };
            }

            // Check leave config
            const leaveConfig = policy.leaveConfig || {};
            
            if (leaveConfig.leaveEnabled === false) {
                return {
                    eligible: false,
                    reason: `${user.employmentType.replace('_', ' ')} employees are not eligible for leave`,
                    config: leaveConfig
                };
            }

            return {
                eligible: true,
                config: leaveConfig,
                reason: 'employment_type_policy'
            };
        } catch (error) {
            console.error('[EMPLOYMENT_TYPE_RULE_SERVICE] Error checking leave eligibility:', error);
            throw error;
        }
    }

    /**
     * Get applicable attendance hours for user based on employment type
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Object} Attendance hours configuration
     */
    async getAttendanceHours(userId, orgId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { employmentType: true }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Get employment type policy
            const policy = await prisma.employmentTypePolicy.findUnique({
                where: {
                    orgId_employmentType: {
                        orgId,
                        employmentType: user.employmentType
                    }
                }
            });

            // If no policy or override not enabled, use organization default
            if (!policy || !policy.overrideAttendanceHours) {
                return {
                    useDefault: true,
                    source: 'organization'
                };
            }

            const attendanceConfig = policy.attendanceConfig || {};

            return {
                useDefault: false,
                source: 'employment_type',
                config: {
                    dailyMinimum: attendanceConfig.dailyMinimum || 8,
                    dailyMaximum: attendanceConfig.dailyMaximum || 12,
                    weeklyMinimum: attendanceConfig.weeklyMinimum || 40,
                    ...attendanceConfig
                }
            };
        } catch (error) {
            console.error('[EMPLOYMENT_TYPE_RULE_SERVICE] Error getting attendance hours:', error);
            throw error;
        }
    }

    /**
     * Get applicable payroll rules for user based on employment type
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Object} Payroll configuration
     */
    async getPayrollRules(userId, orgId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { employmentType: true }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Get employment type policy
            const policy = await prisma.employmentTypePolicy.findUnique({
                where: {
                    orgId_employmentType: {
                        orgId,
                        employmentType: user.employmentType
                    }
                }
            });

            // If no policy or override not enabled, use organization default
            if (!policy || !policy.overridePayrollRules) {
                return {
                    useDefault: true,
                    source: 'organization'
                };
            }

            const payrollConfig = policy.payrollConfig || {};

            return {
                useDefault: false,
                source: 'employment_type',
                config: payrollConfig
            };
        } catch (error) {
            console.error('[EMPLOYMENT_TYPE_RULE_SERVICE] Error getting payroll rules:', error);
            throw error;
        }
    }

    /**
     * Get user's employment type rules summary
     * @param {string} userId - User ID
     * @param {string} orgId - Organization ID
     * @returns {Object} Rules summary
     */
    async getUserRulesSummary(userId, orgId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { 
                    employmentType: true,
                    contractEndDate: true 
                }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Get employment type policy
            const policy = await prisma.employmentTypePolicy.findUnique({
                where: {
                    orgId_employmentType: {
                        orgId,
                        employmentType: user.employmentType
                    }
                }
            });

            const summary = {
                employmentType: user.employmentType,
                contractEndDate: user.contractEndDate,
                rules: {
                    attendance: {
                        overridden: false,
                        source: 'organization'
                    },
                    leave: {
                        overridden: false,
                        source: 'organization',
                        eligible: true
                    },
                    break: {
                        overridden: false,
                        source: 'organization'
                    },
                    payroll: {
                        overridden: false,
                        source: 'organization'
                    }
                }
            };

            if (policy) {
                if (policy.overrideAttendanceHours) {
                    summary.rules.attendance = {
                        overridden: true,
                        source: 'employment_type',
                        config: policy.attendanceConfig
                    };
                }

                if (policy.overrideLeaveEligibility) {
                    const leaveConfig = policy.leaveConfig || {};
                    summary.rules.leave = {
                        overridden: true,
                        source: 'employment_type',
                        eligible: leaveConfig.leaveEnabled !== false,
                        config: leaveConfig
                    };
                }

                if (policy.overrideBreakRules) {
                    summary.rules.break = {
                        overridden: true,
                        source: 'employment_type',
                        config: policy.breakConfig
                    };
                }

                if (policy.overridePayrollRules) {
                    summary.rules.payroll = {
                        overridden: true,
                        source: 'employment_type',
                        config: policy.payrollConfig
                    };
                }
            }

            return summary;
        } catch (error) {
            console.error('[EMPLOYMENT_TYPE_RULE_SERVICE] Error getting user rules summary:', error);
            throw error;
        }
    }
}

export default new EmploymentTypeRuleService();
