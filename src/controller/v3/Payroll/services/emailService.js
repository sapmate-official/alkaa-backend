import prisma from "../../../../db/connectDb.js";
import { sendSalaryProcessingEmail } from "../../../../util/sendEmail.js";

export class EmailService {
    static async fetchUserData(userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    organization: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            if (!user) {
                throw new Error(`User with ID ${userId} not found`);
            }

            return user;
        } catch (error) {
            console.error("[EMAIL_SERVICE] Error fetching user data:", error);
            throw new Error(`Failed to fetch user data: ${error.message}`);
        }
    }

    static async sendEmail(userId, salaryData) {
        try {
            console.log("[EMAIL_SERVICE] Starting email sending process", {
                userId,
                salaryRecordId: salaryData.id
            });

            // Fetch user data with error handling
            const user = await this.fetchUserData(userId);
            
            // Validate required user data
            if (!user.email) {
                throw new Error("User email is required for sending salary notification");
            }

            if (!user.firstName && !user.lastName) {
                throw new Error("User name is required for sending salary notification");
            }

            const employeeName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

            // Validate salary data
            if (!salaryData || !salaryData.id) {
                throw new Error("Valid salary data is required");
            }

            // Ensure all required fields are properly structured for the email
            const emailSalaryData = {
                id: salaryData.id,
                month: salaryData.month || new Date().getMonth() + 1,
                year: salaryData.year || new Date().getFullYear(),
                basicSalary: parseFloat(salaryData.basicSalary) || 0,
                netSalary: parseFloat(salaryData.netSalary) || 0,
                tax: parseFloat(salaryData.tax) || 0,
                paymentMode: salaryData.paymentMode || 'Bank Transfer',
                paymentRef: salaryData.paymentRef || null,
                allowances: salaryData.allowances || {},
                deductions: salaryData.deductions || {},
                currency: "₹" // Default currency symbol
            };

            // Validate organization data
            const companyName = user.organization?.name || 'Company';

            console.log("[EMAIL_SERVICE] Sending salary notification email", {
                recipient: user.email,
                employeeName,
                month: emailSalaryData.month,
                year: emailSalaryData.year
            });

            // Send email with error handling
            const emailResult = await sendSalaryProcessingEmail(
                user.email,
                employeeName,
                emailSalaryData,
                companyName
            );

            // Check if email was sent successfully
            if (emailResult instanceof Error) {
                throw emailResult;
            }

            console.log("[EMAIL_SERVICE] Email sent successfully", {
                recipient: user.email,
                salaryRecordId: salaryData.id
            });

            return emailResult;

        } catch (error) {
            console.error("[EMAIL_SERVICE] Error sending email:", error);
            
            // Don't throw the error to prevent salary generation from failing
            // Just log it and continue
            console.warn("[EMAIL_SERVICE] Email sending failed, but salary generation continues");
            return { error: error.message };
        }
    }
}