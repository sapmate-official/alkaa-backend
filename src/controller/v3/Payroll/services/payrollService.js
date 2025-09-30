import prisma from "../../../../db/connectDb.js";
import { calculateAllowances, calculateDeductions, calculateNetSalary } from "../utils/salaryCalculations.js";
import { calculateAttendanceStats } from "../utils/attendanceUtils.js";
import { processLeaveAdjustments, processAttendanceAdjustments } from "../utils/adjustmentUtils.js";

export class PayrollService {
    /**
     * Get payslips based on parameters
     */
    static async getPayslips(userId, month, year) {
        const query = {
            where: {
                userId: userId
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        },
                        bankDetails: {
                            select: {
                                accountNumber: true,
                                bankName: true,
                                ifscCode: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                {year: 'desc'},
                {month: 'desc'}
            ]
        };

        // Add month and year filters if provided
        if (month && month !== 'undefined') {
            query.where.month = parseInt(month);
        }

        if (year && year !== 'undefined') {
            query.where.year = parseInt(year);
        }

        return await prisma.salaryRecord.findMany(query);
    }

    /**
     * Generate salary for a user
     */
    static async generateSalary(targetUserId, month, year, cycleId = null, options = {}) {
        console.log("[SALARY_GENERATE] Starting salary generation for user:", targetUserId);

        const { replaceExisting = false, initiatedBy = null } = options;

        // Check if salary already exists
        const existingSalary = await prisma.salaryRecord.findUnique({
            where: {
                userId_month_year: {
                    userId: targetUserId,
                    month: parseInt(month),
                    year: parseInt(year)
                }
            }
        });

        if (existingSalary && !replaceExisting) {
            throw new Error("Salary for this month and year already exists");
        }

        // Process pending adjustments
        const adjustmentAmount = await this.processPendingAdjustments(targetUserId, month, year);

        // Fetch user data
    const user = await this.fetchUserData(targetUserId);
        
        // Get salary parameters
        const salaryParams = user.salaryParameter || this.getDefaultSalaryParams();
        
        // Get base salary
        const baseSalary = user.monthlySalary || 0;

        // Calculate working days and attendance
        const { workingDays, attendanceStats } = await calculateAttendanceStats(targetUserId, month, year, user.orgId);

        // Calculate allowances
        const allowances = calculateAllowances(baseSalary, salaryParams, adjustmentAmount);

        // Calculate deductions
        const deductions = calculateDeductions(baseSalary, salaryParams, attendanceStats, workingDays);

        // Calculate net salary
        const netSalary = calculateNetSalary(baseSalary, allowances, deductions);

        // Create salary record with cycle reference
        const wasReplaced = Boolean(existingSalary);

        const salaryRecord = await this.createSalaryRecord({
            userId: targetUserId,
            cycleId, // Add cycle reference
            orgId: user.orgId,
            month: parseInt(month),
            year: parseInt(year),
            basicSalary: baseSalary,
            netSalary: netSalary,
            allowances: allowances.breakdown,
            deductions: deductions.breakdown,
            adjustmentAmount
        }, existingSalary, {
            initiatedBy,
            adjustmentAmount,
            replaceExisting
        });

        return {
            ...salaryRecord,
            wasReplaced,
            initiatedBy
        };
    }

    /**
     * Get salary statistics
     */    static async getSalaryStatistics(salaryRecordId) {
        const salaryRecord = await prisma.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    include: {
                        department: true,
                        bankDetails: true,
                        organization: true
                    }
                }
            }
        });

        if (!salaryRecord) {
            throw new Error("Salary record not found");
        }

        // Get additional statistics data
        const additionalData = await this.getAdditionalStatisticsData(salaryRecord);

        return {
            salaryRecord,
            ...additionalData
        };
    }

    /**
     * Check multiple payslip status
     */
    static async checkMultiplePayslipStatus(payslipData) {
        const statusMap = {};

        for (const data of payslipData) {
            const { userId, month, year } = data;
            
            const existingRecord = await prisma.salaryRecord.findUnique({
                where: {
                    userId_month_year: {
                        userId,
                        month: parseInt(month),
                        year: parseInt(year)
                    }
                },
                select: {
                    id: true,
                    status: true,
                    netSalary: true,
                    paymentStatus: true,
                    createdAt: true
                }
            });

            const key = `${userId}_${month}_${year}`;
            statusMap[key] = existingRecord ? {
                exists: true,
                status: existingRecord.status,
                salaryRecordId: existingRecord.id,
                netSalary: existingRecord.netSalary,
                paymentStatus: existingRecord.paymentStatus,
                createdAt: existingRecord.createdAt
            } : {
                exists: false
            };
        }

        return statusMap;
    }

    /**
     * Bulk approve salaries
     */
    static async bulkApproveSalaries(salaryRecordIds, approvedBy, notes = null) {
        try {
            const now = new Date();
            const result = await prisma.salaryRecord.updateMany({
                where: {
                    id: { in: salaryRecordIds },
                    status: 'PROCESSED'
                },
                data: {
                    status: 'APPROVED',
                    paymentStatus: 'PENDING',
                    processedAt: now,
                    reviewedAt: now,
                    reviewedById: approvedBy,
                    reviewComments: notes,
                    remarks: notes ? `${notes} - Bulk approved` : 'Bulk approved'
                }
            });

            // Log the bulk approval
            for (const salaryRecordId of salaryRecordIds) {
                await prisma.activityLog.create({
                    data: {
                        orgId: await this.getOrgIdFromSalaryRecord(salaryRecordId),
                        actorId: approvedBy,
                        action: 'APPROVE',
                        entity: 'SALARY_RECORD',
                        entityId: salaryRecordId,
                        description: `Bulk approved salary record ${salaryRecordId}`
                    }
                });
            }

            return result;
        } catch (error) {
            console.error("[BULK_APPROVE_SALARIES] Error:", error);
            throw error;
        }
    }

    /**
     * Helper method to get organization ID from salary record
     */
    static async getOrgIdFromSalaryRecord(salaryRecordId) {
        const salaryRecord = await prisma.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    select: { orgId: true }
                }
            }
        });
        return salaryRecord?.user?.orgId;
    }

    // Private helper methods
    static async processPendingAdjustments(targetUserId, month, year) {
        const currentSalaryKey = `${year}-${month.toString().padStart(2, '0')}`;
        
        const leaveAdjustments = await processLeaveAdjustments(targetUserId, currentSalaryKey);
        const attendanceAdjustments = await processAttendanceAdjustments(targetUserId, currentSalaryKey);

        return leaveAdjustments + attendanceAdjustments;
    }

    static async fetchUserData(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                salaryParameter: true,
                department: true,
                organization: true
            }
        });

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    }

    static getDefaultSalaryParams() {
        return {
            hraPercentage: 0,
            daPercentage: 0,
            taPercentage: 0,
            pfPercentage: 0,
            taxPercentage: 0,
            insuranceFixed: 0,
            additionalAllowances: {},
            additionalDeductions: {}
        };
    }

    static async createSalaryRecord(salaryData, existingRecord = null, metadata = {}) {
        const monthName = new Date(salaryData.year, salaryData.month - 1, 1).toLocaleString('default', { month: 'long' });

        const { adjustmentAmount = 0 } = metadata;

        // Remove adjustmentAmount from salaryData as it's not a valid field in SalaryRecord
        const { adjustmentAmount: _ignoredAdjustment, ...validSalaryData } = salaryData;

        const processedAt = new Date();
        const taxAmount = validSalaryData.deductions?.tax || 0;

        const baseData = {
            ...validSalaryData,
            tax: taxAmount,
            status: "PROCESSED",
            paymentStatus: 'PENDING',
            processedAt,
            reviewedById: null,
            reviewedAt: null,
            reviewComments: null,
            paymentMode: null,
            paymentRef: null,
            remarks: `Salary for ${monthName} ${salaryData.year}${adjustmentAmount > 0 ? ` (includes adjustment of ${adjustmentAmount.toFixed(2)})` : ''}`
        };

        if (existingRecord) {
            return await prisma.salaryRecord.update({
                where: { id: existingRecord.id },
                data: {
                    ...baseData,
                    salaryTransactions: {
                        deleteMany: {}
                    }
                }
            });
        }

        return await prisma.salaryRecord.create({
            data: baseData
        });
    }

    static async getAdditionalStatisticsData(salaryRecord) {
        const { month, year, userId } = salaryRecord;

        // Get working days calculation
        const orgId = salaryRecord.user?.organization?.id || salaryRecord.user?.orgId;
        if (!orgId) {
            throw new Error("Organization information not found for salary record");
        }
        
        const { workingDays, attendanceStats } = await calculateAttendanceStats(userId, month, year, orgId);

        // Get YTD earnings
        const ytdEarnings = await prisma.salaryRecord.findMany({
            where: {
                userId: userId,
                year: year,
                month: { lte: month }
            },
            select: { netSalary: true }
        });

        const ytdTotal = ytdEarnings.reduce((sum, record) => sum + record.netSalary, 0);

        // Get previous month comparison
        const previousMonth = month === 1 ? 12 : month - 1;
        const previousYear = month === 1 ? year - 1 : year;
        
        const previousSalaryRecord = await prisma.salaryRecord.findUnique({
            where: {
                userId_month_year: {
                    userId: userId,
                    month: previousMonth,
                    year: previousYear
                }
            }
        });


        return {
            workingDays,
            attendanceStats,
            ytdTotal,
            previousSalaryRecord
        };
    }
    static async preStatsSalaryGeneration(targetUserId, validMonth, validYear){
        try {
            const user = await this.fetchUserData(targetUserId);
            // Calculate working days and attendance statistics using attendanceUtils function
            const { workingDays, attendanceStats } = await calculateAttendanceStats(targetUserId, validMonth, validYear, user.orgId);
            // Fetch verified attendance, unverified attendance, and leave stats for this month
            const verifiedAttendance = await prisma.attendanceRecord.count({
                where: {
                    userId: targetUserId,
                    date: {
                        gte: new Date(validYear, validMonth - 1, 1),
                        lt: new Date(validYear, validMonth, 1)
                    },
                    verificationStatus: 'VERIFIED'
                }
            });

            const unverifiedAttendance = await prisma.attendanceRecord.count({
                where: {
                    userId: targetUserId,
                    date: {
                        gte: new Date(validYear, validMonth - 1, 1),
                        lt: new Date(validYear, validMonth, 1)
                    },
                    verificationStatus: 'UNVERIFIED'
                }
            });

            const leaveStats = await prisma.leaveRequest.findMany({
                where: {
                    userId: targetUserId,
                    startDate: {
                        gte: new Date(validYear, validMonth - 1, 1),
                        lt: new Date(validYear, validMonth, 1)
                    },
                    status: 'APPROVED'
                },
                select: {
                    leaveType: true,
                    numberOfDays: true,
                    startDate: true,
                    endDate: true
                }
            });

            return {
                userId: targetUserId,
                month: validMonth,
                year: validYear,
                workingDays: workingDays,
                attendanceStats: attendanceStats,
                verifiedAttendance: verifiedAttendance,
                unverifiedAttendance: unverifiedAttendance,
                leaveStats: leaveStats,
                userName: `${user.firstName} ${user.lastName}`,
                department: user.department ? user.department.name : "N/A",
                organization: user.organization ? user.organization.name : "N/A"
            }
        }catch (e) {
            console.error(e);
            throw new Error("Failed to pre-generate salary statistics");

        }
    }
}
