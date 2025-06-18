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
    static async generateSalary(targetUserId, month, year) {
        console.log("[SALARY_GENERATE] Starting salary generation for user:", targetUserId);

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

        if (existingSalary) {
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

        // Create salary record
        const salaryRecord = await this.createSalaryRecord({
            userId: targetUserId,
            month: parseInt(month),
            year: parseInt(year),
            basicSalary: baseSalary,
            netSalary: netSalary,
            allowances: allowances.breakdown,
            deductions: deductions.breakdown,
            adjustmentAmount
        });

        return salaryRecord;
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
                    createdAt: true
                }
            });

            const key = `${userId}_${month}_${year}`;
            statusMap[key] = existingRecord ? {
                exists: true,
                status: existingRecord.status,
                salaryRecordId: existingRecord.id,
                netSalary: existingRecord.netSalary,
                createdAt: existingRecord.createdAt
            } : {
                exists: false
            };
        }

        return statusMap;
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
    }    static async createSalaryRecord(salaryData) {
        const monthName = new Date(salaryData.year, salaryData.month - 1, 1).toLocaleString('default', { month: 'long' });
        
        // Remove adjustmentAmount from salaryData as it's not a valid field in SalaryRecord
        const { adjustmentAmount, ...validSalaryData } = salaryData;
        
        return await prisma.salaryRecord.create({
            data: {
                ...validSalaryData,
                tax: salaryData.deductions.tax || 0,
                status: "PENDING",
                remarks: `Salary for ${monthName} ${salaryData.year}${adjustmentAmount > 0 ? ` (includes adjustment of ${adjustmentAmount.toFixed(2)})` : ''}`
            }
        });
    }    static async getAdditionalStatisticsData(salaryRecord) {
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
}
