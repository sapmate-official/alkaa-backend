import prisma from "../../../../db/connectDb.js";
import { payrollCycleQueue, PAYROLL_PROCESSING_JOB_TYPE } from "../../../../jobs/payrollCycleQueue.js";
import { PayrollService } from "./payrollService.js";

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
                where: { id: cycleId }
            });

            if (!cycle) {
                throw new Error("Payroll cycle not found");
            }

            if (cycle.status !== 'DRAFT') {
                throw new Error(`Cannot start cycle with status: ${cycle.status}`);
            }

            // Prevent duplicate background jobs for the same cycle
            const existingJob = await prisma.backgroundJob.findFirst({
                where: {
                    type: PAYROLL_PROCESSING_JOB_TYPE,
                    status: {
                        in: ['PENDING', 'PROCESSING']
                    },
                    payload: {
                        path: ['cycleId'],
                        equals: cycleId
                    }
                }
            });

            if (existingJob) {
                return {
                    queued: true,
                    cycle,
                    job: existingJob,
                    duplicate: true
                };
            }

            const now = new Date();

            const [updatedCycle, job] = await prisma.$transaction([
                prisma.payrollCycle.update({
                    where: { id: cycleId },
                    data: {
                        status: 'IN_PROGRESS',
                        startedAt: now,
                        startedBy: userId,
                        completedAt: null
                    }
                }),
                prisma.backgroundJob.create({
                    data: {
                        type: PAYROLL_PROCESSING_JOB_TYPE,
                        status: 'PENDING',
                        scheduledFor: now,
                        priority: 10,
                        payload: {
                            cycleId,
                            orgId: cycle.orgId,
                            initiatedBy: userId
                        }
                    }
                })
            ]);

            payrollCycleQueue.enqueue(job.id);

            await this.createAuditLog(
                cycleId,
                null,
                'NOTE_ADDED',
                null,
                {
                    message: 'Payroll cycle queued for background processing',
                    jobId: job.id
                },
                userId
            );

            return {
                queued: true,
                cycle: updatedCycle,
                job,
                duplicate: false
            };
        } catch (error) {
            console.error("[PAYROLL_CYCLE] Error starting cycle:", error);
            throw error;
        }
    }

    static async processPayrollCycleJob(job) {
        const payload = job?.payload ?? {};
        const cycleId = payload.cycleId;
        const initiatedBy = payload.initiatedBy ?? null;

        if (!cycleId) {
            throw new Error("Payroll processing job payload missing cycleId");
        }

        let cycle;
        const progressMessages = {
            inProgress: 'Payroll cycle processing in progress.',
            withErrors: 'Cycle finished with validation issues; resolve blockers before submitting for review.',
            completed: 'Cycle processing completed. Submit for review when you are ready.'
        };

        try {
            cycle = await prisma.payrollCycle.findUnique({
                where: { id: cycleId },
                include: {
                    organization: true
                }
            });

            if (!cycle) {
                throw new Error("Payroll cycle not found");
            }

            const processorId = initiatedBy ?? cycle.startedBy ?? null;

            const parseNotes = (rawNotes) => {
                if (!rawNotes) {
                    return {};
                }

                if (typeof rawNotes === 'string') {
                    try {
                        return JSON.parse(rawNotes);
                    } catch (parseError) {
                        console.warn('[PAYROLL_CYCLE] Unable to parse cycle notes JSON:', parseError);
                        return { raw: rawNotes };
                    }
                }

                return rawNotes;
            };

            const startedAt = cycle.startedAt ? new Date(cycle.startedAt) : new Date();
            let notesState = parseNotes(cycle.notes);

            await this.createAuditLog(
                cycleId,
                null,
                'CYCLE_STARTED',
                null,
                {
                    message: 'Bulk payroll generation started.',
                    jobId: job.id
                },
                processorId
            );

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
            const totalEmployees = employees.length;

            const computeProgressSnapshot = (extras = {}) => {
                const completed = processedCount + failedCount;
                const percentComplete = totalEmployees > 0
                    ? Math.min(100, Math.round((completed / totalEmployees) * 100))
                    : 0;
                const elapsedMs = Date.now() - startedAt.getTime();
                const etaMs = percentComplete > 0 && percentComplete < 100
                    ? Math.max(0, Math.round((elapsedMs * (100 - percentComplete)) / percentComplete))
                    : null;

                return {
                    processedCount,
                    failedCount,
                    totalAmount,
                    totalEmployees,
                    percentComplete,
                    elapsedMs,
                    durationMs: elapsedMs,
                    etaMs,
                    updatedAt: new Date().toISOString(),
                    ...extras
                };
            };

            const persistProgress = async ({ message = progressMessages.inProgress, extras = {} } = {}) => {
                const snapshot = computeProgressSnapshot(extras);
                const nextNotes = {
                    ...notesState,
                    processingSummary: {
                        ...snapshot,
                        message
                    },
                    progress: {
                        ...snapshot,
                        status: snapshot.percentComplete >= 100
                            ? (errors.length > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED')
                            : 'PROCESSING'
                    }
                };

                if (errors.length > 0) {
                    nextNotes.errors = errors;
                } else if (nextNotes.errors) {
                    delete nextNotes.errors;
                }

                try {
                    await prisma.payrollCycle.update({
                        where: { id: cycleId },
                        data: {
                            totalEmployees,
                            processedCount,
                            failedCount,
                            totalAmount,
                            status: 'IN_PROGRESS',
                            completedAt: null,
                            notes: nextNotes
                        }
                    });
                    notesState = nextNotes;
                } catch (progressError) {
                    console.error(`[PAYROLL_CYCLE] Failed to persist progress for cycle ${cycleId}:`, progressError);
                }
            };

            const progressInterval = Math.max(1, Math.floor(Math.max(totalEmployees, 1) / 20));
            let progressCounter = 0;

            for (const employee of employees) {
                try {
                    const salaryRecord = await PayrollService.generateSalary(
                        employee.id,
                        cycle.month,
                        cycle.year,
                        cycleId,
                        {
                            replaceExisting: true,
                            initiatedBy: processorId
                        }
                    );

                    processedCount++;
                    totalAmount += salaryRecord.netSalary;

                    progressCounter++;
                    if (progressCounter >= progressInterval) {
                        await persistProgress({
                            extras: {
                                lastEmployeeId: employee.id,
                                lastSalaryRecordId: salaryRecord.id
                            }
                        });
                        progressCounter = 0;
                    }

                    await this.createAuditLog(
                        cycleId,
                        salaryRecord.id,
                        'SALARY_GENERATED',
                        null,
                        {
                            employeeId: employee.id,
                            amount: salaryRecord.netSalary,
                            recalculated: Boolean(salaryRecord.wasReplaced)
                        },
                        processorId
                    );
                } catch (error) {
                    failedCount++;
                    errors.push({
                        employeeId: employee.id,
                        employeeName: `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim(),
                        error: error.message
                    });
                    console.error(`[PAYROLL_CYCLE] Failed to generate salary for ${employee.id}:`, error);

                    progressCounter++;
                    if (progressCounter >= progressInterval) {
                        await persistProgress({
                            message: progressMessages.inProgress,
                            extras: {
                                lastEmployeeId: employee.id
                            }
                        });
                        progressCounter = 0;
                    }
                }
            }

            const processingSummary = {
                processedCount,
                failedCount,
                totalAmount,
                generatedAt: new Date().toISOString(),
                durationMs: Date.now() - startedAt.getTime(),
                message: errors.length > 0
                    ? progressMessages.withErrors
                    : progressMessages.completed
            };

            const finalExtras = {
                completedAt: new Date().toISOString(),
                generatedAt: processingSummary.generatedAt,
                durationMs: processingSummary.durationMs,
                percentComplete: 100
            };

            await persistProgress({
                message: processingSummary.message,
                extras: finalExtras
            });

            const updatedCycle = await prisma.payrollCycle.findUnique({
                where: { id: cycleId }
            });

            await this.createAuditLog(
                cycleId,
                null,
                'NOTE_ADDED',
                null,
                {
                    ...processingSummary,
                    errors: errors.length > 0 ? errors : undefined,
                    jobId: job.id
                },
                processorId
            );

            return {
                cycle: updatedCycle,
                processedCount,
                failedCount,
                totalAmount,
                errors
            };
        } catch (error) {
            console.error("[PAYROLL_CYCLE] Background processing error:", error);

            if (cycleId) {
                try {
                    await prisma.payrollCycle.update({
                        where: { id: cycleId },
                        data: {
                            status: 'CANCELLED',
                            completedAt: null
                        }
                    });

                    await this.createAuditLog(
                        cycleId,
                        null,
                        'NOTE_ADDED',
                        null,
                        {
                            message: 'Payroll cycle processing failed',
                            jobId: job?.id,
                            error: error.message
                        },
                        initiatedBy ?? null
                    );
                } catch (updateError) {
                    console.error("[PAYROLL_CYCLE] Failed to mark cycle as cancelled after error:", updateError);
                }
            }

            throw error;
        }
    }

    static async deletePayrollCycle(cycleId, userId, options = {}) {
        const { orgId, allowProcessedDeletion = false } = options;

        const cycle = await prisma.payrollCycle.findUnique({
            where: { id: cycleId },
            select: {
                id: true,
                orgId: true,
                status: true,
                month: true,
                year: true
            }
        });

        if (!cycle) {
            const error = new Error("Payroll cycle not found");
            error.code = "NOT_FOUND";
            throw error;
        }

        if (orgId && cycle.orgId !== orgId) {
            const error = new Error("You are not authorized to delete this payroll cycle");
            error.code = "FORBIDDEN";
            throw error;
        }

        const restrictedStatuses = allowProcessedDeletion
            ? []
            : ['APPROVED', 'COMPLETED'];

        if (restrictedStatuses.includes(cycle.status)) {
            const error = new Error(`Cannot delete payroll cycle with status: ${cycle.status}`);
            error.code = "INVALID_STATUS";
            throw error;
        }

        const activeJob = await prisma.backgroundJob.findFirst({
            where: {
                type: PAYROLL_PROCESSING_JOB_TYPE,
                payload: {
                    path: ['cycleId'],
                    equals: cycleId
                },
                status: {
                    in: ['PENDING', 'PROCESSING']
                }
            }
        });

        if (activeJob?.status === 'PROCESSING') {
            const error = new Error('Payroll cycle is currently being processed. Try again once processing completes.');
            error.code = "PROCESSING";
            throw error;
        }

        let jobCancelled = false;
        if (activeJob) {
            jobCancelled = await payrollCycleQueue.cancelJob(activeJob.id, 'Payroll cycle deleted by user request');
        }

        const deletionSummary = await prisma.$transaction(async (tx) => {
            const deletedTransactionLinks = await tx.salaryTransactionTable.deleteMany({
                where: {
                    salaryRecord: {
                        cycleId
                    }
                }
            });

            const deletedDisputes = await tx.salaryDispute.deleteMany({
                where: {
                    salaryRecord: {
                        cycleId
                    }
                }
            });

            const deletedAudits = await tx.payrollAudit.deleteMany({
                where: {
                    salaryRecord: {
                        cycleId
                    }
                }
            });

            const deletedCycleAudits = await tx.payrollCycleAudit.deleteMany({
                where: { cycleId }
            });

            const deletedWorkflowSteps = await tx.workflowStep.deleteMany({
                where: { cycleId }
            });

            const deletedSalaryRecords = await tx.salaryRecord.deleteMany({
                where: { cycleId }
            });

            const deletedCycle = await tx.payrollCycle.delete({
                where: { id: cycleId }
            });

            return {
                deletedCycle,
                counts: {
                    salaryRecords: deletedSalaryRecords.count,
                    salaryTransactionLinks: deletedTransactionLinks.count,
                    salaryDisputes: deletedDisputes.count,
                    payrollAudits: deletedAudits.count,
                    payrollCycleAudits: deletedCycleAudits.count,
                    workflowSteps: deletedWorkflowSteps.count
                }
            };
        });

        return {
            ...deletionSummary,
            jobCancelled,
            deletedBy: userId
        };
    }

    static async submitPayrollCycleForReview(cycleId, userId, options = {}) {
        const { force = false } = options;

        const cycle = await prisma.payrollCycle.findUnique({
            where: { id: cycleId },
            include: {
                salaryRecords: {
                    select: {
                        id: true,
                        status: true
                    }
                }
            }
        });

        if (!cycle) {
            throw new Error("Payroll cycle not found");
        }

        if (cycle.status !== 'IN_PROGRESS') {
            throw new Error(`Only IN_PROGRESS cycles can be submitted for review (current status: ${cycle.status})`);
        }

        const pendingStatuses = ['PENDING', 'PROCESSING', 'IN_PROGRESS'];
        const failedStatuses = ['FAILED', 'REJECTED'];

        const pendingRecords = cycle.salaryRecords.filter((record) => pendingStatuses.includes(record.status));
        const failedRecords = cycle.salaryRecords.filter((record) => failedStatuses.includes(record.status));

        if (!force) {
            if (pendingRecords.length > 0) {
                return {
                    canSubmit: false,
                    reason: 'PENDING_RECORDS',
                    blockers: {
                        pending: pendingRecords.length,
                        failed: failedRecords.length
                    },
                    cycle
                };
            }

            if (failedRecords.length > 0) {
                return {
                    canSubmit: false,
                    reason: 'FAILED_RECORDS',
                    blockers: {
                        pending: pendingRecords.length,
                        failed: failedRecords.length
                    },
                    cycle
                };
            }
        }

        const existingNotes = (() => {
            if (!cycle.notes) {
                return {};
            }

            if (typeof cycle.notes === 'string') {
                try {
                    return JSON.parse(cycle.notes);
                } catch (error) {
                    console.warn('[PAYROLL_CYCLE] Unable to parse cycle notes JSON:', error);
                    return { raw: cycle.notes };
                }
            }

            return cycle.notes;
        })();

        const submissionMetadata = {
            submittedBy: userId,
            submittedAt: new Date().toISOString(),
            pendingCount: pendingRecords.length,
            failedCount: failedRecords.length,
            forced: force
        };

        const updatedNotes = {
            ...existingNotes,
            reviewSubmission: submissionMetadata
        };

        const updatedCycle = await prisma.payrollCycle.update({
            where: { id: cycleId },
            data: {
                status: 'REVIEW',
                notes: updatedNotes
            }
        });

        await this.createAuditLog(
            cycleId,
            null,
            'CYCLE_REVIEW_READY',
            null,
            submissionMetadata,
            userId
        );

        return {
            canSubmit: true,
            cycle: updatedCycle,
            blockers: {
                pending: pendingRecords.length,
                failed: failedRecords.length
            },
            forced: force && (pendingRecords.length > 0 || failedRecords.length > 0)
        };
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

            if (cycle.status !== 'REVIEW') {
                throw new Error(`Cannot approve cycle with status: ${cycle.status}`);
            }

            const reviewDate = new Date();
            const reviewUpdateData = {
                status: 'APPROVED',
                paymentStatus: 'PENDING',
                reviewedAt: reviewDate,
                reviewedById: userId
            };

            if (notes) {
                reviewUpdateData.reviewComments = notes;
            }

            await prisma.salaryRecord.updateMany({
                where: {
                    cycleId,
                    status: {
                        in: ['PROCESSED', 'REVIEW']
                    }
                },
                data: reviewUpdateData
            });

            // Update cycle status
            const approvedCycle = await prisma.payrollCycle.update({
                where: { id: cycleId },
                data: {
                    status: 'APPROVED',
                    approvedBy: userId,
                    approvedAt: new Date(),
                    completedAt: new Date(),
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
                                id: true,
                                firstName: true, 
                                lastName: true, 
                                email: true, 
                                employeeId: true,
                                salaryTemplateId: true,
                                salaryTemplate: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true
                                    }
                                },
                                department: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                auditLogs: {
                    include: {
                        actor: {
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

        const { auditLogs, salaryRecords, ...cycleRest } = cycle;

        const normalizedSalaryRecords = Array.isArray(salaryRecords)
            ? salaryRecords.map((record) => {
                const { user, ...recordRest } = record;

                const templateDetails = user?.salaryTemplate
                    ? {
                        id: user.salaryTemplate.id,
                        name: user.salaryTemplate.name,
                        description: user.salaryTemplate.description
                    }
                    : null;

                return {
                    ...recordRest,
                    templateId: user?.salaryTemplateId ?? null,
                    templateName: templateDetails?.name ?? null,
                    template: templateDetails,
                    user: user
                        ? {
                            id: user.id,
                            firstName: user.firstName ?? null,
                            lastName: user.lastName ?? null,
                            email: user.email ?? null,
                            employeeId: user.employeeId ?? null,
                            salaryTemplateId: user.salaryTemplateId ?? null,
                            department: user.department
                                ? { name: user.department.name ?? null }
                                : null
                        }
                        : null
                };
            })
            : [];

        const normalizedAuditLogs = Array.isArray(auditLogs)
            ? auditLogs.map((log) => {
                const { actor, ...rest } = log;
                return {
                    ...rest,
                    user: actor
                        ? {
                            firstName: actor.firstName ?? null,
                            lastName: actor.lastName ?? null
                        }
                        : null
                };
            })
            : [];

        return {
            ...cycleRest,
            salaryRecords: normalizedSalaryRecords,
            auditLogs: normalizedAuditLogs
        };
    }

    static async getPayrollCycleProcessingStatus(cycleId) {
        const cycle = await prisma.payrollCycle.findUnique({
            where: { id: cycleId },
            select: {
                id: true,
                orgId: true,
                status: true,
                startedAt: true,
                completedAt: true,
                processedCount: true,
                failedCount: true,
                totalEmployees: true,
                totalAmount: true,
                notes: true,
                updatedAt: true
            }
        });

        if (!cycle) {
            const error = new Error('Payroll cycle not found');
            error.code = 'NOT_FOUND';
            throw error;
        }

        const activeJob = await prisma.backgroundJob.findFirst({
            where: {
                type: PAYROLL_PROCESSING_JOB_TYPE,
                payload: {
                    path: ['cycleId'],
                    equals: cycleId
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const parseNotes = (rawNotes) => {
            if (!rawNotes) {
                return {};
            }

            if (typeof rawNotes === 'string') {
                try {
                    return JSON.parse(rawNotes);
                } catch (error) {
                    console.warn('[PAYROLL_CYCLE] Unable to parse cycle notes JSON:', error);
                    return { raw: rawNotes };
                }
            }

            return rawNotes;
        };

        const notesData = parseNotes(cycle.notes);
        const processingSummary = notesData?.processingSummary ?? null;
        const progress = notesData?.progress ?? null;
        const errorList = Array.isArray(notesData?.errors) ? notesData.errors : [];

        const jobData = activeJob
            ? {
                id: activeJob.id,
                status: activeJob.status,
                attempts: activeJob.attempts,
                maxAttempts: activeJob.maxAttempts,
                scheduledFor: activeJob.scheduledFor,
                completedAt: activeJob.completedAt,
                error: activeJob.error,
                priority: activeJob.priority,
                updatedAt: activeJob.updatedAt
            }
            : null;

        const responseProgress = progress ?? (activeJob?.payload?.progress ?? null);

        return {
            cycle: {
                id: cycle.id,
                status: cycle.status,
                startedAt: cycle.startedAt,
                completedAt: cycle.completedAt,
                processedCount: cycle.processedCount,
                failedCount: cycle.failedCount,
                totalEmployees: cycle.totalEmployees,
                totalAmount: cycle.totalAmount,
                updatedAt: cycle.updatedAt,
                processingSummary,
                errors: errorList.slice(0, 50)
            },
            progress: responseProgress,
            job: jobData
        };
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

            const completionStatuses = ['APPROVED', 'COMPLETED'];

            const totalPaid = cycles
                .filter(c => completionStatuses.includes(c.status))
                .reduce((sum, c) => sum + c.totalAmount, 0);

        const totalEmployeesProcessed = cycles
            .reduce((sum, c) => sum + c.processedCount, 0);

        return {
            year: currentYear,
            totalCycles: cycles.length,
                completedCycles: cycles.filter(c => completionStatuses.includes(c.status)).length,
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
