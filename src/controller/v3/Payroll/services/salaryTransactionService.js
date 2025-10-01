import prisma from "../../../../db/connectDb.js";
import { PayrollCycleService } from "./payrollCycleService.js";
import { PayrollPayoutService } from "./payrollPayoutService.js";

const SUPPORTED_STATUS_FOR_PAYMENT = ["APPROVED", "PROCESSED", "REVIEW"];
const ELIGIBLE_PAYMENT_STATUSES = ["PENDING", "INITIATED", "FAILED"];
const LOGICAL_PAYOUT_PAYMENT_STATUS = "NO_PAYOUT_REQUIRED";
const LOGICAL_PAYOUT_NOTE = "Logical payout recorded - no funds transferred due to zero or negative net amount.";

function normalizeMoney(value, fallback = 0) {
    if (value === undefined) {
        return fallback;
    }

    if (value === null || value === "") {
        return 0;
    }

    const parsed = typeof value === "number" ? value : parseFloat(value);

    if (!Number.isFinite(parsed)) {
        throw new Error("Invalid monetary value provided");
    }

    return parsed;
}

function mergeRemarks(existing, addition) {
    if (!addition) {
        return existing ?? null;
    }

    if (!existing) {
        return addition;
    }

    if (existing.includes(addition)) {
        return existing;
    }

    return `${existing} | ${addition}`;
}

export class SalaryTransactionService {
    static async recordPayment(payload) {
        const senderUserId = payload.senderUserId;

        const paymentEntries = Array.isArray(payload.records) && payload.records.length > 0
            ? payload.records
            : [payload];

        return prisma.$transaction(async (tx) => {
            const payments = [];
            const impactedCycles = new Set();

            for (const entry of paymentEntries) {
                const normalized = {
                    salaryRecordId: entry.salaryRecordId ?? payload.salaryRecordId,
                    paymentMode: entry.paymentMode ?? payload.paymentMode,
                    paymentReference: entry.paymentReference ?? payload.paymentReference,
                    notes: entry.notes ?? payload.notes,
                    incentive: entry.incentive ?? payload.incentive,
                    bonus: entry.bonus ?? payload.bonus,
                    processedAt: entry.processedAt ?? payload.processedAt
                };

                if (!normalized.salaryRecordId) {
                    throw new Error("salaryRecordId is required for each payment entry");
                }

                const result = await this._processSinglePayment(tx, {
                    ...normalized,
                    senderUserId
                });

                payments.push(result);

                if (result.salaryRecord.cycleId) {
                    impactedCycles.add(result.salaryRecord.cycleId);
                }
            }

            const cycleSummaries = [];
            for (const cycleId of impactedCycles) {
                const { summary, payoutStatus } = await PayrollPayoutService.syncCyclePayoutStatus(tx, cycleId);
                cycleSummaries.push({ cycleId, payoutStatus, summary });

                await PayrollCycleService.createAuditLog(
                    cycleId,
                    null,
                    "PAYOUT_SUMMARY_UPDATED",
                    null,
                    {
                        summary,
                        payoutStatus
                    },
                    senderUserId
                );
            }

            return {
                payments,
                cycles: cycleSummaries
            };
        });
    }

    static async listTransactions({ orgId, userId, cycleId, status, paymentStatus }) {
        return prisma.salaryTransactionTable.findMany({
            where: {
                salaryRecord: {
                    ...(orgId ? { orgId } : {}),
                    ...(userId ? { userId } : {}),
                    ...(cycleId ? { cycleId } : {}),
                    ...(status ? { status } : {}),
                    ...(paymentStatus ? { paymentStatus } : {})
                }
            },
            orderBy: {
                transaction: { createdAt: "desc" }
            },
            include: {
                transaction: {
                    include: {
                        senderDetails: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        recieverDetails: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                employeeId: true
                            }
                        }
                    }
                },
                salaryRecord: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                employeeId: true
                            }
                        }
                    }
                }
            }
        });
    }

    static async getBySalaryRecordId(salaryRecordId) {
        return prisma.salaryTransactionTable.findMany({
            where: { salaryRecordId },
            include: {
                transaction: true
            }
        });
    }

    static async _processSinglePayment(tx, { salaryRecordId, senderUserId, paymentMode, paymentReference, notes, incentive, bonus, processedAt }) {
        const salaryRecord = await tx.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        orgId: true
                    }
                }
            }
        });

        if (!salaryRecord) {
            throw new Error("Salary record not found");
        }

        if (!SUPPORTED_STATUS_FOR_PAYMENT.includes(salaryRecord.status) && salaryRecord.status !== "PAID") {
            throw new Error(`Salary record must be reviewed before payment. Current status: ${salaryRecord.status}`);
        }

        if (salaryRecord.paymentStatus === "COMPLETED" || salaryRecord.paymentStatus === LOGICAL_PAYOUT_PAYMENT_STATUS) {
            throw new Error("Salary already marked as paid");
        }

        if (!ELIGIBLE_PAYMENT_STATUSES.includes(salaryRecord.paymentStatus)) {
            throw new Error(`Salary record payment status cannot be processed: ${salaryRecord.paymentStatus}`);
        }

        const hasIncentive = incentive !== undefined;
        const hasBonus = bonus !== undefined;

        const incentiveValue = normalizeMoney(incentive, salaryRecord.incentive ?? 0);
        const bonusValue = normalizeMoney(bonus, salaryRecord.bonus ?? 0);

        const totalAmount = salaryRecord.netSalary + (hasIncentive ? incentiveValue : (salaryRecord.incentive ?? 0)) + (hasBonus ? bonusValue : (salaryRecord.bonus ?? 0));

        const processedTimestamp = processedAt ? new Date(processedAt) : (salaryRecord.processedAt ?? new Date());

        if (totalAmount <= 0) {
            const updateData = {
                status: "PAID",
                paymentStatus: LOGICAL_PAYOUT_PAYMENT_STATUS,
                paymentMode: paymentMode || salaryRecord.paymentMode || "MANUAL",
                paymentRef: paymentReference || salaryRecord.paymentRef,
                processedAt: processedTimestamp,
                remarks: mergeRemarks(mergeRemarks(salaryRecord.remarks, notes), LOGICAL_PAYOUT_NOTE)
            };

            if (hasIncentive) {
                updateData.incentive = incentiveValue;
            }

            if (hasBonus) {
                updateData.bonus = bonusValue;
            }

            const updatedSalary = await tx.salaryRecord.update({
                where: { id: salaryRecord.id },
                data: updateData,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            employeeId: true,
                            orgId: true
                        }
                    }
                }
            });

            await tx.activityLog.create({
                data: {
                    orgId: salaryRecord.user.orgId,
                    actorId: senderUserId,
                    action: "PROCESS_PAYMENT",
                    entity: "SALARY_RECORD",
                    entityId: salaryRecordId,
                    description: "Salary marked as logical payout (no funds transferred)"
                }
            });

            if (salaryRecord.cycleId) {
                await PayrollCycleService.createAuditLog(
                    salaryRecord.cycleId,
                    salaryRecordId,
                    "PAYMENT_MARKED_NO_PAYOUT",
                    {
                        previousPaymentStatus: salaryRecord.paymentStatus,
                        previousStatus: salaryRecord.status
                    },
                    {
                        paymentStatus: LOGICAL_PAYOUT_PAYMENT_STATUS,
                        status: "PAID",
                        paymentMode: updateData.paymentMode,
                        paymentRef: updateData.paymentRef,
                        amount: totalAmount
                    },
                    senderUserId
                );
            }

            return {
                transaction: null,
                salaryRecord: updatedSalary,
                logicalPayout: true
            };
        }

        const transaction = await tx.transactionTable.create({
            data: {
                senderUserId,
                recieverUserId: salaryRecord.userId,
                amount: totalAmount,
                type: "SALARY_PAYMENT",
                bankTransactionId: paymentReference || null
            }
        });

        await tx.salaryTransactionTable.create({
            data: {
                transactionId: transaction.id,
                salaryRecordId: salaryRecord.id
            }
        });

        const updateData = {
            status: "PAID",
            paymentStatus: "COMPLETED",
            paymentMode: paymentMode || salaryRecord.paymentMode || "MANUAL",
            paymentRef: paymentReference || salaryRecord.paymentRef,
            processedAt: processedTimestamp,
            remarks: mergeRemarks(salaryRecord.remarks, notes)
        };

        if (hasIncentive) {
            updateData.incentive = incentiveValue;
        }

        if (hasBonus) {
            updateData.bonus = bonusValue;
        }

        const updatedSalary = await tx.salaryRecord.update({
            where: { id: salaryRecord.id },
            data: updateData,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        orgId: true
                    }
                }
            }
        });

        await tx.activityLog.create({
            data: {
                orgId: salaryRecord.user.orgId,
                actorId: senderUserId,
                action: "PROCESS_PAYMENT",
                entity: "SALARY_RECORD",
                entityId: salaryRecordId,
                description: `Salary payment of ${totalAmount.toFixed(2)} recorded${paymentReference ? ` with reference ${paymentReference}` : ""}`
            }
        });

        if (salaryRecord.cycleId) {
            await PayrollCycleService.createAuditLog(
                salaryRecord.cycleId,
                salaryRecordId,
                "PAYMENT_RECORDED",
                {
                    previousPaymentStatus: salaryRecord.paymentStatus,
                    previousStatus: salaryRecord.status
                },
                {
                    paymentStatus: "COMPLETED",
                    status: "PAID",
                    paymentMode: updateData.paymentMode,
                    paymentRef: updateData.paymentRef,
                    amount: totalAmount
                },
                senderUserId
            );
        }

        return {
            transaction,
            salaryRecord: updatedSalary
        };
    }
}
