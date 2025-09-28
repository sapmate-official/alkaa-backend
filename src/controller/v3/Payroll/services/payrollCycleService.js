import prisma from "../../../../db/connectDb.js";
import { PayrollService } from "./payrollService.js";
import { EmailService } from "./emailService.js";

export class PayrollCycleService {
    /**
     * Create a new payroll cycle for an organization
     */
    static async createPayrollCycle(orgId, month, year, templateId = null, createdBy) {
        try {
            // Check if cycle already exists
            const existingCycle = await prisma.payrollCycle.findUnique({
                where: {
                    orgId_month_year: {
                        orgId,
                        month: parseInt(month),
                        year: parseInt(year)
                    }
                }
            });

            if (existingCycle) {
                throw new Error(`Payroll cycle for ${month}/${year} already exists`);
            }

            // Get total employees in organization
            const totalEmployees = await prisma.user.count({
                where: { 
                    orgId, 
                    status: 'active' 
                }
            });

            // Create the cycle
            const cycle = await prisma.payrollCycle.create({
                data: {
                    orgId,
                    month: parseInt(month),
                    year: parseInt(year),
                    totalEmployees,
                    status: 'DRAFT'
                }
            });

            // Log the action
            await this.createAuditLog(cycle.id, null, 'CYCLE_CREATED', null, null, createdBy);

            return cycle;
        } catch (error) {
            console.error("[PAYROLL_CYCLE] Error creating cycle:", error);
            throw error;
        }
    }

    /**
     * Start bulk salary generation for a payroll cycle
     */
    static async startPayrollCycle(cycleId, userId) {
        try {
            const cycle = await prisma.payrollCycle.findUnique({
                where: { id: cycleId },
                include: { organization: true }
            });

            if (!cycle) {
                throw new Error("Payroll cycle not found");
            }

            if (cycle.status !== 'DRAFT') {
                throw new Error(`Cannot start cycle with status: ${cycle.status}`);
            }

            // Update cycle status
            await prisma.payrollCycle.update({
                where: { id: cycleId },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: new Date(),
                    startedBy: userId
                }
            });

            // Get all active employees in the organization
            const employees = await prisma.user.findMany({
                where: {
                    orgId: cycle.orgId,
                    status: 'active'
                },
                include: {
                    salaryParameter: true
                }
            });

            let processedCount = 0;
            let failedCount = 0;
            let totalAmount = 0;
            const errors = [];

            // Generate salary for each employee
            for (const employee of employees) {
                try {
                    const salaryRecord = await PayrollService.generateSalary(
                        employee.id, 
                        cycle.month, 
                        cycle.year,
                        cycleId // Pass cycle ID
                    );
                    
                    processedCount++;
                    totalAmount += salaryRecord.netSalary;
                    
                    // Log individual salary generation
                    await this.createAuditLog(
                        cycleId, 
                        salaryRecord.id, 
                        'SALARY_GENERATED', 
                        null, 
                        { employeeId: employee.id, amount: salaryRecord.netSalary }, 
                        userId
                    );
                } catch (error) {
                    failedCount++;
                    errors.push({
                        employeeId: employee.id,
                        employeeName: `${employee.firstName} ${employee.lastName}`,
                        error: error.message
                    });
                    console.error(`[PAYROLL_CYCLE] Failed to generate salary for ${employee.id}:`, error);
                }
            }

            // Update cycle with results
            const updatedCycle = await prisma.payrollCycle.update({
                where: { id: cycleId },
                data: {
                    processedCount,
                    failedCount,
                    totalAmount,
                    status: failedCount === 0 ? 'REVIEW_PENDING' : 'FAILED',
                    completedAt: failedCount === 0 ? new Date() : null,
                    notes: errors.length > 0 ? JSON.stringify({ errors }) : null
                }
            });

            // Log cycle completion
            await this.createAuditLog(
                cycleId, 
                null, 
                'CYCLE_STARTED', 
                null, 
                { processedCount, failedCount, totalAmount }, 
                userId
            );

            return {
                cycle: updatedCycle,
                processedCount,
                failedCount,
                totalAmount,
                errors
            };
        } catch (error) {
            console.error("[PAYROLL_CYCLE] Error starting cycle:", error);
            
            // Update cycle status to failed
            await prisma.payrollCycle.update({
                where: { id: cycleId },
                data: { status: 'FAILED' }
            });
            
            throw error;
        }
    }

    /**
     * Approve a payroll cycle (bulk approve all salaries)
     */
    static async approvePayrollCycle(cycleId, userId, notes = null) {
        try {
            const cycle = await prisma.payrollCycle.findUnique({
                where: { id: cycleId },
                include: { salaryRecords: true }
            });

            if (!cycle) {
                throw new Error("Payroll cycle not found");
            }

            if (cycle.status !== 'REVIEW_PENDING') {
                throw new Error(`Cannot approve cycle with status: ${cycle.status}`);
            }

            // Update all salary records to PROCESSED
            await prisma.salaryRecord.updateMany({
                where: { cycleId },
                data: { 
                    status: 'PROCESSED',
                    processedAt: new Date()
                }
            });

            // Update cycle status
            const approvedCycle = await prisma.payrollCycle.update({
                where: { id: cycleId },
                data: {
                    status: 'APPROVED',
                    approvedBy: userId,
                    approvedAt: new Date(),
                    notes
                }
            });

            // Log the approval
            await this.createAuditLog(
                cycleId, 
                null, 
                'CYCLE_APPROVED', 
                null, 
                { approvedBy: userId, notes }, 
                userId
            );

            // Send notifications to employees (optional)
            // await this.notifyEmployees(cycle.salaryRecords);

            return approvedCycle;
        } catch (error) {
            console.error("[PAYROLL_CYCLE] Error approving cycle:", error);
            throw error;
        }
    }

    /**
     * Get payroll cycles for an organization
     */
    static async getPayrollCycles(orgId, page = 1, limit = 10, status = null) {
        const skip = (page - 1) * limit;
        
        const where = { orgId };
        if (status) {
            where.status = status;
        }

        const [cycles, total] = await Promise.all([
            prisma.payrollCycle.findMany({
                where,
                include: {
                    organization: {
                        select: { name: true }
                    },
                    salaryRecords: {
                        include: {
                            user: {
                                select: { firstName: true, lastName: true }
                            }
                        }
                    }
                },
                orderBy: [
                    { year: 'desc' },
                    { month: 'desc' }
                ],
                skip,
                take: limit
            }),
            prisma.payrollCycle.count({ where })
        ]);

        return {
            cycles,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get detailed information about a payroll cycle
     */
    static async getPayrollCycleDetails(cycleId) {
        const cycle = await prisma.payrollCycle.findUnique({
            where: { id: cycleId },
            include: {
                organization: {
                    select: { name: true }
                },
                template: true,
                processor: {
                    select: { firstName: true, lastName: true, email: true }
                },
                approver: {
                    select: { firstName: true, lastName: true, email: true }
                },
                salaryRecords: {
                    include: {
                        user: {
                            select: { 
                                firstName: true, 
                                lastName: true, 
                                email: true, 
                                employeeId: true,
                                department: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                auditLogs: {
                    include: {
                        user: {
                            select: { firstName: true, lastName: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!cycle) {
            throw new Error("Payroll cycle not found");
        }

        return cycle;
    }

    /**
     * Create audit log entry
     */
    static async createAuditLog(cycleId, salaryId, action, previousData, newData, userId) {
        return await prisma.payrollCycleAudit.create({
            data: {
                cycleId,
                salaryRecordId: salaryId,
                action,
                previousData,
                newData,
                userId
            }
        });
    }

    /**
     * Get cycles that need review (for dashboard)
     */
    static async getCyclesNeedingReview(orgId) {
        return await prisma.payrollCycle.findMany({
            where: {
                orgId,
                status: 'REVIEW'
            },
            include: {
                organization: {
                    select: { name: true }
                },
                salaryRecords: {
                    include: {
                        user: {
                            select: { firstName: true, lastName: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get payroll statistics for organization
     */
    static async getPayrollStatistics(orgId, year = null) {
        const currentYear = year || new Date().getFullYear();
        
        const cycles = await prisma.payrollCycle.findMany({
            where: {
                orgId,
                year: currentYear
            },
            select: {
                month: true,
                status: true,
                totalAmount: true,
                processedCount: true
            }
        });

        const totalPaid = cycles
            .filter(c => c.status === 'COMPLETED')
            .reduce((sum, c) => sum + c.totalAmount, 0);

        const totalEmployeesProcessed = cycles
            .reduce((sum, c) => sum + c.processedCount, 0);

        return {
            year: currentYear,
            totalCycles: cycles.length,
            completedCycles: cycles.filter(c => c.status === 'COMPLETED').length,
            pendingCycles: cycles.filter(c => c.status === 'REVIEW').length,
            failedCycles: cycles.filter(c => c.status === 'CANCELLED').length,
            totalAmountPaid: totalPaid,
            totalEmployeesProcessed,
            monthlyBreakdown: cycles.map(c => ({
                month: c.month,
                status: c.status,
                amount: c.totalAmount,
                employees: c.processedCount
            }))
        };
    }
}
