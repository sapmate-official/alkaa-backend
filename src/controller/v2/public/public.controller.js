import { Resend } from "resend";
import { configDotenv } from "dotenv";
configDotenv();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendDemoRequestEmail = async (req, res) => {
    try {
        const { name, company, phoneNumber, email } = req.body;
        console.log(req.body)

        // Validate input
        if (!name || !company || !phoneNumber || !email) {
            return res.status(400).json({ 
                error: "Missing required fields",
                required: ["name", "company", "phoneNumber", "email"]
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // Recipients list
        const recipients = [
            "parambrataghosh@Sapmate.com",
            "kabir.khan@Sapmate.com",
            "Sadaf.salam@Sapmate.com"
        ];

        // Send email to all recipients
        const { data, error } = await resend.emails.send({
            from: process.env.SENDER_EMAIL || "info@alkaa.online",
            to: recipients,
            subject: `New Demo Request from ${company}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">New Demo Request</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <h3 style="color: #34495e;">Client Information:</h3>
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Name:</td>
                                <td style="padding: 8px;">${name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Company:</td>
                                <td style="padding: 8px;">${company}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Phone Number:</td>
                                <td style="padding: 8px;">${phoneNumber}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Email:</td>
                                <td style="padding: 8px;">${email}</td>
                            </tr>
                        </table>
                        <p style="font-size: 14px; color: #636363;">
                            This demo request was submitted on: ${new Date().toLocaleString()}
                        </p>
                    </div>
                </div>
            `,
        });

        if (error) {
            console.error("Email sending error:", error);
            return res.status(500).json({ 
                error: "Failed to send email", 
                details: process.env.NODE_ENV === 'development' ? error.message : undefined 
            });
        }

        // Success response
        res.status(200).json({ 
            message: "Demo request email sent successfully",
            recipients: recipients.length
        });
    } catch (error) {
        console.error("Demo request error:", error);
        res.status(500).json({ 
            error: "Internal server error", 
            details: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
};
