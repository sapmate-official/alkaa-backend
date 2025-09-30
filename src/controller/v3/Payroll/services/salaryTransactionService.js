import prisma from "../../../../db/connectDb.js";

const SUPPORTED_STATUS_FOR_PAYMENT = ["APPROVED", "PROCESSED", "REVIEW"];

export class SalaryTransactionService {
    static async recordPayment({ salaryRecordId, senderUserId, paymentMode, paymentReference, notes }) {
        return await prisma.$transaction(async (tx) => {
            const salaryRecord = await tx.salaryRecord.findUnique({
                where: { id: salaryRecordId },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            orgId: true
                        }
                    }
                }
            });

            if (!salaryRecord) {
                throw new Error("Salary record not found");
            }

            if (salaryRecord.status === "PAID") {
                throw new Error("Salary already marked as paid");
            }

            if (!SUPPORTED_STATUS_FOR_PAYMENT.includes(salaryRecord.status)) {
                throw new Error(`Salary record must be reviewed before payment. Current status: ${salaryRecord.status}`);
            }

            const amount = salaryRecord.netSalary;
            if (amount <= 0) {
                throw new Error("Cannot record payment for zero or negative net salary");
            }

            const transaction = await tx.transactionTable.create({
                data: {
                    senderUserId,
                    recieverUserId: salaryRecord.userId,
                    amount,
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

            const updatedSalary = await tx.salaryRecord.update({
                where: { id: salaryRecord.id },
                data: {
                    status: "PAID",
                    paymentStatus: "COMPLETED",
                    paymentMode: paymentMode || salaryRecord.paymentMode,
                    paymentRef: paymentReference || salaryRecord.paymentRef,
                    processedAt: salaryRecord.processedAt ?? new Date(),
                    remarks: notes ? [salaryRecord.remarks, notes].filter(Boolean).join(" | ") : salaryRecord.remarks
                },
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
                    description: `Salary payment of ${amount} recorded${paymentReference ? ` with reference ${paymentReference}` : ""}`
                }
            });

            return {
                transaction,
                salaryRecord: updatedSalary
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
}
