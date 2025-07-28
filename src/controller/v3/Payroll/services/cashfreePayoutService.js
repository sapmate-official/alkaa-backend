import { Cashfree } from 'cashfree-pg';
import { prisma } from '../../../../db/connection.js';
import crypto from 'crypto';

// Configure Cashfree with better error handling
try {
    if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
        throw new Error('Cashfree credentials not found in environment variables');
    }
    
    Cashfree.XClientId = process.env.CASHFREE_APP_ID;
    Cashfree.XClientSecret = process.env.CASHFREE_SECRET_KEY;
    Cashfree.XEnvironment = process.env.CASHFREE_ENVIRONMENT === 'production' 
        ? Cashfree.Environment.PRODUCTION 
        : Cashfree.Environment.SANDBOX;
        
    console.log(`[CASHFREE_CONFIG] Initialized in ${process.env.CASHFREE_ENVIRONMENT || 'sandbox'} mode`);
} catch (error) {
    console.error('[CASHFREE_CONFIG] Configuration error:', error.message);
}

export class CashfreePayoutService {
    
    /**
     * Initialize a payout for salary transfer
     * @param {string} salaryRecordId 
     * @param {number} incentive 
     * @param {number} bonus 
     * @param {string} remarks 
     * @returns {Object} Payout response
     */
    static async initiateSalaryPayout(salaryRecordId, incentive = 0, bonus = 0, remarks = '') {
        try {
            console.log("[CASHFREE_PAYOUT] Initiating salary payout for record:", salaryRecordId);

            // Fetch salary record with user and bank details
            const salaryRecord = await prisma.salaryRecord.findUnique({
                where: { id: salaryRecordId },
                include: {
                    user: {
                        include: {
                            bankDetails: true,
                            organization: true
                        }
                    }
                }
            });

            if (!salaryRecord) {
                throw new Error("Salary record not found");
            }

            if (salaryRecord.status === 'PAID') {
                throw new Error("Salary already paid");
            }

            if (!salaryRecord.user.bankDetails) {
                throw new Error("Bank details not found for employee");
            }

            // Calculate total amount
            const incentiveAmount = parseFloat(incentive) || 0;
            const bonusAmount = parseFloat(bonus) || 0;
            const totalAmount = salaryRecord.netSalary + incentiveAmount + bonusAmount;

            // Generate unique transfer ID
            const transferId = this.generateTransferId(salaryRecord);

            // Prepare payout request
            const payoutRequest = {
                transferId: transferId,
                amount: totalAmount.toFixed(2),
                remarks: remarks || `Salary for ${salaryRecord.month}/${salaryRecord.year}`,
                beneDetails: {
                    name: `${salaryRecord.user.firstName} ${salaryRecord.user.lastName}`.trim(),
                    email: salaryRecord.user.email,
                    phone: salaryRecord.user.phoneNumber || "9999999999", // Default if phone not available
                    address1: "Employee Address", // You may want to add address to user model
                    city: "City",
                    state: "State",
                    pincode: "000000",
                    bankAccount: salaryRecord.user.bankDetails.accountNumber,
                    ifsc: salaryRecord.user.bankDetails.ifscCode,
                    vpa: null // For UPI transfers, can be added later
                }
            };

            console.log("[CASHFREE_PAYOUT] Payout request:", JSON.stringify(payoutRequest, null, 2));

            // Create payout
            const response = await Cashfree.PGPayout(payoutRequest);

            console.log("[CASHFREE_PAYOUT] Cashfree response:", response);

            // Create transaction record
            const transaction = await prisma.transactionTable.create({
                data: {
                    senderUserId: "SYSTEM", // You might want to pass actual sender ID
                    recieverUserId: salaryRecord.userId,
                    amount: totalAmount,
                    bankTransactionId: transferId,
                    type: 'SALARY',
                    status: 'PENDING',
                    cashfreeTransferId: transferId,
                    cashfreeResponse: response
                }
            });

            // Update salary record status to PROCESSING
            await prisma.salaryRecord.update({
                where: { id: salaryRecordId },
                data: {
                    status: 'PROCESSING',
                    paymentMode: 'CASHFREE_PAYOUT',
                    paymentRef: transferId,
                    remarks: remarks || `Salary for ${salaryRecord.month}/${salaryRecord.year}`
                }
            });

            return {
                success: true,
                transferId: transferId,
                amount: totalAmount,
                status: 'PROCESSING',
                cashfreeResponse: response,
                transactionId: transaction.id
            };

        } catch (error) {
            console.error("[CASHFREE_PAYOUT] Error initiating payout:", error);
            throw new Error(`Failed to initiate Cashfree payout: ${error.message}`);
        }
    }

    /**
     * Check the status of a payout
     * @param {string} transferId 
     * @returns {Object} Status response
     */
    static async checkPayoutStatus(transferId) {
        try {
            console.log("[CASHFREE_PAYOUT] Checking status for transfer:", transferId);

            // Get status from Cashfree
            const statusResponse = await Cashfree.PGPayoutStatus(transferId);

            console.log("[CASHFREE_PAYOUT] Status response:", statusResponse);

            // Update transaction record
            const transaction = await prisma.transactionTable.findFirst({
                where: { cashfreeTransferId: transferId }
            });

            if (transaction) {
                await prisma.transactionTable.update({
                    where: { id: transaction.id },
                    data: {
                        status: this.mapCashfreeStatus(statusResponse.status),
                        cashfreeResponse: statusResponse
                    }
                });

                // Update salary record if payment is successful
                if (statusResponse.status === 'SUCCESS') {
                    await prisma.salaryRecord.update({
                        where: { 
                            paymentRef: transferId 
                        },
                        data: {
                            status: 'PAID',
                            processedAt: new Date()
                        }
                    });

                    // Send notification to employee
                    await this.sendPaymentNotification(transaction.recieverUserId, transferId);
                }
            }

            return {
                success: true,
                transferId: transferId,
                status: statusResponse.status,
                details: statusResponse
            };

        } catch (error) {
            console.error("[CASHFREE_PAYOUT] Error checking status:", error);
            throw new Error(`Failed to check payout status: ${error.message}`);
        }
    }

    /**
     * Handle Cashfree webhook for payout status updates
     * @param {Object} webhookData 
     * @returns {Object} Response
     */
    static async handleWebhook(webhookData) {
        try {
            console.log("[CASHFREE_WEBHOOK] Received webhook:", JSON.stringify(webhookData, null, 2));

            const { transferId, status, amount, utr } = webhookData;

            // Verify webhook signature if needed
            if (!this.verifyWebhookSignature(webhookData)) {
                throw new Error("Invalid webhook signature");
            }

            // Update transaction record
            const transaction = await prisma.transactionTable.findFirst({
                where: { cashfreeTransferId: transferId }
            });

            if (!transaction) {
                console.log("[CASHFREE_WEBHOOK] Transaction not found for transfer:", transferId);
                return { success: false, message: "Transaction not found" };
            }

            // Update transaction status
            await prisma.transactionTable.update({
                where: { id: transaction.id },
                data: {
                    status: this.mapCashfreeStatus(status),
                    utr: utr,
                    cashfreeResponse: webhookData
                }
            });

            // Update salary record based on status
            const salaryRecord = await prisma.salaryRecord.findFirst({
                where: { paymentRef: transferId }
            });

            if (salaryRecord) {
                if (status === 'SUCCESS') {
                    await prisma.salaryRecord.update({
                        where: { id: salaryRecord.id },
                        data: {
                            status: 'PAID',
                            processedAt: new Date()
                        }
                    });

                    // Send success notification
                    await this.sendPaymentNotification(transaction.recieverUserId, transferId, true);

                } else if (status === 'FAILED' || status === 'CANCELLED') {
                    await prisma.salaryRecord.update({
                        where: { id: salaryRecord.id },
                        data: {
                            status: 'FAILED',
                            remarks: `Payment failed: ${webhookData.reason || 'Unknown error'}`
                        }
                    });

                    // Send failure notification
                    await this.sendPaymentNotification(transaction.recieverUserId, transferId, false);
                }
            }

            return {
                success: true,
                transferId: transferId,
                status: status
            };

        } catch (error) {
            console.error("[CASHFREE_WEBHOOK] Error processing webhook:", error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get account balance from Cashfree
     * @returns {Object} Balance response
     */
    static async getAccountBalance() {
        try {
            const balanceResponse = await Cashfree.PGPayoutBalance();
            return {
                success: true,
                balance: balanceResponse
            };
        } catch (error) {
            console.error("[CASHFREE_PAYOUT] Error getting balance:", error);
            throw new Error(`Failed to get account balance: ${error.message}`);
        }
    }

    // Helper methods

    /**
     * Generate unique transfer ID
     * @param {Object} salaryRecord 
     * @returns {string} Transfer ID
     */
    static generateTransferId(salaryRecord) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        return `PAY_${salaryRecord.userId.slice(-8)}_${salaryRecord.month}_${salaryRecord.year}_${timestamp}_${random}`;
    }

    /**
     * Map Cashfree status to internal status
     * @param {string} cashfreeStatus 
     * @returns {string} Internal status
     */
    static mapCashfreeStatus(cashfreeStatus) {
        const statusMap = {
            'SUCCESS': 'COMPLETED',
            'PENDING': 'PENDING',
            'FAILED': 'FAILED',
            'CANCELLED': 'CANCELLED',
            'PROCESSING': 'PENDING'
        };
        return statusMap[cashfreeStatus] || 'PENDING';
    }

    /**
     * Verify webhook signature
     * @param {Object} webhookData 
     * @returns {boolean} Is valid
     */
    static verifyWebhookSignature(webhookData) {
        // Implement webhook signature verification based on Cashfree documentation
        // For now, returning true - you should implement proper verification
        return true;
    }

    /**
     * Send payment notification to employee
     * @param {string} userId 
     * @param {string} transferId 
     * @param {boolean} isSuccess 
     */
    static async sendPaymentNotification(userId, transferId, isSuccess = true) {
        try {
            const message = isSuccess 
                ? `Your salary has been successfully transferred. Reference: ${transferId}`
                : `Your salary transfer failed. Please contact HR. Reference: ${transferId}`;

            await prisma.notification.create({
                data: {
                    userId: userId,
                    templateId: 'cm72bckox0001tla4c4w12h3p', // Update with correct template ID
                    content: message,
                    metadata: {
                        transferId: transferId,
                        type: 'SALARY_PAYMENT',
                        status: isSuccess ? 'SUCCESS' : 'FAILED'
                    }
                }
            });
        } catch (error) {
            console.error("[CASHFREE_PAYOUT] Error sending notification:", error);
        }
    }
}
