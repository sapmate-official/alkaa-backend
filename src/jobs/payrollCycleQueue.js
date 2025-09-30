import prisma from "../db/connectDb.js";

const JOB_TYPE = "PAYROLL_PROCESSING";
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [15_000, 60_000, 300_000];

class PayrollCycleQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.jobHandler = null;
        this.pollInterval = null;
        this.pollIntervalMs = 15_000;
    }

    setHandler(handler) {
        this.jobHandler = handler;
    }

    async recoverPendingJobs() {
        if (!this.jobHandler) {
            return;
        }

        try {
            const pendingJobs = await prisma.backgroundJob.findMany({
                where: {
                    type: JOB_TYPE,
                    status: {
                        in: ["PENDING", "PROCESSING"]
                    },
                    scheduledFor: {
                        lte: new Date()
                    }
                },
                orderBy: {
                    createdAt: "asc"
                }
            });

            pendingJobs.forEach(job => {
                this.enqueue(job.id, { immediate: false, suppressLog: true });
            });

            if (pendingJobs.length > 0) {
                this.processNext();
            }
        } catch (error) {
            console.error("[PAYROLL_QUEUE] Failed to recover pending jobs:", error);
        }
    }

    startPolling() {
        if (this.pollInterval || !this.jobHandler) {
            return;
        }

        this.pollInterval = setInterval(() => {
            this.pollDueJobs().catch((error) => {
                console.error("[PAYROLL_QUEUE] Polling error:", error);
            });
        }, this.pollIntervalMs);
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    async pollDueJobs() {
        const dueJobs = await prisma.backgroundJob.findMany({
            where: {
                type: JOB_TYPE,
                status: "PENDING",
                scheduledFor: {
                    lte: new Date()
                }
            },
            orderBy: [
                { priority: "desc" },
                { createdAt: "asc" }
            ],
            take: 10
        });

        dueJobs.forEach(job => this.enqueue(job.id, { immediate: false }));

        if (dueJobs.length > 0) {
            this.processNext();
        }
    }

    enqueue(jobId, options = {}) {
        const { immediate = true, suppressLog = false } = options;

        if (!this.jobHandler) {
            if (!suppressLog) {
                console.warn("[PAYROLL_QUEUE] Attempted to enqueue job before handler was registered", jobId);
            }
            return;
        }

        this.queue.push(jobId);

        if (immediate) {
            setImmediate(() => this.processNext());
        }
    }

    cancelQueuedJob(jobId) {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter((id) => id !== jobId);
        return initialLength !== this.queue.length;
    }

    async cancelJob(jobId, reason = null) {
        this.cancelQueuedJob(jobId);

        try {
            const job = await prisma.backgroundJob.findUnique({ where: { id: jobId } });
            if (!job) {
                return false;
            }

            if (job.status === "COMPLETED") {
                return false;
            }

            await prisma.backgroundJob.update({
                where: { id: jobId },
                data: {
                    status: "CANCELLED",
                    error: reason ?? job.error ?? null,
                    updatedAt: new Date()
                }
            });

            return true;
        } catch (error) {
            console.error(`[PAYROLL_QUEUE] Failed to cancel job ${jobId}:`, error);
            return false;
        }
    }

    async processNext() {
        if (this.isProcessing || this.queue.length === 0 || !this.jobHandler) {
            return;
        }

        const jobId = this.queue.shift();
        if (!jobId) {
            return;
        }

        this.isProcessing = true;
        let jobSnapshot = null;

        try {
            jobSnapshot = await prisma.backgroundJob.findUnique({
                where: { id: jobId }
            });

            if (!jobSnapshot) {
                console.warn(`[PAYROLL_QUEUE] Job ${jobId} no longer exists`);
                return;
            }

            if (jobSnapshot.status === "COMPLETED" || jobSnapshot.status === "CANCELLED") {
                return;
            }

            const processingJob = await prisma.backgroundJob.update({
                where: { id: jobId },
                data: {
                    status: "PROCESSING",
                    attempts: { increment: 1 },
                    updatedAt: new Date()
                }
            });

            await this.jobHandler(processingJob);

            const latestState = await prisma.backgroundJob.findUnique({
                where: { id: jobId },
                select: { status: true }
            });

            if (latestState?.status !== "CANCELLED") {
                await prisma.backgroundJob.update({
                    where: { id: jobId },
                    data: {
                        status: "COMPLETED",
                        completedAt: new Date(),
                        error: null
                    }
                });
            }
        } catch (error) {
            console.error(`[PAYROLL_QUEUE] Job ${jobId} failed:`, error);
            await this.handleJobFailure(jobId, jobSnapshot, error);
        } finally {
            this.isProcessing = false;
            setImmediate(() => this.processNext());
        }
    }

    async handleJobFailure(jobId, jobSnapshot, error) {
        try {
            const job = jobSnapshot || await prisma.backgroundJob.findUnique({ where: { id: jobId } });
            if (!job) {
                return;
            }

            const attemptsMade = job.attempts ?? 0;
            const maxAttempts = job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
            const hasRemainingAttempts = attemptsMade < maxAttempts;
            const normalizedError = (error?.message || String(error)).slice(0, 1000);

            const updateData = {
                status: hasRemainingAttempts ? "PENDING" : "FAILED",
                error: normalizedError,
                updatedAt: new Date()
            };

            if (hasRemainingAttempts) {
                const delayIndex = Math.min(attemptsMade, RETRY_DELAYS_MS.length - 1);
                updateData.scheduledFor = new Date(Date.now() + RETRY_DELAYS_MS[delayIndex]);
            }

            await prisma.backgroundJob.update({
                where: { id: jobId },
                data: updateData
            });

            if (hasRemainingAttempts) {
                this.enqueue(jobId, { immediate: false });
            } else {
                console.error(`[PAYROLL_QUEUE] Job ${jobId} exhausted retries. Marked as FAILED.`);
            }
        } catch (updateError) {
            console.error(`[PAYROLL_QUEUE] Failed to update job ${jobId} after error:`, updateError);
        }
    }
}

export const payrollCycleQueue = new PayrollCycleQueue();
export { JOB_TYPE as PAYROLL_PROCESSING_JOB_TYPE };

export const bootstrapPayrollCycleQueue = async (handler) => {
    payrollCycleQueue.setHandler(handler);
    await payrollCycleQueue.recoverPendingJobs();
    payrollCycleQueue.startPolling();
};
