import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY)

export const sendPasswordResetEmail = async (email,verificationToken) => {
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.SENDER_EMAIL,
            to: [email],
            subject: "Set Your Password",
            html: `<h1>Click the link below to reset your password</h1>
            <a href="${process.env.CLIENT_URL}/reset-password/${verificationToken}">Reset Password</a>`,
          });
            if (error) {
                return error
            }
        return data
    } catch (error) {
        return error
    }
}