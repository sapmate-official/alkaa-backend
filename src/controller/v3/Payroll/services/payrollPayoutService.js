import prisma from "../../../../db/connectDb.js";
import { PayrollCycleService } from "./payrollCycleService.js";

const PAYMENT_STATUS_FIELDS = ["PENDING", "INITIATED", "COMPLETED", "FAILED", "NO_PAYOUT_REQUIRED"];
const LOGICAL_PAYOUT_PAYMENT_STATUS = "NO_PAYOUT_REQUIRED";

function derivePayoutProgress(summary) {
    const totals = summary?.totals ?? {};

    const totalRecords = typeof summary?.totalRecords === "number"
        ? summary.totalRecords
        : Object.values(totals).reduce((sum, count) => sum + (count ?? 0), 0);

    const logicalRecords = totals[LOGICAL_PAYOUT_PAYMENT_STATUS] ?? 0;
    const completedRecords = (totals.COMPLETED ?? 0) + logicalRecords;
    const initiatedRecords = totals.INITIATED ?? 0;
    const pendingRecords = totals.PENDING ?? 0;
    const failedRecords = totals.FAILED ?? 0;
    const remainingRecords = Math.max(0, totalRecords - completedRecords);
    const inFlightRecords = initiatedRecords + failedRecords;
    const percentComplete = totalRecords > 0
        ? parseFloat(((completedRecords / totalRecords) * 100).toFixed(1))
        : 0;
    const percentRemaining = totalRecords > 0
        ? parseFloat((Math.max(0, 100 - percentComplete)).toFixed(1))
        : 0;
    const hasRemaining = remainingRecords > 0;
    const isInitiated = initiatedRecords > 0 || completedRecords > 0;

    return {
        totalRecords,
        completedRecords,
        logicalRecords,
        initiatedRecords,
        pendingRecords,
        failedRecords,
        remainingRecords,
        inFlightRecords,
        percentComplete,
        percentRemaining,
        flags: {
            hasRemaining,
            canContinue: hasRemaining && completedRecords > 0,
            isComplete: !hasRemaining,
            isInitiated,
            isNotStarted: !isInitiated
        },
        byStatus: {
            completed: totals.COMPLETED ?? 0,
            logical: logicalRecords,
            initiated: initiatedRecords,
            pending: pendingRecords,
            failed: failedRecords
        }
    };
}

function ensureSummaryProgress(summary) {
    if (!summary) {
        return null;
    }

    if (summary.progress && typeof summary.progress.totalRecords === "number") {
        return summary;
    }

    const refreshedAt = summary.refreshedAt ?? new Date().toISOString();
    const progress = derivePayoutProgress(summary);

    return {
        ...summary,
        totalRecords: typeof summary.totalRecords === "number"
            ? summary.totalRecords
            : progress.totalRecords,
        progress: {
            ...progress,
            updatedAt: refreshedAt
        }
    };
}

const DEFAULT_INITIATE_OPTIONS = {
    requireBankDetails: true,
    salaryRecordIds: null
};

export class PayrollPayoutService {
    static resolvePayoutStatus(summary) {
        const totals = summary?.totals ?? {};
        const pending = totals.PENDING ?? 0;
        const initiated = totals.INITIATED ?? 0;
        const completed = totals.COMPLETED ?? 0;
        const logical = totals[LOGICAL_PAYOUT_PAYMENT_STATUS] ?? 0;
        const failed = totals.FAILED ?? 0;
        const total = summary?.totalRecords ?? (pending + initiated + completed + failed + logical);

        if (total === 0) {
            return "NOT_STARTED";
        }

        if ((completed + logical) === total) {
            return "COMPLETED";
        }

        if (failed === total && total > 0) {
            return "FAILED";
        }

        if (completed > 0 || failed > 0) {
            return "IN_PROGRESS";
        }

        if (initiated > 0) {
            return "INITIATED";
        }

        return "NOT_STARTED";
    }

    static async buildSummary(client, cycleId) {
        const prismaClient = client ?? prisma;

        const paymentGroups = await prismaClient.salaryRecord.groupBy({
            where: { cycleId },
            by: ["paymentStatus"],
            _count: { _all: true },
            _sum: {
                netSalary: true,
                incentive: true,
                bonus: true
            }
        });

        const totals = PAYMENT_STATUS_FIELDS.reduce((acc, status) => {
            acc[status] = 0;
            return acc;
        }, {});

        const sumAccumulator = {
            netSalary: 0,
            incentive: 0,
            bonus: 0
        };

        for (const group of paymentGroups) {
            const status = group.paymentStatus ?? "PENDING";
            totals[status] = group._count?._all ?? 0;
            sumAccumulator.netSalary += group._sum?.netSalary ?? 0;
            sumAccumulator.incentive += group._sum?.incentive ?? 0;
            sumAccumulator.bonus += group._sum?.bonus ?? 0;
        }

        const totalRecords = Object.values(totals).reduce((sum, count) => sum + count, 0);
        const totalAmount = sumAccumulator.netSalary + sumAccumulator.incentive + sumAccumulator.bonus;

        const latestPayment = await prismaClient.transactionTable.findFirst({
            where: {
                salaryTransactions: {
                    some: {
                        salaryRecord: {
                            cycleId
                        }
                    }
                }
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                amount: true,
                createdAt: true
            }
        });

        const refreshedAt = new Date().toISOString();

        const summary = ensureSummaryProgress({
            totals,
            totalRecords,
            totalAmount,
            sums: {
                netSalary: sumAccumulator.netSalary,
                incentive: sumAccumulator.incentive,
                bonus: sumAccumulator.bonus
            },
            latestPayment,
            refreshedAt
        });

        return summary;
    }

    static async syncCyclePayoutStatus(client, cycleId, extraData = {}) {
        const prismaClient = client ?? prisma;
        const summary = await this.buildSummary(prismaClient, cycleId);
        const payoutStatus = this.resolvePayoutStatus(summary);

        const updatePayload = {
            payoutStatus,
            payoutSummary: summary,
            ...extraData
        };

        if (!("payoutCompletedAt" in updatePayload)) {
            updatePayload.payoutCompletedAt = payoutStatus === "COMPLETED" ? new Date() : null;
        }

        const cycle = await prismaClient.payrollCycle.update({
            where: { id: cycleId },
            data: updatePayload
        });

        return {
            cycle,
            summary,
            payoutStatus
        };
    }

    static async initiateCyclePayout(cycleId, actorId, options = {}) {
        const config = { ...DEFAULT_INITIATE_OPTIONS, ...options };
        const now = new Date();

        return prisma.$transaction(async (tx) => {
            const cycle = await tx.payrollCycle.findUnique({
                where: { id: cycleId },
                include: {
                    salaryRecords: {
                        where: {
                            paymentStatus: {
                                in: ["PENDING", "FAILED", "INITIATED"]
                            },
                            ...(Array.isArray(config.salaryRecordIds) && config.salaryRecordIds.length > 0
                                ? { id: { in: config.salaryRecordIds } }
                                : {})
                        },
                        select: {
                            id: true,
                            paymentStatus: true,
                            netSalary: true,
                            incentive: true,
                            bonus: true,
                            user: {
                                select: {
                                    id: true,
                                    employeeId: true,
                                    firstName: true,
                                    lastName: true,
                                    bankDetails: {
                                        select: {
                                            id: true,
                                            accountNumber: true,
                                            bankName: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!cycle) {
                throw new Error("Payroll cycle not found");
            }

            if (cycle.status !== "APPROVED") {
                throw new Error(`Cannot initiate payout for cycle with status: ${cycle.status}`);
            }

            const requestedIds = Array.isArray(config.salaryRecordIds) && config.salaryRecordIds.length > 0
                ? new Set(config.salaryRecordIds)
                : null;

            if (requestedIds && cycle.salaryRecords.length !== requestedIds.size) {
                const missingIds = [...requestedIds].filter((id) => !cycle.salaryRecords.some((record) => record.id === id));
                if (missingIds.length > 0) {
                    throw new Error(`One or more salary records are not eligible for payout: ${missingIds.join(", ")}`);
                }
            }

            if (cycle.salaryRecords.length === 0) {
                throw new Error("No salary records are eligible for payout initiation");
            }

            const recordsRequiringUpdate = cycle.salaryRecords.filter((record) => record.paymentStatus !== "INITIATED");
            const recordIdsToUpdate = recordsRequiringUpdate.map((record) => record.id);

            const missingBankDetails = config.requireBankDetails
                ? cycle.salaryRecords.filter((record) => !record.user?.bankDetails)
                : [];

            if (missingBankDetails.length > 0) {
                throw new Error(`Bank details missing for ${missingBankDetails.length} employee(s)`);
            }

            if (recordIdsToUpdate.length > 0) {
                await tx.salaryRecord.updateMany({
                    where: { id: { in: recordIdsToUpdate } },
                    data: {
                        paymentStatus: "INITIATED"
                    }
                });
            }

            const { summary, payoutStatus } = await this.syncCyclePayoutStatus(tx, cycleId, {
                payoutInitiatedAt: now,
                payoutInitiatedBy: actorId
            });

            await PayrollCycleService.createAuditLog(
                cycleId,
                null,
                "PAYOUT_INITIATED",
                null,
                {
                    initiatedBy: actorId,
                    initiatedAt: now,
                    recordIds: cycle.salaryRecords.map((record) => record.id),
                    payoutStatus,
                    summary
                },
                actorId
            );

            return {
                cycleId,
                payoutStatus,
                summary,
                initiatedRecords: cycle.salaryRecords.length,
                updatedRecords: recordIdsToUpdate.length
            };
        });
    }

    static async getPayoutSummary(cycleId) {
        const cycle = await prisma.payrollCycle.findUnique({
            where: { id: cycleId },
            select: {
                id: true,
                month: true,
                year: true,
                payoutStatus: true,
                payoutInitiatedAt: true,
                payoutCompletedAt: true,
                payoutSummary: true,
                organization: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        if (!cycle) {
            throw new Error("Payroll cycle not found");
        }

        const summary = ensureSummaryProgress(cycle.payoutSummary) ?? await this.buildSummary(prisma, cycleId);
        const payoutStatus = this.resolvePayoutStatus(summary);

        return {
            cycle: {
                id: cycle.id,
                month: cycle.month,
                year: cycle.year,
                orgId: cycle.organization?.id,
                organizationName: cycle.organization?.name,
                payoutStatus,
                payoutInitiatedAt: cycle.payoutInitiatedAt,
                payoutCompletedAt: cycle.payoutCompletedAt
            },
            summary
        };
    }
}
