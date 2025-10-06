import AttendanceRulesProcessor from "../../../services/attendance/AttendanceRulesProcessor.js";
import ProgressiveDeductionEngine from "../../../services/attendance/ProgressiveDeductionEngine.js";
import prisma from "../../../db/connectDb.js";

const rulesProcessor = new AttendanceRulesProcessor();
const deductionEngine = new ProgressiveDeductionEngine();

/**
 * Get organization attendance rules
 */
export const getOrganizationRules = async (req, res) => {
    try {
        const { orgId } = req.params;
        
        // Verify user has access to this organization
        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied",
                message: "You don't have permission to access this organization's rules"
            });
        }

        const rules = await rulesProcessor.getOrganizationRules(orgId);
        
        // Convert rules object to array format for frontend
        const rulesArray = Object.entries(rules).map(([ruleKey, ruleData]) => {
            // Skip the defaultRules properties that aren't actual rules
            if (typeof ruleData !== 'object' || !ruleData || Array.isArray(ruleData)) {
                return null;
            }
            
            // Map camelCase to ENUM values
            const ruleTypeMapping = {
                'lateArrival': 'LATE_ARRIVAL',
                'earlyDeparture': 'EARLY_DEPARTURE', 
                'minimumHours': 'MINIMUM_HOURS',
                'absenteeism': 'ABSENTEEISM',
                'breakViolation': 'BREAK_VIOLATION'
            };
            
            return {
                id: ruleData.id || `${orgId}-${ruleKey}`, // Fallback ID if not from DB
                ruleType: ruleTypeMapping[ruleKey] || ruleKey.toUpperCase(),
                threshold: ruleData.threshold || (ruleData.thresholds ? ruleData.thresholds[0]?.minutes : 0),
                penalty: ruleData.penalty || (ruleData.penalties ? Object.values(ruleData.penalties)[0] : 0),
                isActive: ruleData.isActive || false,
                description: `${ruleKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} rule`,
                updatedAt: ruleData.updatedAt || new Date()
            };
        }).filter(Boolean);
        
        res.status(200).json({
            success: true,
            data: rulesArray,
            message: "Rules fetched successfully"
        });
    } catch (error) {
        console.error('Error fetching organization rules:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to fetch attendance rules"
        });
    }
};

/**
 * Create or update attendance rule
 */
export const createOrUpdateRule = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { ruleType, threshold, penalty, isActive = false } = req.body;

        // Verify user has admin access to this organization
        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Validate required fields
        if (!ruleType || !threshold || !penalty) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "ruleType, threshold, and penalty are required"
            });
        }

        // Validate rule type
        const validRuleTypes = ['LATE_ARRIVAL', 'EARLY_DEPARTURE', 'MINIMUM_HOURS', 'BREAK_VIOLATION', 'GEOFENCE_VIOLATION', 'ABSENTEEISM'];
        if (!validRuleTypes.includes(ruleType.toUpperCase())) {
            return res.status(400).json({
                error: "Invalid rule type",
                message: `Rule type must be one of: ${validRuleTypes.join(', ')}`
            });
        }

        const rule = await rulesProcessor.createOrUpdateRule(
            orgId, 
            ruleType, 
            threshold, 
            penalty, 
            isActive
        );

        res.status(200).json({
            success: true,
            data: rule,
            message: `${ruleType} rule ${rule.id ? 'updated' : 'created'} successfully`
        });
    } catch (error) {
        console.error('Error creating/updating rule:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to create/update attendance rule"
        });
    }
};

/**
 * Toggle rule activation status
 */
export const toggleRuleStatus = async (req, res) => {
    try {
        const { orgId, ruleId } = req.params;
        const { isActive } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // First try to find by the actual ruleId
        let rule = null;
        
        try {
            rule = await prisma.organizationAttendanceRules.update({
                where: {
                    id: ruleId,
                    orgId: orgId
                },
                data: {
                    isActive: Boolean(isActive),
                    updatedAt: new Date()
                }
            });
        } catch (updateError) {
            // If rule not found by ID, it might be a constructed ID like "rule-${ruleType}-${orgId}"
            // Try to extract rule type from the ID pattern
            if (updateError.code === 'P2025') { // Record not found
                let actualRuleType = null;
                
                // Handle different ID patterns
                if (ruleId.startsWith('rule-')) {
                    // Pattern: "rule-latearrival-orgId" -> extract "latearrival"
                    const parts = ruleId.split('-');
                    if (parts.length >= 2) {
                        const ruleTypePart = parts[1]; // Get the rule type part
                        
                        const ruleTypeMapping = {
                            'latearrival': 'LATE_ARRIVAL',
                            'earlydeparture': 'EARLY_DEPARTURE',
                            'minimumhours': 'MINIMUM_HOURS',
                            'breakviolation': 'BREAK_VIOLATION',
                            'geofenceviolation': 'GEOFENCE_VIOLATION',
                            'absenteeism': 'ABSENTEEISM'
                        };
                        
                        actualRuleType = ruleTypeMapping[ruleTypePart.toLowerCase()] || ruleTypePart.toUpperCase();
                    }
                } else if (ruleId.includes('-')) {
                    // Pattern: "${orgId}-${ruleType}" -> extract ruleType
                    const ruleTypePart = ruleId.replace(`${orgId}-`, '');
                    
                    const ruleTypeMapping = {
                        'lateArrival': 'LATE_ARRIVAL',
                        'earlyDeparture': 'EARLY_DEPARTURE',
                        'minimumHours': 'MINIMUM_HOURS',
                        'breakViolation': 'BREAK_VIOLATION',
                        'geofenceViolation': 'GEOFENCE_VIOLATION',
                        'absenteeism': 'ABSENTEEISM'
                    };
                    
                    actualRuleType = ruleTypeMapping[ruleTypePart] || ruleTypePart.toUpperCase();
                }
                
                if (actualRuleType) {
                    // Try to find by orgId and ruleType
                    rule = await prisma.organizationAttendanceRules.findFirst({
                        where: {
                            orgId: orgId,
                            ruleType: actualRuleType
                        }
                    });
                    
                    if (rule) {
                        // Update the found rule
                        rule = await prisma.organizationAttendanceRules.update({
                            where: {
                                id: rule.id
                            },
                            data: {
                                isActive: Boolean(isActive),
                                updatedAt: new Date()
                            }
                        });
                    } else {
                        // Rule doesn't exist, create it with basic defaults
                        rule = await prisma.organizationAttendanceRules.create({
                            data: {
                                orgId: orgId,
                                ruleType: actualRuleType,
                                threshold: { minutes: 15 }, // Default threshold
                                penalty: { amount: 0, type: 'warning' }, // Default penalty
                                isActive: Boolean(isActive)
                            }
                        });
                    }
                } else {
                    return res.status(404).json({
                        error: "Rule not found",
                        message: `No rule found for ID: ${ruleId} - could not extract valid rule type`
                    });
                }
            } else {
                throw updateError;
            }
        }

        res.status(200).json({
            success: true,
            data: rule,
            message: `Rule ${isActive ? 'enabled' : 'disabled'} successfully`
        });
    } catch (error) {
        console.error('Error toggling rule status:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to update rule status"
        });
    }
};

/**
 * Delete attendance rule
 */
export const deleteRule = async (req, res) => {
    try {
        const { orgId, ruleId } = req.params;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        await prisma.organizationAttendanceRules.delete({
            where: {
                id: ruleId,
                orgId: orgId
            }
        });

        res.status(200).json({
            success: true,
            message: "Rule deleted successfully"
        });
    } catch (error) {
        console.error('Error deleting rule:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to delete attendance rule"
        });
    }
};

/**
 * Process attendance record against rules
 */
export const processAttendanceRecord = async (req, res) => {
    try {
        const { attendanceId } = req.params;

        // Get attendance record with user info
        const attendance = await prisma.attendanceRecord.findUnique({
            where: { id: attendanceId },
            include: {
                user: {
                    select: { id: true, orgId: true, firstName: true, lastName: true }
                }
            }
        });

        if (!attendance) {
            return res.status(404).json({
                error: "Attendance record not found"
            });
        }

        // Verify user has access
        if (req.user.orgId !== attendance.user.orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Get employee history for progressive analysis
        const employeeHistory = await rulesProcessor.getEmployeeViolationHistory(attendance.userId, 30);

        // Process attendance record
        const violations = await rulesProcessor.processAttendanceRecord(attendance, { recentAttendance: employeeHistory });

        // Calculate penalties for violations
        const penalties = await Promise.all(
            violations.map(async (violation) => {
                const penalty = await deductionEngine.calculatePenalty(
                    violation.type,
                    employeeHistory,
                    violation
                );
                return {
                    violation,
                    penalty
                };
            })
        );

        res.status(200).json({
            success: true,
            data: {
                attendanceId,
                employee: `${attendance.user.firstName} ${attendance.user.lastName}`,
                violations,
                penalties,
                totalViolations: violations.length,
                requiresApproval: penalties.some(p => p.penalty.requiresApproval)
            }
        });
    } catch (error) {
        console.error('Error processing attendance record:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to process attendance record"
        });
    }
};

/**
 * Get violation history for organization
 */
export const getViolationHistory = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            userId, 
            violationType, 
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
            attendance: {
                user: {
                    orgId
                }
            }
        };

        if (userId) where.attendance.userId = userId;
        if (violationType) where.violationType = violationType;
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate);
            if (toDate) where.createdAt.lte = new Date(toDate);
        }

        const [violations, total] = await Promise.all([
            prisma.attendanceRuleViolation.findMany({
                where,
                include: {
                    attendance: {
                        include: {
                            user: {
                                select: { id: true, firstName: true, lastName: true, employeeId: true }
                            }
                        }
                    },
                    rule: true,
                    approver: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.attendanceRuleViolation.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: {
                violations,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching violation history:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to fetch violation history"
        });
    }
};

/**
 * Approve or reject violation
 */
export const approveViolation = async (req, res) => {
    try {
        const { violationId } = req.params;
        const { approved, rejectionReason } = req.body;

        const violation = await prisma.attendanceRuleViolation.findUnique({
            where: { id: violationId },
            include: {
                attendance: {
                    include: {
                        user: { select: { orgId: true } }
                    }
                }
            }
        });

        if (!violation) {
            return res.status(404).json({
                error: "Violation not found"
            });
        }

        if (req.user.orgId !== violation.attendance.user.orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const updatedViolation = await prisma.attendanceRuleViolation.update({
            where: { id: violationId },
            data: {
                isApproved: Boolean(approved),
                approvedBy: req.user.id,
                approvedAt: new Date(),
                ...(rejectionReason && { rejectionReason })
            }
        });

        res.status(200).json({
            success: true,
            data: updatedViolation,
            message: `Violation ${approved ? 'approved' : 'rejected'} successfully`
        });
    } catch (error) {
        console.error('Error approving violation:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to update violation status"
        });
    }
};

/**
 * Get attendance rules analytics
 */
export const getRulesAnalytics = async (req, res) => {
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

        // Get violation statistics
        const violations = await prisma.attendanceRuleViolation.findMany({
            where: {
                attendance: {
                    user: { orgId }
                },
                createdAt: {
                    gte: fromDate
                }
            },
            include: {
                attendance: {
                    include: {
                        user: { select: { id: true, firstName: true, lastName: true } }
                    }
                }
            }
        });

        // Analyze violations
        const analytics = {
            totalViolations: violations.length,
            byType: {},
            bySeverity: {},
            byEmployee: {},
            approvalRate: 0,
            trends: {}
        };

        let approvedCount = 0;

        violations.forEach(violation => {
            // Group by type
            if (!analytics.byType[violation.violationType]) {
                analytics.byType[violation.violationType] = 0;
            }
            analytics.byType[violation.violationType]++;

            // Group by severity
            if (!analytics.bySeverity[violation.severity]) {
                analytics.bySeverity[violation.severity] = 0;
            }
            analytics.bySeverity[violation.severity]++;

            // Group by employee
            const employeeName = `${violation.attendance.user.firstName} ${violation.attendance.user.lastName}`;
            if (!analytics.byEmployee[employeeName]) {
                analytics.byEmployee[employeeName] = 0;
            }
            analytics.byEmployee[employeeName]++;

            // Count approvals
            if (violation.isApproved) {
                approvedCount++;
            }
        });

        analytics.approvalRate = violations.length > 0 ? 
            Math.round((approvedCount / violations.length) * 100) : 0;

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting rules analytics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get analytics"
        });
    }
};

/**
 * Bulk enable/disable rules
 */
export const bulkUpdateRules = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { rules } = req.body; // Array of { ruleType, isActive }

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (!Array.isArray(rules)) {
            return res.status(400).json({
                error: "Invalid request",
                message: "Rules must be an array"
            });
        }

        const updatePromises = rules.map(rule => 
            prisma.organizationAttendanceRules.updateMany({
                where: {
                    orgId,
                    ruleType: rule.ruleType
                },
                data: {
                    isActive: Boolean(rule.isActive),
                    updatedAt: new Date()
                }
            })
        );

        await Promise.all(updatePromises);

        res.status(200).json({
            success: true,
            message: `${rules.length} rules updated successfully`
        });
    } catch (error) {
        console.error('Error bulk updating rules:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to update rules"
        });
    }
};
