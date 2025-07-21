import { configDotenv } from "dotenv";
configDotenv();

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
            "support@alkaa.online",
            "shramana.show@alkaa.online",
        ];        
        const emailData = {
            sender: {
                name: "Alkaa Demo Requests",
                email: process.env.SENDER_EMAIL || "noreply@alkaa.online"
            },
            to: recipients.map(email => ({ email })),
            subject: `New Demo Request from ${company}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
                    <div style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center;">
                            <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Demo Request</h1>
                        </div>
                        <div style="padding: 40px 30px;">
                            <p style="color: #4a4a4a; margin-bottom: 25px; line-height: 1.6; font-size: 16px;">
                                Hey team! 👋 We've got a new demo request that looks promising.
                            </p>
                            
                            <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
                                <h3 style="color: #1a1a1a; margin-top: 0; margin-bottom: 20px; font-size: 18px; font-weight: 500;">Contact Details:</h3>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500; width: 120px;">Name:</td>
                                        <td style="padding: 8px 0; color: #212529; font-weight: 500;">${name}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Company:</td>
                                        <td style="padding: 8px 0; color: #212529; font-weight: 500;">${company}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Phone:</td>
                                        <td style="padding: 8px 0; color: #212529; font-weight: 500;">${phoneNumber}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 8px 0; color: #6c757d; font-weight: 500;">Email:</td>
                                        <td style="padding: 8px 0; color: #212529; font-weight: 500;">${email}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 6px; border-left: 4px solid #4CAF50; margin-bottom: 25px;">
                                <p style="color: #2e7d32; font-size: 14px; margin: 0; line-height: 1.5;">
                                    <strong>Pro tip:</strong> Reach out within 24 hours for the best conversion rate! 🚀
                                </p>
                            </div>
                            
                            <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                                Submitted on: ${new Date().toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                </div>
            `
        };

        const result = await sendBrevoEmail(emailData);        console.log("Email sent successfully via Brevo:", result);

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
