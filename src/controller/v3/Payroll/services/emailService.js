import prisma from "../../../../db/connectDb.js";
import { sendSalaryProcessingEmail } from "../../../../util/sendEmail.js";

export class EmailService {
    static async fetchUserData(userId) {
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
            throw new Error("User not found");
        }

        return user;
    } static async sendEmail(userId, salaryData) {
        const user = await this.fetchUserData(userId);
        const employeeName = `${user.firstName} ${user.lastName}`;

        // Ensure all required fields are properly structured for the email
        const emailSalaryData = {
            id: salaryData.id,
            month: salaryData.month,
            year: salaryData.year,
            basicSalary: salaryData.basicSalary,
            netSalary: salaryData.netSalary,
            tax: salaryData.tax || 0,
            paymentMode: salaryData.paymentMode,
            paymentRef: salaryData.paymentRef,
            allowances: salaryData.allowances || {},
            deductions: salaryData.deductions || {},
            currency: "" // Default currency symbol will be used from the email template
        };

        await sendSalaryProcessingEmail(
            user.email,
            employeeName,
            emailSalaryData,
            user.organization.name
        );
    }
}