import { configDotenv } from "dotenv";
configDotenv()

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const sendBrevoEmail = async (emailData) => {
    try {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Api-Key': BREVO_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
};

export const sendPasswordResetEmail = async (email, verificationToken, companyName, hiredDate) => {
    try {
        const emailData = {
            sender: {
                name: companyName,
                // email: "noreply@alkaa.online"
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: email,
                    name: "Customer"
                }
            ],
            subject: "Set Your Password",
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Welcome to ${companyName}</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            We're excited to have you join us starting from ${new Date(hiredDate).toLocaleDateString()}!
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            To get started, please set up your password by clicking the button below:
                        </p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/reset-password/${verificationToken}"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Set Password
                            </a>
                        </div>
                        <p style="color: #636363; font-size: 12px;">
                            If you didn't request this email, please ignore it.
                        </p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        return error;
    }
};

export const sendBillingEmail = async (email, billData, organizationName) => {
    try {
        const emailData = {
            sender: {
                name: organizationName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: email,
                    name: ""
                }
            ],
            subject: `${organizationName} - Billing Statement for ${billData.month}/${billData.year}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Billing Statement</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #34495e;">${organizationName}</h3>
                        <p><strong>Billing Period:</strong> ${new Date(billData.year, billData.month - 1).toLocaleDateString('default', { month: 'long' })} ${billData.year}</p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">Active Users</td>
                                <td style="padding: 8px; text-align: right;">${billData.activeUserCount}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">Price Per User</td>
                                <td style="padding: 8px; text-align: right;">$${billData.pricePerUser.toFixed(2)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px;">Subscription Plan</td>
                                <td style="padding: 8px; text-align: right;">${billData.subscriptionPlan}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd; font-weight: bold;">
                                <td style="padding: 8px;">Total Amount Due</td>
                                <td style="padding: 8px; text-align: right;">$${billData.totalAmount.toFixed(2)}</td>
                            </tr>
                        </table>
                        
                        <p><strong>Due Date:</strong> ${new Date(billData.dueDate).toLocaleDateString()}</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.ADMIN_URL || process.env.CLIENT_URL}/billing/pay/${billData.id}"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               View Details / Make Payment
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            If you have any questions about this bill, please contact our support team.
                        </p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        return error;
    }
};

