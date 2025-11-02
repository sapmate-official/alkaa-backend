import prisma from "../../../db/connectDb.js";
import contractExpiryChecker from "../../../jobs/contractExpiryChecker.js";
import employmentTypeRuleService from "../../../services/employmentType/employmentTypeRuleService.js";

/**
 * Get all employment type policies for an organization
 */
export const getOrganizationPolicies = async (req, res) => {
    try {
        const { orgId } = req.params;

        const policies = await prisma.employmentTypePolicy.findMany({
            where: { orgId },
            orderBy: { employmentType: 'asc' }
        });

        return res.status(200).json({
            success: true,
            data: policies
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error fetching policies:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employment type policies',
            error: error.message
        });
    }
};

/**
 * Get a specific employment type policy
 */
export const getPolicyByType = async (req, res) => {
    try {
        const { orgId, employmentType } = req.params;

        const policy = await prisma.employmentTypePolicy.findUnique({
            where: {
                orgId_employmentType: {
                    orgId,
                    employmentType
                }
            }
        });

        if (!policy) {
            return res.status(404).json({
                success: false,
                message: 'Policy not found for this employment type'
            });
        }

        return res.status(200).json({
            success: true,
            data: policy
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error fetching policy:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employment type policy',
            error: error.message
        });
    }
};

/**
 * Create or update employment type policy
 */
export const createOrUpdatePolicy = async (req, res) => {
    try {
        const { orgId, employmentType } = req.params;
        const {
            overrideAttendanceHours,
            attendanceConfig,
            overrideLeaveEligibility,
            leaveConfig,
            overrideBreakRules,
            breakConfig,
            overridePayrollRules,
            payrollConfig
        } = req.body;

        // Validate employment type
        const validTypes = ['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT'];
        if (!validTypes.includes(employmentType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid employment type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        const policy = await prisma.employmentTypePolicy.upsert({
            where: {
                orgId_employmentType: {
                    orgId,
                    employmentType
                }
            },
            update: {
                overrideAttendanceHours: overrideAttendanceHours ?? undefined,
                attendanceConfig: attendanceConfig ?? undefined,
                overrideLeaveEligibility: overrideLeaveEligibility ?? undefined,
                leaveConfig: leaveConfig ?? undefined,
                overrideBreakRules: overrideBreakRules ?? undefined,
                breakConfig: breakConfig ?? undefined,
                overridePayrollRules: overridePayrollRules ?? undefined,
                payrollConfig: payrollConfig ?? undefined,
                updatedAt: new Date()
            },
            create: {
                orgId,
                employmentType,
                overrideAttendanceHours: overrideAttendanceHours ?? false,
                attendanceConfig,
                overrideLeaveEligibility: overrideLeaveEligibility ?? false,
                leaveConfig,
                overrideBreakRules: overrideBreakRules ?? false,
                breakConfig,
                overridePayrollRules: overridePayrollRules ?? false,
                payrollConfig
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employment type policy saved successfully',
            data: policy
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error saving policy:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save employment type policy',
            error: error.message
        });
    }
};

/**
 * Delete employment type policy
 */
export const deletePolicy = async (req, res) => {
    try {
        const { orgId, employmentType } = req.params;

        await prisma.employmentTypePolicy.delete({
            where: {
                orgId_employmentType: {
                    orgId,
                    employmentType
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employment type policy deleted successfully'
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error deleting policy:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete employment type policy',
            error: error.message
        });
    }
};

/**
 * Get employees by employment type
 */
export const getEmployeesByType = async (req, res) => {
    try {
        const { orgId, employmentType } = req.params;

        const employees = await prisma.user.findMany({
            where: {
                orgId,
                employmentType
            },
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                employmentType: true,
                contractEndDate: true,
                isActive: true,
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: employees,
            count: employees.length
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error fetching employees:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employees by employment type',
            error: error.message
        });
    }
};

/**
 * Update user employment type
 */
export const updateUserEmploymentType = async (req, res) => {
    try {
        const { userId } = req.params;
        const { employmentType, contractEndDate, effectiveDate, reason, notes } = req.body;
        const changedBy = req.user.id;

        // Validate employment type
        const validTypes = ['FULL_TIME', 'PART_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT'];
        if (employmentType && !validTypes.includes(employmentType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid employment type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        // Get current user data
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                employmentType: true,
                contractEndDate: true,
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

        // Validate contract end date for non-full-time employees
        if (employmentType && employmentType !== 'FULL_TIME' && contractEndDate) {
            const endDate = new Date(contractEndDate);
            if (endDate < new Date()) {
                return res.status(400).json({
                    success: false,
                    message: 'Contract end date cannot be in the past'
                });
            }
        }

        const updateData = {};
        if (employmentType) updateData.employmentType = employmentType;
        if (contractEndDate !== undefined) {
            updateData.contractEndDate = contractEndDate ? new Date(contractEndDate) : null;
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
                email: true,
                employmentType: true,
                contractEndDate: true,
                isActive: true
            }
        });

        // Create employment type history entry
        await prisma.employmentTypeHistory.create({
            data: {
                userId,
                previousType: currentUser.employmentType,
                newType: employmentType || currentUser.employmentType,
                previousContractEnd: currentUser.contractEndDate,
                newContractEnd: contractEndDate ? new Date(contractEndDate) : null,
                changedBy,
                effectiveDate: effectiveDate ? new Date(effectiveDate) : new Date(),
                reason: reason || null,
                notes: notes || null
            }
        });

        // Create activity log
        await prisma.activityLog.create({
            data: {
                action: 'UPDATE',
                entity: 'USER',
                entityId: userId,
                description: `Employment type changed from ${currentUser.employmentType} to ${employmentType || currentUser.employmentType}${reason ? ` - Reason: ${reason}` : ''}`,
                actorId: changedBy,
                orgId: req.user.orgId,
                metadata: {
                    previousType: currentUser.employmentType,
                    newType: employmentType || currentUser.employmentType,
                    previousContractEnd: currentUser.contractEndDate,
                    newContractEnd: contractEndDate,
                    reason
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: 'User employment type updated successfully',
            data: user
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error updating user employment type:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update user employment type',
            error: error.message
        });
    }
};

/**
 * Get employment type history for a user
 */
export const getEmploymentTypeHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        const history = await prisma.employmentTypeHistory.findMany({
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

        const total = await prisma.employmentTypeHistory.count({
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
        console.error('[EMPLOYMENT_TYPE_POLICY] Error fetching employment type history:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employment type history',
            error: error.message
        });
    }
};

/**
 * Get expiring contracts for organization
 */
export const getExpiringContracts = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { daysAhead = 30 } = req.query;

        const expiringContracts = await contractExpiryChecker.getExpiringContracts(
            orgId,
            parseInt(daysAhead)
        );

        return res.status(200).json({
            success: true,
            data: expiringContracts,
            count: expiringContracts.length
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error fetching expiring contracts:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch expiring contracts',
            error: error.message
        });
    }
};

/**
 * Get user's employment type rules summary
 */
export const getUserRulesSummary = async (req, res) => {
    try {
        const { userId, orgId } = req.params;

        const summary = await employmentTypeRuleService.getUserRulesSummary(userId, orgId);

        return res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('[EMPLOYMENT_TYPE_POLICY] Error fetching user rules summary:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch user rules summary',
            error: error.message
        });
    }
};
