import { Resend } from "resend";
import { configDotenv } from "dotenv";
configDotenv()

const resend = new Resend(process.env.RESEND_API_KEY)
export const sendPasswordResetEmail = async (email, verificationToken, companyName, hiredDate) => {
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.SENDER_EMAIL,
            to: [email],
            subject: "Set Your Password",
            html: `
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
            `,
        });
        if (error) {
            return error;
        }
        return data;
    } catch (error) {
        return error;
    }
};
