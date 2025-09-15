import prisma from "../../db/connectDb.js";

/**
 * Engine for calculating progressive salary deductions
 * Handles escalating penalties for repeat violations
 */
class ProgressiveDeductionEngine {
    constructor() {
        this.defaultMultipliers = {
            repeat_offense_multipliers: {
                second_offense: 1.5,
                third_offense: 2.0,
                chronic_offender: 3.0
            },
            time_based_multipliers: {
                same_week: 1.2,
                same_month: 1.5,
                consecutive_days: 2.0
            }
        };

        this.escalationRules = {
            LATE_ARRIVAL: {
                basePenalty: 50,
                escalationSteps: [
                    { violationCount: 3, multiplier: 1.5, action: 'WARNING' },
                    { violationCount: 5, multiplier: 2.0, action: 'WRITTEN_WARNING' },
                    { violationCount: 8, multiplier: 3.0, action: 'PERFORMANCE_REVIEW' },
                    { violationCount: 12, multiplier: 4.0, action: 'DISCIPLINARY_ACTION' }
                ],
                timeDecay: {
                    enabled: true,
                    decayPeriod: 90, // days
                    decayRate: 0.1 // 10% reduction per period
                }
            },
            EARLY_DEPARTURE: {
                basePenalty: 100,
                escalationSteps: [
                    { violationCount: 2, multiplier: 1.8, action: 'MANAGER_NOTIFICATION' },
                    { violationCount: 4, multiplier: 2.5, action: 'HR_INTERVENTION' },
                    { violationCount: 6, multiplier: 4.0, action: 'CONTRACT_REVIEW' }
                ]
            },
            BREAK_VIOLATION: {
                basePenalty: 25,
                escalationSteps: [
                    { violationCount: 5, multiplier: 1.5, action: 'COUNSELING' },
                    { violationCount: 10, multiplier: 2.0, action: 'FORMAL_WARNING' },
                    { violationCount: 15, multiplier: 3.0, action: 'FINAL_WARNING' }
                ]
            },
            MINIMUM_HOURS: {
                basePenalty: 75,
                escalationSteps: [
                    { violationCount: 3, multiplier: 1.3, action: 'WARNING' },
                    { violationCount: 7, multiplier: 2.0, action: 'PERFORMANCE_REVIEW' },
                    { violationCount: 12, multiplier: 3.5, action: 'DISCIPLINARY_ACTION' }
                ]
            },
            GEOFENCE_VIOLATION: {
                basePenalty: 200,
                escalationSteps: [
                    { violationCount: 1, multiplier: 2.0, action: 'IMMEDIATE_WARNING' },
                    { violationCount: 3, multiplier: 4.0, action: 'DISCIPLINARY_ACTION' },
                    { violationCount: 5, multiplier: 6.0, action: 'CONTRACT_REVIEW' }
                ]
            }
        };
    }

    /**
     * Calculate progressive penalty for a violation
     * @param {string} violationType - Type of violation
     * @param {Array} employeeHistory - Employee's violation history
     * @param {Object} currentViolation - Current violation details
     * @param {Object} organizationRules - Organization-specific rules
     * @returns {Object} Penalty calculation result
     */
    async calculatePenalty(violationType, employeeHistory, currentViolation, organizationRules = {}) {
        try {
            const penaltyConfig = this.escalationRules[violationType] || this.escalationRules.LATE_ARRIVAL;
            const historyAnalysis = this.analyzeEmployeeHistory(employeeHistory, violationType);
            
            // Base penalty calculation
            let basePenalty = penaltyConfig.basePenalty;
            
            // Override with organization-specific base penalty if available
            if (organizationRules[violationType]?.penalty?.baseAmount) {
                basePenalty = organizationRules[violationType].penalty.baseAmount;
            }
            
            // Apply progressive multipliers
            const progressiveMultiplier = this.getProgressiveMultiplier(
                historyAnalysis.totalViolations,
                historyAnalysis.recentViolations,
                penaltyConfig.escalationSteps
            );
            
            // Apply contextual adjustments
            const contextAdjustment = this.getContextualAdjustment(
                currentViolation,
                historyAnalysis,
                penaltyConfig
            );
            
            const finalPenalty = basePenalty * progressiveMultiplier * contextAdjustment;
            
            // Determine required action
            const requiredAction = this.determineRequiredAction(
                historyAnalysis.totalViolations,
                penaltyConfig.escalationSteps
            );
            
            return {
                basePenalty,
                progressiveMultiplier,
                contextAdjustment,
                finalPenalty: Math.round(finalPenalty * 100) / 100, // Round to 2 decimal places
                requiredAction,
                breakdown: this.generatePenaltyBreakdown(violationType, historyAnalysis, {
                    basePenalty,
                    progressiveMultiplier,
                    contextAdjustment,
                    finalPenalty
                }),
                autoApprovalLimit: this.getAutoApprovalLimit(violationType),
                requiresApproval: finalPenalty > this.getAutoApprovalLimit(violationType)
            };
        } catch (error) {
            console.error('Error calculating penalty:', error);
            throw error;
        }
    }

    /**
     * Analyze employee's violation history
     * @param {Array} history - Violation history
     * @param {string} violationType - Type of violation to analyze
     * @returns {Object} Analysis results
     */
    analyzeEmployeeHistory(history, violationType) {
        if (!history || history.length === 0) {
            return {
                totalViolations: 0,
                recentViolations: 0,
                lastViolationDate: null,
                violationPattern: 'NONE',
                consecutiveDays: 0
            };
        }

        const relevantViolations = history.filter(v => v.violationType === violationType);
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        const recentViolations = relevantViolations.filter(v => 
            new Date(v.createdAt) > thirtyDaysAgo
        );

        const weeklyViolations = relevantViolations.filter(v => 
            new Date(v.createdAt) > sevenDaysAgo
        );

        // Calculate consecutive days pattern
        let consecutiveDays = 0;
        const sortedViolations = relevantViolations
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        for (let i = 0; i < sortedViolations.length; i++) {
            const violationDate = new Date(sortedViolations[i].createdAt);
            const expectedDate = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            
            if (this.isSameDay(violationDate, expectedDate)) {
                consecutiveDays++;
            } else {
                break;
            }
        }

        // Determine violation pattern
        let violationPattern = 'SPORADIC';
        if (consecutiveDays >= 3) {
            violationPattern = 'CONSECUTIVE';
        } else if (weeklyViolations.length >= 4) {
            violationPattern = 'FREQUENT';
        } else if (recentViolations.length >= 8) {
            violationPattern = 'CHRONIC';
        }

        return {
            totalViolations: relevantViolations.length,
            recentViolations: recentViolations.length,
            weeklyViolations: weeklyViolations.length,
            lastViolationDate: relevantViolations.length > 0 ? 
                new Date(sortedViolations[0].createdAt) : null,
            violationPattern,
            consecutiveDays
        };
    }

    /**
     * Get progressive multiplier based on violation count
     * @param {number} totalViolations - Total violation count
     * @param {number} recentViolations - Recent violation count
     * @param {Array} escalationSteps - Escalation configuration
     * @returns {number} Progressive multiplier
     */
    getProgressiveMultiplier(totalViolations, recentViolations, escalationSteps) {
        let multiplier = 1.0;

        // Find applicable escalation step
        for (let i = escalationSteps.length - 1; i >= 0; i--) {
            if (totalViolations >= escalationSteps[i].violationCount) {
                multiplier = escalationSteps[i].multiplier;
                break;
            }
        }

        // Additional multiplier for recent violations
        if (recentViolations >= 5) {
            multiplier *= 1.3;
        } else if (recentViolations >= 3) {
            multiplier *= 1.2;
        }

        return multiplier;
    }

    /**
     * Get contextual adjustment factor
     * @param {Object} currentViolation - Current violation details
     * @param {Object} historyAnalysis - History analysis
     * @param {Object} penaltyConfig - Penalty configuration
     * @returns {number} Contextual adjustment factor
     */
    getContextualAdjustment(currentViolation, historyAnalysis, penaltyConfig) {
        let adjustment = 1.0;

        // Pattern-based adjustments
        switch (historyAnalysis.violationPattern) {
            case 'CONSECUTIVE':
                adjustment *= 1.5;
                break;
            case 'FREQUENT':
                adjustment *= 1.3;
                break;
            case 'CHRONIC':
                adjustment *= 1.8;
                break;
            default:
                adjustment *= 1.0;
        }

        // Time-based adjustments
        if (historyAnalysis.consecutiveDays >= 3) {
            adjustment *= 1.4;
        }

        // Severity-based adjustments
        if (currentViolation.severity === 'CRITICAL') {
            adjustment *= 1.6;
        } else if (currentViolation.severity === 'MAJOR') {
            adjustment *= 1.3;
        }

        // Time decay adjustment (if enabled)
        if (penaltyConfig.timeDecay?.enabled && historyAnalysis.lastViolationDate) {
            const daysSinceLastViolation = Math.floor(
                (new Date() - historyAnalysis.lastViolationDate) / (1000 * 60 * 60 * 24)
            );
            
            if (daysSinceLastViolation > penaltyConfig.timeDecay.decayPeriod) {
                const decayFactor = 1 - penaltyConfig.timeDecay.decayRate;
                adjustment *= decayFactor;
            }
        }

        return Math.max(0.5, adjustment); // Minimum 50% adjustment
    }

    /**
     * Determine required action based on violation count
     * @param {number} totalViolations - Total violation count
     * @param {Array} escalationSteps - Escalation steps
     * @returns {string} Required action
     */
    determineRequiredAction(totalViolations, escalationSteps) {
        for (let i = escalationSteps.length - 1; i >= 0; i--) {
            if (totalViolations >= escalationSteps[i].violationCount) {
                return escalationSteps[i].action;
            }
        }
        return 'NONE';
    }

    /**
     * Generate detailed penalty breakdown
     * @param {string} violationType - Violation type
     * @param {Object} historyAnalysis - History analysis
     * @param {Object} penaltyDetails - Penalty calculation details
     * @returns {Object} Detailed breakdown
     */
    generatePenaltyBreakdown(violationType, historyAnalysis, penaltyDetails) {
        return {
            violationType,
            basePenalty: penaltyDetails.basePenalty,
            progressiveMultiplier: {
                value: penaltyDetails.progressiveMultiplier,
                reason: `Based on ${historyAnalysis.totalViolations} total violations`
            },
            contextualAdjustment: {
                value: penaltyDetails.contextAdjustment,
                factors: [
                    { factor: 'Pattern', value: historyAnalysis.violationPattern },
                    { factor: 'Recent Count', value: historyAnalysis.recentViolations },
                    { factor: 'Consecutive Days', value: historyAnalysis.consecutiveDays }
                ]
            },
            finalAmount: penaltyDetails.finalPenalty,
            calculationDate: new Date().toISOString(),
            historySnapshot: {
                totalViolations: historyAnalysis.totalViolations,
                recentViolations: historyAnalysis.recentViolations,
                pattern: historyAnalysis.violationPattern
            }
        };
    }

    /**
     * Get auto-approval limit for violation type
     * @param {string} violationType - Violation type
     * @returns {number} Auto-approval limit
     */
    getAutoApprovalLimit(violationType) {
        const limits = {
            LATE_ARRIVAL: 150,
            EARLY_DEPARTURE: 200,
            BREAK_VIOLATION: 100,
            MINIMUM_HOURS: 250,
            GEOFENCE_VIOLATION: 300,
            ABSENTEEISM: 500
        };
        return limits[violationType] || 150;
    }

    /**
     * Save penalty to database
     * @param {string} userId - User ID
     * @param {string} violationType - Violation type
     * @param {Object} penaltyCalculation - Penalty calculation result
     * @param {number} payrollMonth - Payroll month
     * @param {number} payrollYear - Payroll year
     * @returns {Object} Saved penalty record
     */
    async savePenalty(userId, violationType, penaltyCalculation, payrollMonth, payrollYear) {
        try {
            return await prisma.progressivePenaltyHistory.create({
                data: {
                    userId,
                    violationType,
                    penaltyAmount: penaltyCalculation.finalPenalty,
                    progressiveMultiplier: penaltyCalculation.progressiveMultiplier,
                    violationCount: penaltyCalculation.breakdown.historySnapshot.totalViolations,
                    payrollMonth,
                    payrollYear,
                    status: penaltyCalculation.requiresApproval ? 'PENDING' : 'APPLIED',
                    metadata: {
                        breakdown: penaltyCalculation.breakdown,
                        requiredAction: penaltyCalculation.requiredAction,
                        autoApproved: !penaltyCalculation.requiresApproval
                    }
                }
            });
        } catch (error) {
            console.error('Error saving penalty:', error);
            throw error;
        }
    }

    /**
     * Get monthly penalty summary for employee
     * @param {string} userId - User ID
     * @param {number} month - Month
     * @param {number} year - Year
     * @returns {Object} Monthly penalty summary
     */
    async getMonthlyPenaltySummary(userId, month, year) {
        try {
            const penalties = await prisma.progressivePenaltyHistory.findMany({
                where: {
                    userId,
                    payrollMonth: month,
                    payrollYear: year
                },
                orderBy: {
                    dateApplied: 'desc'
                }
            });

            const summary = {
                totalPenalties: penalties.length,
                totalAmount: penalties.reduce((sum, p) => sum + parseFloat(p.penaltyAmount), 0),
                byType: {},
                byStatus: {},
                breakdown: penalties.map(p => ({
                    violationType: p.violationType,
                    amount: parseFloat(p.penaltyAmount),
                    status: p.status,
                    dateApplied: p.dateApplied
                }))
            };

            // Group by type
            penalties.forEach(penalty => {
                if (!summary.byType[penalty.violationType]) {
                    summary.byType[penalty.violationType] = {
                        count: 0,
                        amount: 0
                    };
                }
                summary.byType[penalty.violationType].count++;
                summary.byType[penalty.violationType].amount += parseFloat(penalty.penaltyAmount);
            });

            // Group by status
            penalties.forEach(penalty => {
                if (!summary.byStatus[penalty.status]) {
                    summary.byStatus[penalty.status] = {
                        count: 0,
                        amount: 0
                    };
                }
                summary.byStatus[penalty.status].count++;
                summary.byStatus[penalty.status].amount += parseFloat(penalty.penaltyAmount);
            });

            return summary;
        } catch (error) {
            console.error('Error getting monthly penalty summary:', error);
            throw error;
        }
    }

    /**
     * Check if two dates are the same day
     * @param {Date} date1 - First date
     * @param {Date} date2 - Second date
     * @returns {boolean} True if same day
     */
    isSameDay(date1, date2) {
        return date1.getFullYear() === date2.getFullYear() &&
               date1.getMonth() === date2.getMonth() &&
               date1.getDate() === date2.getDate();
    }
}

export default ProgressiveDeductionEngine;
