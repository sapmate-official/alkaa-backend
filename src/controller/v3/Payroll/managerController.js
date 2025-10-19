import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';

// Get team payroll records for manager review
export const getTeamPayrollRecords = async (req, res) => {
    try {
    const { id: managerId, orgId } = req.user;
    const isOrgAdmin = req.isOrgAdmin ?? false;
        const { status, month, year } = req.query;

        // Get manager's subordinates
        const subordinates = await prisma.user.findMany({
            where: {
                managerId: managerId,
                orgId: orgId,
                status: 'active'
            },
            select: { id: true }
        });

        const subordinateIds = subordinates.map(sub => sub.id);

        if (subordinateIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No team members found',
                data: []
            });
        }

        // Build where clause for salary records
        const whereClause = {
            userId: { in: subordinateIds },
            orgId: orgId
        };

        if (status) {
            whereClause.status = status;
        }

        if (month && year) {
            whereClause.month = parseInt(month);
            whereClause.year = parseInt(year);
        }

        const payrollRecords = await prisma.salaryRecord.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                reviewedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: [
                { status: 'asc' },
                { createdAt: 'desc' }
            ]
        });

        // Transform data to match frontend interface
        const transformedRecords = payrollRecords.map(record => ({
            id: record.id,
            employee: {
                id: record.user.id,
                firstName: record.user.firstName,
                lastName: record.user.lastName,
                employeeId: record.user.employeeId,
                department: record.user.department?.name || 'Unknown'
            },
            month: record.month,
            year: record.year,
            basicSalary: record.basicSalary,
            netSalary: record.netSalary,
            allowances: record.allowances || {},
            deductions: record.deductions || {},
            status: record.status,
            processedAt: record.processedAt,
            reviewedAt: record.reviewedAt,
            reviewComments: record.reviewComments,
            anomalies: record.anomalies || []
        }));

        return res.status(200).json({
            success: true,
            message: 'Team payroll records retrieved successfully',
            data: transformedRecords
        });
    } catch (error) {
        console.error('Error fetching team payroll records:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch team payroll records',
            error: error.message
        });
    }
};

// Get team statistics for manager
export const getTeamStatistics = async (req, res) => {
    try {
        const { id: managerId, orgId } = req.user;
        const { month, year } = req.query;

        // Get manager's subordinates
        const subordinates = await prisma.user.findMany({
            where: {
                managerId: managerId,
                orgId: orgId,
                status: 'active'
            },
            select: { id: true }
        });

        const subordinateIds = subordinates.map(sub => sub.id);
        const totalEmployees = subordinateIds.length;

        if (totalEmployees === 0) {
            return res.status(200).json({
                success: true,
                message: 'Team statistics retrieved successfully',
                data: {
                    totalEmployees: 0,
                    pendingReviews: 0,
                    approvedCount: 0,
                    rejectedCount: 0,
                    totalPayrollAmount: 0,
                    averageSalary: 0
                }
            });
        }

        // Build where clause for current period
        const whereClause = {
            userId: { in: subordinateIds },
            orgId: orgId
        };

        if (month && year) {
            whereClause.month = parseInt(month);
            whereClause.year = parseInt(year);
        } else {
            // Default to current month if not specified
            const now = new Date();
            whereClause.month = now.getMonth() + 1;
            whereClause.year = now.getFullYear();
        }

        // Get salary records statistics
        const [pendingRecords, approvedRecords, rejectedRecords, allRecords] = await Promise.all([
            prisma.salaryRecord.count({
                where: { ...whereClause, status: 'PROCESSED' }
            }),
            prisma.salaryRecord.count({
                where: { ...whereClause, status: 'APPROVED' }
            }),
            prisma.salaryRecord.count({
                where: { ...whereClause, status: 'REJECTED' }
            }),
            prisma.salaryRecord.findMany({
                where: whereClause,
                select: {
                    netSalary: true
                }
            })
        ]);

        const totalPayrollAmount = allRecords.reduce((sum, record) => sum + (record.netSalary || 0), 0);
        const averageSalary = allRecords.length > 0 ? totalPayrollAmount / allRecords.length : 0;

        const statistics = {
            totalEmployees,
            pendingReviews: pendingRecords,
            approvedCount: approvedRecords,
            rejectedCount: rejectedRecords,
            totalPayrollAmount,
            averageSalary
        };

        return res.status(200).json({
            success: true,
            message: 'Team statistics retrieved successfully',
            data: statistics
        });
    } catch (error) {
        console.error('Error fetching team statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch team statistics',
            error: error.message
        });
    }
};

// Approve payroll record
export const approvePayrollRecord = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { id: managerId, orgId } = req.user;
        const isOrgAdmin = req.isOrgAdmin ?? false;
        const { comments } = req.body;

        // Verify the record exists and belongs to manager's team
        const record = await prisma.salaryRecord.findFirst({
            where: {
                id: recordId,
                orgId: orgId
            },
            include: {
                user: {
                    select: {
                        managerId: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Payroll record not found'
            });
        }

        if (!isOrgAdmin && record.user.managerId !== managerId) {
            return res.status(403).json({
                success: false,
                message: 'You can only approve records for your direct reports'
            });
        }

        if (record.status !== 'PROCESSED') {
            return res.status(400).json({
                success: false,
                message: 'Record must be in PROCESSED status to approve'
            });
        }

        const updatedRecord = await prisma.salaryRecord.update({
            where: { id: recordId },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewedById: managerId,
                reviewComments: comments || null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: `Payroll record for ${record.user.firstName} ${record.user.lastName} approved successfully`,
            data: updatedRecord
        });
    } catch (error) {
        console.error('Error approving payroll record:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to approve payroll record',
            error: error.message
        });
    }
};

// Reject payroll record
export const rejectPayrollRecord = async (req, res) => {
    try {
        const { recordId } = req.params;
        const { id: managerId, orgId } = req.user;
        const isOrgAdmin = req.isOrgAdmin ?? false;
        const { comments } = req.body;

        if (!comments || comments.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Comments are required when rejecting a payroll record'
            });
        }

        // Verify the record exists and belongs to manager's team
        const record = await prisma.salaryRecord.findFirst({
            where: {
                id: recordId,
                orgId: orgId
            },
            include: {
                user: {
                    select: {
                        managerId: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        if (!record) {
            return res.status(404).json({
                success: false,
                message: 'Payroll record not found'
            });
        }

        if (!isOrgAdmin && record.user.managerId !== managerId) {
            return res.status(403).json({
                success: false,
                message: 'You can only reject records for your direct reports'
            });
        }

        if (record.status !== 'PROCESSED') {
            return res.status(400).json({
                success: false,
                message: 'Record must be in PROCESSED status to reject'
            });
        }

        const updatedRecord = await prisma.salaryRecord.update({
            where: { id: recordId },
            data: {
                status: 'REJECTED',
                reviewedAt: new Date(),
                reviewedById: managerId,
                reviewComments: comments
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: `Payroll record for ${record.user.firstName} ${record.user.lastName} rejected`,
            data: updatedRecord
        });
    } catch (error) {
        console.error('Error rejecting payroll record:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reject payroll record',
            error: error.message
        });
    }
};

// Bulk approve payroll records
export const bulkApproveRecords = async (req, res) => {
    try {
        const { id: managerId, orgId } = req.user;
        const isOrgAdmin = req.isOrgAdmin ?? false;
        const { recordIds, comments } = req.body;

        if (!recordIds || recordIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No records specified for approval'
            });
        }

        // Verify all records exist and belong to manager's team
        const records = await prisma.salaryRecord.findMany({
            where: {
                id: { in: recordIds },
                orgId: orgId,
                status: 'PROCESSED'
            },
            include: {
                user: {
                    select: {
                        managerId: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });

        const validRecords = isOrgAdmin
            ? records
            : records.filter(record => record.user.managerId === managerId);

        if (validRecords.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid records found for approval'
            });
        }

        const validRecordIds = validRecords.map(record => record.id);

        // Bulk update
        const updateResult = await prisma.salaryRecord.updateMany({
            where: {
                id: { in: validRecordIds }
            },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewedById: managerId,
                reviewComments: comments || null
            }
        });

        return res.status(200).json({
            success: true,
            message: `${updateResult.count} payroll records approved successfully`,
            data: {
                approvedCount: updateResult.count,
                totalRequested: recordIds.length
            }
        });
    } catch (error) {
        console.error('Error bulk approving records:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to bulk approve records',
            error: error.message
        });
    }
};

// Get pending review records for manager
export const getPendingReviewRecords = async (req, res) => {
    try {
        const { id: managerId, orgId } = req.user;

        // Get manager's subordinates
        const subordinates = await prisma.user.findMany({
            where: {
                managerId: managerId,
                orgId: orgId,
                status: 'active'
            },
            select: { id: true }
        });

        const subordinateIds = subordinates.map(sub => sub.id);

        if (subordinateIds.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No pending reviews found',
                data: []
            });
        }

        const pendingRecords = await prisma.salaryRecord.findMany({
            where: {
                userId: { in: subordinateIds },
                orgId: orgId,
                status: 'PROCESSED'
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        return res.status(200).json({
            success: true,
            message: 'Pending review records retrieved successfully',
            data: pendingRecords
        });
    } catch (error) {
        console.error('Error fetching pending reviews:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending reviews',
            error: error.message
        });
    }
};
