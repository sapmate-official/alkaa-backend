import prisma from "../db/connectDb.js";
import { sendEmail } from "../util/sendEmail.js";

/**
 * Contract Expiry Checker Job
 * Runs daily to check for expiring contracts and deactivate expired ones
 */
class ContractExpiryChecker {
    constructor() {
        this.notificationThresholds = [30, 15, 7, 1]; // Days before expiry
    }

    /**
     * Main execution method
     */
    async execute() {
        try {
            console.log('[CONTRACT_EXPIRY_CHECKER] Starting contract expiry check...');
            
            const now = new Date();
            
            // Check for expired contracts and deactivate users
            await this.deactivateExpiredContracts(now);
            
            // Send notifications for expiring contracts
            await this.sendExpiryNotifications(now);
            
            console.log('[CONTRACT_EXPIRY_CHECKER] Contract expiry check completed successfully');
        } catch (error) {
            console.error('[CONTRACT_EXPIRY_CHECKER] Error during execution:', error);
            throw error;
        }
    }

    /**
     * Deactivate users whose contracts have expired
     */
    async deactivateExpiredContracts(now) {
        try {
            const expiredUsers = await prisma.user.findMany({
                where: {
                    contractEndDate: {
                        lte: now
                    },
                    isActive: true,
                    employmentType: {
                        in: ['PART_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT']
                    }
                },
                include: {
                    organization: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            if (expiredUsers.length === 0) {
                console.log('[CONTRACT_EXPIRY_CHECKER] No expired contracts found');
                return;
            }

            console.log(`[CONTRACT_EXPIRY_CHECKER] Found ${expiredUsers.length} expired contracts`);

            // Deactivate expired users
            const deactivationResults = await Promise.allSettled(
                expiredUsers.map(async (user) => {
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { isActive: false }
                    });

                    // Send deactivation notification
                    await this.sendDeactivationNotification(user);

                    return user;
                })
            );

            const successCount = deactivationResults.filter(r => r.status === 'fulfilled').length;
            const failCount = deactivationResults.filter(r => r.status === 'rejected').length;

            console.log(`[CONTRACT_EXPIRY_CHECKER] Deactivated ${successCount} users, ${failCount} failed`);
        } catch (error) {
            console.error('[CONTRACT_EXPIRY_CHECKER] Error deactivating expired contracts:', error);
            throw error;
        }
    }

    /**
     * Send notifications for contracts expiring soon
     */
    async sendExpiryNotifications(now) {
        try {
            for (const daysThreshold of this.notificationThresholds) {
                const targetDate = new Date(now);
                targetDate.setDate(targetDate.getDate() + daysThreshold);
                
                // Find users with contracts expiring on target date
                const expiringUsers = await prisma.user.findMany({
                    where: {
                        contractEndDate: {
                            gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                            lt: new Date(targetDate.setHours(23, 59, 59, 999))
                        },
                        isActive: true,
                        employmentType: {
                            in: ['PART_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT']
                        }
                    },
                    include: {
                        organization: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        manager: {
                            select: {
                                email: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                });

                if (expiringUsers.length === 0) {
                    console.log(`[CONTRACT_EXPIRY_CHECKER] No contracts expiring in ${daysThreshold} days`);
                    continue;
                }

                console.log(`[CONTRACT_EXPIRY_CHECKER] Found ${expiringUsers.length} contracts expiring in ${daysThreshold} days`);

                // Send notifications
                await Promise.allSettled(
                    expiringUsers.map(user => 
                        this.sendExpiryWarning(user, daysThreshold)
                    )
                );
            }
        } catch (error) {
            console.error('[CONTRACT_EXPIRY_CHECKER] Error sending expiry notifications:', error);
            throw error;
        }
    }

    /**
     * Send expiry warning email to employee and admin
     */
    async sendExpiryWarning(user, daysRemaining) {
        try {
            const employeeName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            const contractEndDate = new Date(user.contractEndDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Email to employee
            const employeeEmailContent = {
                to: user.email,
                subject: `Contract Expiry Notice - ${daysRemaining} Day${daysRemaining > 1 ? 's' : ''} Remaining`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                        <h2 style="color: #f59e0b;">Contract Expiry Notice</h2>
                        <p>Dear ${employeeName},</p>
                        <p>This is a reminder that your contract with <strong>${user.organization.name}</strong> is set to expire in <strong>${daysRemaining} day${daysRemaining > 1 ? 's' : ''}</strong>.</p>
                        <div style="background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>Employment Type:</strong> ${user.employmentType.replace('_', ' ')}</p>
                            <p style="margin: 0;"><strong>Contract End Date:</strong> ${contractEndDate}</p>
                        </div>
                        <p>Please contact your manager or HR department if you have any questions or wish to discuss contract renewal.</p>
                        <p style="margin-top: 30px;">Best regards,<br>${user.organization.name} HR Team</p>
                    </div>
                `
            };

            await sendEmail(employeeEmailContent);

            // Get organization admins
            const admins = await prisma.organization_admin.findMany({
                where: { orgId: user.orgId },
                include: {
                    admin_user: {
                        select: {
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });

            // Email to admins
            for (const admin of admins) {
                const adminEmailContent = {
                    to: admin.admin_user.email,
                    subject: `Contract Expiry Alert - ${employeeName} (${daysRemaining} Days)`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                            <h2 style="color: #ef4444;">Contract Expiry Alert</h2>
                            <p>Dear ${admin.admin_user.firstName || 'Admin'},</p>
                            <p>This is an automated notification that the following employee's contract is expiring soon:</p>
                            <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Employee:</strong> ${employeeName}</p>
                                <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${user.employeeId}</p>
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
                                <p style="margin: 5px 0;"><strong>Employment Type:</strong> ${user.employmentType.replace('_', ' ')}</p>
                                <p style="margin: 5px 0;"><strong>Contract End Date:</strong> ${contractEndDate}</p>
                                <p style="margin: 5px 0;"><strong>Days Remaining:</strong> ${daysRemaining}</p>
                            </div>
                            <p><strong>Action Required:</strong></p>
                            <ul>
                                <li>Review contract renewal requirements</li>
                                <li>Contact the employee to discuss continuation</li>
                                <li>Update contract end date if extending employment</li>
                            </ul>
                            <p style="color: #dc2626; font-weight: bold;">Note: The employee's account will be automatically deactivated on the contract end date if no action is taken.</p>
                            <p style="margin-top: 30px;">Best regards,<br>Alkaa HR System</p>
                        </div>
                    `
                };

                await sendEmail(adminEmailContent);
            }

            console.log(`[CONTRACT_EXPIRY_CHECKER] Sent expiry warning for user ${user.id} (${daysRemaining} days)`);
        } catch (error) {
            console.error(`[CONTRACT_EXPIRY_CHECKER] Error sending expiry warning for user ${user.id}:`, error);
        }
    }

    /**
     * Send deactivation notification
     */
    async sendDeactivationNotification(user) {
        try {
            const employeeName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
            const contractEndDate = new Date(user.contractEndDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Email to employee
            const employeeEmailContent = {
                to: user.email,
                subject: 'Account Deactivation - Contract Expired',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                        <h2 style="color: #dc2626;">Account Deactivation Notice</h2>
                        <p>Dear ${employeeName},</p>
                        <p>Your contract with <strong>${user.organization.name}</strong> has expired as of <strong>${contractEndDate}</strong>.</p>
                        <p>Your account has been automatically deactivated, and you will no longer have access to the system.</p>
                        <p>If you believe this is an error or wish to discuss contract renewal, please contact your HR department immediately.</p>
                        <p style="margin-top: 30px;">Best regards,<br>${user.organization.name} HR Team</p>
                    </div>
                `
            };

            await sendEmail(employeeEmailContent);

            // Get organization admins
            const admins = await prisma.organization_admin.findMany({
                where: { orgId: user.orgId },
                include: {
                    admin_user: {
                        select: {
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });

            // Email to admins
            for (const admin of admins) {
                const adminEmailContent = {
                    to: admin.admin_user.email,
                    subject: `Employee Deactivated - ${employeeName} (Contract Expired)`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
                            <h2 style="color: #dc2626;">Employee Account Deactivated</h2>
                            <p>Dear ${admin.admin_user.firstName || 'Admin'},</p>
                            <p>The following employee's account has been automatically deactivated due to contract expiry:</p>
                            <div style="background-color: #fee2e2; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p style="margin: 5px 0;"><strong>Employee:</strong> ${employeeName}</p>
                                <p style="margin: 5px 0;"><strong>Employee ID:</strong> ${user.employeeId}</p>
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
                                <p style="margin: 5px 0;"><strong>Employment Type:</strong> ${user.employmentType.replace('_', ' ')}</p>
                                <p style="margin: 5px 0;"><strong>Contract End Date:</strong> ${contractEndDate}</p>
                                <p style="margin: 5px 0;"><strong>Status:</strong> Deactivated</p>
                            </div>
                            <p>To reactivate this employee or extend their contract, please log in to the admin panel and update their employment details.</p>
                            <p style="margin-top: 30px;">Best regards,<br>Alkaa HR System</p>
                        </div>
                    `
                };

                await sendEmail(adminEmailContent);
            }

            console.log(`[CONTRACT_EXPIRY_CHECKER] Sent deactivation notification for user ${user.id}`);
        } catch (error) {
            console.error(`[CONTRACT_EXPIRY_CHECKER] Error sending deactivation notification for user ${user.id}:`, error);
        }
    }

    /**
     * Get list of expiring contracts for dashboard
     */
    async getExpiringContracts(orgId, daysAhead = 30) {
        try {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + daysAhead);

            const expiringUsers = await prisma.user.findMany({
                where: {
                    orgId,
                    contractEndDate: {
                        gte: new Date(),
                        lte: targetDate
                    },
                    isActive: true,
                    employmentType: {
                        in: ['PART_TIME', 'INTERN', 'CONTRACT', 'CONSULTANT']
                    }
                },
                select: {
                    id: true,
                    employeeId: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    employmentType: true,
                    contractEndDate: true,
                    department: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    contractEndDate: 'asc'
                }
            });

            return expiringUsers.map(user => ({
                ...user,
                daysRemaining: Math.ceil((new Date(user.contractEndDate) - new Date()) / (1000 * 60 * 60 * 24))
            }));
        } catch (error) {
            console.error('[CONTRACT_EXPIRY_CHECKER] Error fetching expiring contracts:', error);
            throw error;
        }
    }
}

export default new ContractExpiryChecker();
