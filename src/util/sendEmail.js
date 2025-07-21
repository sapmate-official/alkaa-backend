import { configDotenv } from "dotenv";
configDotenv()

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const sendBrevoEmail = async (emailData) => {
    try {
        console.log("Sending email via Brevo API with data:", emailData);
        
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
            console.error("Brevo API error response:", errorData);
            throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }
        console.log("Email sent successfully via Brevo",response.status);

        return await response.json();
    } catch (error) {
        throw error;
    }
};

export const sendPasswordResetEmail = async (email, verificationToken, companyName, hiredDate) => {
    try {
        const emailData = {
            sender: {
                name: companyName || "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: email,
                    name: "Customer"
                }
            ],
            subject: `Set Your Password - ${companyName || "Alkaa"}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
                    <div style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center;">
                            <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.5px;">Welcome to ${companyName || "Alkaa"}</h1>
                        </div>
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #1a1a1a; font-size: 22px; font-weight: 500; margin-bottom: 20px;">You're almost ready to get started!</h2>
                            <p style="color: #4a4a4a; margin-bottom: 20px; line-height: 1.6; font-size: 16px;">
                                We're excited to have you join ${companyName || "our team"} starting from <strong>${new Date(hiredDate).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}</strong>!
                            </p>
                            <p style="color: #4a4a4a; margin-bottom: 30px; line-height: 1.6; font-size: 16px;">
                                To complete your account setup, please create your password by clicking the button below:
                            </p>
                            <div style="text-align: center; margin: 40px 0;">
                                <a href="${process.env.CLIENT_URL}/reset-password/${verificationToken}"
                                   style="background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; font-size: 16px; box-shadow: 0 4px 12px rgba(46, 125, 50, 0.3); transition: all 0.2s;">
                                   Create My Password
                                </a>
                            </div>
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #4CAF50;">
                                <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                                    This link will expire in 24 hours for security reasons. If you didn't expect this email or have any questions, please contact your manager or our support team.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #8e8e93; font-size: 12px;">
                        <p style="margin: 0;">© ${new Date().getFullYear()} ${companyName || "Alkaa"}. All rights reserved.</p>
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
                name: organizationName || "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: email,
                    name: ""
                }
            ],
            subject: `${organizationName || "Alkaa"} - Billing Statement for ${billData.month}/${billData.year}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fafafa;">
                    <div style="background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center;">
                            <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Billing Statement</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0; font-size: 16px;">${organizationName}</p>
                        </div>
                        <div style="padding: 40px 30px;">
                            <h2 style="color: #1a1a1a; font-size: 20px; font-weight: 500; margin-bottom: 25px;">
                                ${new Date(billData.year, billData.month - 1).toLocaleDateString('default', { month: 'long' })} ${billData.year} Statement
                            </h2>
                            
                            <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 12px 0; color: #6c757d; font-size: 15px; border-bottom: 1px solid #e9ecef;">Active Users</td>
                                        <td style="padding: 12px 0; text-align: right; font-weight: 500; color: #212529; border-bottom: 1px solid #e9ecef;">${billData.activeUserCount}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #6c757d; font-size: 15px; border-bottom: 1px solid #e9ecef;">Price Per User</td>
                                        <td style="padding: 12px 0; text-align: right; font-weight: 500; color: #212529; border-bottom: 1px solid #e9ecef;">$${billData.pricePerUser.toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px 0; color: #6c757d; font-size: 15px; border-bottom: 1px solid #e9ecef;">Subscription Plan</td>
                                        <td style="padding: 12px 0; text-align: right; font-weight: 500; color: #212529; border-bottom: 1px solid #e9ecef;">${billData.subscriptionPlan}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 15px 0 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">Total Amount Due</td>
                                        <td style="padding: 15px 0 0; text-align: right; font-weight: 600; color: #1a1a1a; font-size: 18px;">$${billData.totalAmount.toFixed(2)}</td>
                                    </tr>
                                </table>
                            </div>
                            
                            <p style="color: #4a4a4a; margin-bottom: 25px; line-height: 1.6; font-size: 15px;">
                                <strong>Payment Due:</strong> ${new Date(billData.dueDate).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}
                            </p>
                            
                            <div style="text-align: center; margin: 35px 0;">
                                <a href="${process.env.ADMIN_URL || process.env.CLIENT_URL}/billing/pay/${billData.id}"
                                   style="background: linear-gradient(135deg, #FF9800, #FFB74D); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);">
                                   View Details & Pay
                                </a>
                            </div>
                            
                            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; border-left: 4px solid #FF9800;">
                                <p style="color: #6c757d; font-size: 14px; margin: 0; line-height: 1.5;">
                                    Questions about this invoice? We're here to help! Contact our billing support team anytime.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #8e8e93; font-size: 12px;">
                        <p style="margin: 0;">© ${new Date().getFullYear()} ${organizationName || "Alkaa"}. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        return error;
    }
};

export const sendLeaveRequestEmail = async (managerEmail, adminEmail, employeeName, employeeEmail, leaveData, companyName) => {
    try {
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: managerEmail,
                    name: "Manager"
                },
                {
                    email: adminEmail,
                    name: "Admin"
                }
            ],
            subject: `Leave Request from ${employeeName} - Alkaa`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Leave Request</h1>
                    </div>
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            <strong>${employeeName}</strong> has submitted a leave request that requires your attention.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Employee</td>
                                <td style="padding: 8px;">${employeeName} (${employeeEmail})</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Leave Type</td>
                                <td style="padding: 8px;">${leaveData.leaveType}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Start Date</td>
                                <td style="padding: 8px;">${new Date(leaveData.startDate).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">End Date</td>
                                <td style="padding: 8px;">${new Date(leaveData.endDate).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Duration</td>
                                <td style="padding: 8px;">${leaveData.duration} day(s)</td>
                            </tr>
                            ${leaveData.reason ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Reason</td>
                                <td style="padding: 8px;">${leaveData.reason}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/p/leaverequest/approve"
                               style="background: linear-gradient(135deg, #2E7D32, #4CAF50); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; margin-right: 10px; display: inline-block; font-weight: bold;">
                               Approve
                            </a>
                            <a href="${process.env.CLIENT_URL}/p/leaverequest/approve"
                               style="background: linear-gradient(135deg, #f44336, #ef5350); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                               Reject
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            Please review and respond to this leave request at your earliest convenience.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 30px; padding: 15px; background-color: #f1f1f1; border-radius: 5px;">
                        <p style="margin: 0; color: #888; font-size: 12px;">© 2024 Alkaa. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        return error;
    }
};

export const sendCheckoutReminderEmail = async (employeeEmail, employeeName, checkInTime, companyName, managerEmail) => {
    try {
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: employeeEmail,
                    name: employeeName
                }
            ],
            cc: managerEmail ? [
                {
                    email: managerEmail,
                    name: "Manager"
                }
            ] : [],
            subject: `Reminder: Please Check Out for Today`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Checkout Reminder</h1>
                    </div>
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            Hello <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #4a4a4a; margin-bottom: 20px; line-height: 1.6; font-size: 16px;">
                            Our records show that you checked in at <strong>${new Date(checkInTime).toLocaleTimeString()}</strong> today 
                            but haven't checked out yet. It has been more than 8 hours since your check-in.
                        </p>
                        <p style="color: #4a4a4a; margin-bottom: 30px; line-height: 1.6; font-size: 16px;">
                            Please remember to check out through the attendance system to ensure accurate time tracking.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/attendance/checkout"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Check Out Now
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            If you're still working, please disregard this message. The system will automatically record your session 
                            when you check out.
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

export const sendAttendanceVerificationEmail = async (managerEmail, adminEmail, employeeName, employeeEmail, attendanceData, companyName) => {
    try {
        console.log("Sending attendance verification email...");
        
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: managerEmail,
                    name: "Manager"
                },
                {
                    email: adminEmail,
                    name: "Admin"
                }
            ],
            subject: `Attendance Verification Required: ${employeeName}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Attendance Verification Required</h1>
                    </div>
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            <strong>${employeeName}</strong> has submitted an attendance record that requires verification.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Employee</td>
                                <td style="padding: 8px;">${employeeName} (${employeeEmail})</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Date</td>
                                <td style="padding: 8px;">${new Date(attendanceData.date).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Check-in Time</td>
                                <td style="padding: 8px;">${new Date(attendanceData.checkInTime).toLocaleTimeString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Session</td>
                                <td style="padding: 8px;">${attendanceData.sessionNumber}</td>
                            </tr>
                        </table>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/attendance/verify/${attendanceData.id}"
                               style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
                               Verify
                            </a>
                            <a href="${process.env.CLIENT_URL}/attendance/reject/${attendanceData.id}"
                               style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Reject
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            Please review and respond to this attendance verification request at your earliest convenience.
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

export const sendLeaveStatusUpdateEmail = async (employeeEmail, employeeName, leaveData, status, rejectionReason, companyName) => {
    try {
        // Determine the status message and color
        let statusText = status === 'APPROVED' ? 'approved' : (status === 'REJECTED' ? 'rejected' : 'canceled');
        let statusColor = status === 'APPROVED' ? '#28a745' : (status === 'REJECTED' ? '#dc3545' : '#ffc107');
        
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: employeeEmail,
                    name: employeeName
                }
            ],
            subject: `Leave Request ${statusText.toUpperCase()}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Leave Request Update</h1>
                    </div>
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            Your leave request has been <strong style="color: ${statusColor};">${statusText}</strong>.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Leave Type</td>
                                <td style="padding: 8px;">${leaveData.leaveType}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Start Date</td>
                                <td style="padding: 8px;">${new Date(leaveData.startDate).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">End Date</td>
                                <td style="padding: 8px;">${new Date(leaveData.endDate).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Duration</td>
                                <td style="padding: 8px;">${leaveData.duration} day(s)</td>
                            </tr>
                            ${status === 'REJECTED' && rejectionReason ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Rejection Reason</td>
                                <td style="padding: 8px;">${rejectionReason}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <p style="font-size: 12px; color: #636363;">
                            For any queries regarding your leave request, please contact your manager or HR.
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

export const sendSalaryProcessingEmail = async (employeeEmail, employeeName, salaryData, companyName) => {
    try {
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: employeeEmail,
                    name: employeeName
                }
            ],
            subject: `Salary Processed for ${salaryData.month}/${salaryData.year}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Salary Notification</h1>
                    </div>
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            Your salary for ${new Date(salaryData.year, salaryData.month - 1).toLocaleDateString('default', { month: 'long', year: 'numeric' })} has been processed.
                        </p>
                        
                        <div style="background-color: #f8f9fa; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <td style="padding: 12px 0; color: #6c757d; font-size: 15px; border-bottom: 1px solid #e9ecef;">Basic Salary</td>
                                    <td style="padding: 12px 0; text-align: right; font-weight: 500; color: #212529; border-bottom: 1px solid #e9ecef;">${salaryData.currency || '$'}${salaryData.basicSalary.toFixed(2)}</td>
                                </tr>
                                ${salaryData.allowances ? Object.entries(salaryData.allowances).map(([key, value]) => `
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <td style="padding: 8px;">${key}</td>
                                    <td style="padding: 8px; text-align: right;">${salaryData.currency || '$'}${parseFloat(value).toFixed(2)}</td>
                                </tr>
                                `).join('') : ''}
                                ${salaryData.deductions ? Object.entries(salaryData.deductions).map(([key, value]) => `
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <td style="padding: 8px;">${key} (Deduction)</td>
                                    <td style="padding: 8px; text-align: right;">-${salaryData.currency || '$'}${parseFloat(value).toFixed(2)}</td>
                                </tr>
                                `).join('') : ''}
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <td style="padding: 8px; font-weight: bold;">Tax Deduction</td>
                                    <td style="padding: 8px; text-align: right;">-${salaryData.currency || '$'}${salaryData.tax.toFixed(2)}</td>
                                </tr>
                                <tr style="border-bottom: 1px solid #ddd; font-weight: bold;">
                                    <td style="padding: 8px;">Net Salary</td>
                                    <td style="padding: 8px; text-align: right;">${salaryData.currency || '$'}${salaryData.netSalary.toFixed(2)}</td>
                                </tr>
                            </table>
                        </div>
                        
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            <strong>Payment Method:</strong> ${salaryData.paymentMode || 'Bank Transfer'}
                        </p>
                        ${salaryData.paymentRef ? `
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            <strong>Payment Reference:</strong> ${salaryData.paymentRef}
                        </p>
                        ` : ''}
                        
                        <div style="text-align: center; margin: 35px 0;">
                            <a href="${process.env.CLIENT_URL}/payslip/${salaryData.id}"
                               style="background-color: #007bff; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500; font-size: 16px; box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);">
                               View Detailed Payslip
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            For any queries regarding your salary, please contact the HR department.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #8e8e93; font-size: 12px;">
                        <p style="margin: 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        return error;
    }
};

export const sendNewEmployeeWelcomeEmail = async (employeeEmail, employeeName, managerEmail, managerName, departmentHead, teamMembers, employeeDetails, companyName) => {
    try {
        // Build CC array conditionally
        const ccList = [
            {
                email: managerEmail,
                name: managerName
            }
        ];
        
        // Only add department head to CC if it exists
        if (departmentHead && departmentHead.email) {
            ccList.push({
                email: departmentHead.email,
                name: departmentHead.name
            });
        }
        
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: employeeEmail,
                    name: employeeName
                }
            ],
            cc: ccList,
            subject: `Welcome to Alkaa!`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #4CAF50, #FF9800); border-radius: 10px;">
                        <img src="https://www.alkaa.online/logo.svg" alt="Alkaa" style="height: 60px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Alkaa!</h1>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            We are delighted to welcome you to Alkaa! We are excited to have you join our team 
                            and look forward to your contributions.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Here's some important information to help you get started:
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Employee ID</td>
                                <td style="padding: 8px;">${employeeDetails.employeeId || 'To be assigned'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Department</td>
                                <td style="padding: 8px;">${employeeDetails.department}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Reporting Manager</td>
                                <td style="padding: 8px;">${managerName}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Start Date</td>
                                <td style="padding: 8px;">${new Date(employeeDetails.hiredDate).toLocaleDateString()}</td>
                            </tr>
                        </table>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/reset-password/${employeeDetails.verificationToken}"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Set Up Your Account
                            </a>
                        </div>
                        
                        ${teamMembers && teamMembers.length > 0 ? `
                        <p style="color: #636363; margin-bottom: 15px;">
                            <strong>Meet Your Team:</strong>
                        </p>
                        <ul style="color: #636363; margin-bottom: 15px;">
                            ${teamMembers.map(member => `<li>${member.name} - ${member.role}</li>`).join('')}
                        </ul>
                        ` : ''}
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If you have any questions, please don't hesitate to reach out to your manager or the HR team.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            We look forward to your success with us!
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Best regards,<br>
                            HR Team<br>
                            Alkaa
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

// export const sendSecurityAlertEmail = async (email, alertType, details, ipAddress, deviceInfo, companyName) => {
//     try {
//         let subject = '';
//         let actionText = '';
//         let actionDescription = '';
//         let alertColor = '';
        
//         switch (alertType) {
//             case 'password_reset':
//                 subject = 'Password Reset Requested';
//                 actionText = 'Reset Password';
//                 actionDescription = 'A password reset was requested for your account.';
//                 alertColor = '#ffc107'; // Warning yellow
//                 break;
//             case 'suspicious_login':
//                 subject = 'Suspicious Login Detected';
//                 actionText = 'Secure Account';
//                 actionDescription = 'We detected a suspicious login attempt on your account.';
//                 alertColor = '#dc3545'; // Danger red
//                 break;
//             case 'account_locked':
//                 subject = 'Account Temporarily Locked';
//                 actionText = 'Unlock Account';
//                 actionDescription = 'Your account has been temporarily locked due to multiple failed login attempts.';
//                 alertColor = '#dc3545'; // Danger red
//                 break;
//             default:
//                 subject = 'Security Alert';
//                 actionText = 'Review Account';
//                 actionDescription = 'A security event was detected on your account.';
//                 alertColor = '#ffc107'; // Warning yellow
//         }
        
//         const emailData = {
//             sender: {
//                 name: companyName,
//                 email: process.env.SENDER_EMAIL
//             },
//             to: [
//                 {
//                     email: email,
//                     name: "User"
//                 }
//             ],
//             subject: `${subject} - ${companyName}`,
//             htmlContent: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <h2 style="color: ${alertColor}; text-align: center;">${subject}</h2>
//                     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             <strong>${actionDescription}</strong>
//                         </p>
                        
//                         <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Time</td>
//                                 <td style="padding: 8px;">${new Date().toLocaleString()}</td>
//                             </tr>
//                             ${ipAddress ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">IP Address</td>
//                                 <td style="padding: 8px;">${ipAddress}</td>
//                             </tr>
//                             ` : ''}
//                             ${deviceInfo ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Device</td>
//                                 <td style="padding: 8px;">${deviceInfo}</td>
//                             </tr>
//                             ` : ''}
//                             ${details ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Details</td>
//                                 <td style="padding: 8px;">${details}</td>
//                             </tr>
//                             ` : ''}
//                         </table>
                        
//                         <div style="text-align: center; margin: 30px 0;">
//                             <a href="${process.env.CLIENT_URL}/security/account"
//                                style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
//                                ${actionText}
//                             </a>
//                         </div>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             If this was not you, please contact our support team immediately or change your password.
//                         </p>
                        
//                         <p style="font-size: 12px; color: #636363;">
//                             This is an automated security alert. Please do not reply to this email.
//                         </p>
//                     </div>
//                 </div>
//             `
//         };

//         return await sendBrevoEmail(emailData);
//     } catch (error) {
//         return error;
//     }
// };

export const sendHolidayAnnouncementEmail = async (emails, holidayData, companyName) => {
    try {
        // Format recipients for bulk email
        const recipients = emails.map(email => ({ email, name: "Employee" }));
        
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: recipients,
            subject: `Holiday Announcement: ${holidayData.name}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #4CAF50, #FF9800); border-radius: 10px;">
                        <img src="https://www.alkaa.online/logo.svg" alt="Alkaa" style="height: 60px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Holiday Announcement</h1>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear Employees,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            We are pleased to announce an upcoming holiday:
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Holiday Name</td>
                                <td style="padding: 8px;">${holidayData.name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Date</td>
                                <td style="padding: 8px;">${new Date(holidayData.date).toLocaleDateString('default', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                })}</td>
                            </tr>
                            ${holidayData.description ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Description</td>
                                <td style="padding: 8px;">${holidayData.description}</td>
                            </tr>
                            ` : ''}
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Type</td>
                                <td style="padding: 8px;">${holidayData.isOptional ? 'Optional Holiday' : 'Company-wide Holiday'}</td>
                            </tr>
                        </table>
                        
                        ${holidayData.isOptional ? `
                        <p style="color: #636363; margin-bottom: 15px;">
                            This is an optional holiday. If you wish to take this day off, please submit a leave request through the system.
                        </p>
                        ` : `
                        <p style="color: #636363; margin-bottom: 15px;">
                            The office will be closed on this day. Please plan your work accordingly.
                        </p>
                        `}
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/holidays"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               View Holiday Calendar
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Best regards,<br>
                            HR Team<br>
                            Alkaa
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

export const sendDepartmentChangeEmail = async (employeeEmail, employeeName, oldDepartment, newDepartment, oldManager, newManager, hrAdmin, effectiveDate, companyName) => {
    try {
        // Recipients
        const recipients = [
            { email: employeeEmail, name: employeeName }
        ];
        
        // Add managers and HR admin to CC
        const cc = [];
        if (oldManager) {
            cc.push({ email: oldManager.email, name: oldManager.name });
        }
        if (newManager) {
            cc.push({ email: newManager.email, name: newManager.name });
        }
        if (hrAdmin) {
            cc.push({ email: hrAdmin.email, name: "HR Admin" });
        }
        
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: recipients,
            cc: cc,
            subject: `Department Change Notification - ${employeeName}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #2E7D32 0%, #4CAF50 50%, #FF9800 100%); padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                        <img src="${process.env.CLIENT_URL}/logo.svg" alt="Alkaa" style="height: 50px; margin-bottom: 15px;" onerror="this.style.display='none';">
                        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Department Change Notification</h1>
                    </div>
                    <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #333; margin-bottom: 20px; font-size: 16px;">
                            This is to inform you that your department has been changed from <strong>${oldDepartment.name}</strong> 
                            to <strong>${newDepartment.name}</strong> effective from <strong>${new Date(effectiveDate).toLocaleDateString()}</strong>.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Current Department</td>
                                <td style="padding: 8px;">${oldDepartment.name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">New Department</td>
                                <td style="padding: 8px;">${newDepartment.name}</td>
                            </tr>
                            ${oldManager ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Current Manager</td>
                                <td style="padding: 8px;">${oldManager.name}</td>
                            </tr>
                            ` : ''}
                            ${newManager ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">New Manager</td>
                                <td style="padding: 8px;">${newManager.name}</td>
                            </tr>
                            ` : ''}
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Effective Date</td>
                                <td style="padding: 8px;">${new Date(effectiveDate).toLocaleDateString()}</td>
                            </tr>
                        </table>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Please ensure a smooth transition of your responsibilities. Your new manager will contact you 
                            regarding your new role and responsibilities.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/profile"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               View Your Profile
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If you have any questions, please contact the HR department.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Best regards,<br>
                            HR Team<br>
                            Alkaa
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

// export const sendManagerAssignmentEmail = async (employeeEmail, employeeName, newManager, effectiveDate, companyName) => {
//     try {
//         const emailData = {
//             sender: {
//                 name: companyName,
//                 email: process.env.SENDER_EMAIL
//             },
//             to: [
//                 {
//                     email: employeeEmail,
//                     name: employeeName
//                 }
//             ],
//             cc: [
//                 {
//                     email: newManager.email,
//                     name: newManager.name
//                 }
//             ],
//             subject: `Manager Assignment Notification - ${employeeName}`,
//             htmlContent: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <h2 style="color: #2c3e50; text-align: center;">Manager Assignment Notification</h2>
//                     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Dear <strong>${employeeName}</strong>,
//                         </p>
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             This is to inform you that <strong>${newManager.name}</strong> has been assigned as your manager 
//                             effective from <strong>${new Date(effectiveDate).toLocaleDateString()}</strong>.
//                         </p>
                        
//                         <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">New Manager</td>
//                                 <td style="padding: 8px;">${newManager.name}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Manager Email</td>
//                                 <td style="padding: 8px;">${newManager.email}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Effective Date</td>
//                                 <td style="padding: 8px;">${new Date(effectiveDate).toLocaleDateString()}</td>
//                             </tr>
//                         </table>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Your manager will schedule an initial meeting to discuss your work responsibilities and expectations.
//                         </p>
                        
//                         <div style="text-align: center; margin: 30px 0;">
//                             <a href="${process.env.CLIENT_URL}/profile"
//                                style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
//                                View Your Profile
//                             </a>
//                         </div>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             If you have any questions, please contact the HR department.
//                         </p>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Best regards,<br>
//                             HR Team<br>
//                             ${companyName}
//                         </p>
//                     </div>
//                 </div>
//             `
//         };

//         return await sendBrevoEmail(emailData);
//     } catch (error) {
//         return error;
//     }
// };

// export const sendRoleChangeEmail = async (employeeEmail, employeeName, managerEmail, managerName, oldRoles, newRoles, effectiveDate, companyName) => {
//     try {
//         const emailData = {
//             sender: {
//                 name: companyName,
//                 email: process.env.SENDER_EMAIL
//             },
//             to: [
//                 {
//                     email: employeeEmail,
//                     name: employeeName
//                 }
//             ],
//             cc: [
//                 {
//                     email: managerEmail,
//                     name: managerName
//                 }
//             ],
//             subject: `Role/Permission Change Notification - ${employeeName}`,
//             htmlContent: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <h2 style="color: #2c3e50; text-align: center;">Role Change Notification</h2>
//                     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Dear <strong>${employeeName}</strong>,
//                         </p>
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             This is to inform you that your roles and permissions in the system have been updated 
//                             effective from <strong>${new Date(effectiveDate).toLocaleDateString()}</strong>.
//                         </p>
                        
//                         <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Previous Roles</td>
//                                 <td style="padding: 8px;">${oldRoles.join(', ')}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">New Roles</td>
//                                 <td style="padding: 8px;">${newRoles.join(', ')}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Effective Date</td>
//                                 <td style="padding: 8px;">${new Date(effectiveDate).toLocaleDateString()}</td>
//                             </tr>
//                         </table>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             This change may affect your access to certain features and functionalities in the system.
//                             If you notice any issues with your access, please contact your manager or the IT support team.
//                         </p>
                        
//                         <div style="text-align: center; margin: 30px 0;">
//                             <a href="${process.env.CLIENT_URL}/profile"
//                                style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
//                                View Your Profile
//                             </a>
//                         </div>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Best regards,<br>
//                             System Administration Team<br>
//                             ${companyName}
//                         </p>
//                     </div>
//                 </div>
//             `
//         };

//         return await sendBrevoEmail(emailData);
//     } catch (error) {
//         return error;
//     }
// };

// export const sendBillingAlertEmail = async (adminEmails, billingData, alertType, companyName) => {
//     try {
//         // Format recipients for bulk email
//         const recipients = adminEmails.map(email => ({ email, name: "Admin" }));
        
//         // Determine alert message and color based on type
//         let alertMessage = '';
//         let alertColor = '';
//         let subject = '';
        
//         switch (alertType) {
//             case 'renewal':
//                 subject = 'Subscription Renewal Reminder';
//                 alertMessage = `Your subscription plan will renew on ${new Date(billingData.renewalDate).toLocaleDateString()}.`;
//                 alertColor = '#007bff'; // Info blue
//                 break;
//             case 'payment_due':
//                 subject = 'Payment Due Reminder';
//                 alertMessage = `Your payment for the current billing cycle is due on ${new Date(billingData.dueDate).toLocaleDateString()}.`;
//                 alertColor = '#ffc107'; // Warning yellow
//                 break;
//             case 'payment_overdue':
//                 subject = 'Payment Overdue Alert';
//                 alertMessage = `Your payment is overdue by ${billingData.overdueBy} days. Please process the payment immediately to avoid service interruption.`;
//                 alertColor = '#dc3545'; // Danger red
//                 break;
//             case 'plan_change':
//                 subject = 'Subscription Plan Changed';
//                 alertMessage = `Your subscription plan has been changed from ${billingData.oldPlan} to ${billingData.newPlan}.`;
//                 alertColor = '#28a745'; // Success green
//                 break;
//             default:
//                 subject = 'Billing Alert';
//                 alertMessage = `There is an update regarding your subscription.`;
//                 alertColor = '#007bff'; // Info blue
//         }
        
//         const emailData = {
//             sender: {
//                 name: "Alkaa Billing",
//                 email: process.env.SENDER_EMAIL
//             },
//             to: recipients,
//             subject: `${subject} - ${companyName}`,
//             htmlContent: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <h2 style="color: ${alertColor}; text-align: center;">${subject}</h2>
//                     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Dear Administrator,
//                         </p>
//                         <p style="color: #636363; margin-bottom: 15px; font-weight: bold;">
//                             ${alertMessage}
//                         </p>
                        
//                         <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Organization</td>
//                                 <td style="padding: 8px;">${companyName}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Subscription Plan</td>
//                                 <td style="padding: 8px;">${billingData.planName}</td>
//                             </tr>
//                             ${billingData.amount ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Amount</td>
//                                 <td style="padding: 8px;">$${billingData.amount.toFixed(2)}</td>
//                             </tr>
//                             ` : ''}
//                             ${billingData.dueDate ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Due Date</td>
//                                 <td style="padding: 8px;">${new Date(billingData.dueDate).toLocaleDateString()}</td>
//                             </tr>
//                             ` : ''}
//                             ${billingData.renewalDate ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Renewal Date</td>
//                                 <td style="padding: 8px;">${new Date(billingData.renewalDate).toLocaleDateString()}</td>
//                             </tr>
//                             ` : ''}
//                         </table>
                        
//                         <div style="text-align: center; margin: 30px 0;">
//                             <a href="${process.env.ADMIN_URL || process.env.CLIENT_URL}/billing/manage"
//                                style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
//                                Manage Billing
//                             </a>
//                         </div>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             If you have any questions regarding your billing, please contact our support team.
//                         </p>
//                     </div>
//                 </div>
//             `
//         };

//         return await sendBrevoEmail(emailData);
//     } catch (error) {
//         return error;
//     }
// };

// export const sendPerformanceReviewEmail = async (employeeEmail, employeeName, managerEmail, managerName, reviewData, companyName) => {
//     try {
//         const emailData = {
//             sender: {
//                 name: companyName,
//                 email: process.env.SENDER_EMAIL
//             },
//             to: [
//                 {
//                     email: employeeEmail,
//                     name: employeeName
//                 }
//             ],
//             cc: [
//                 {
//                     email: managerEmail,
//                     name: managerName
//                 }
//             ],
//             subject: `Performance Review Notification - ${reviewData.cycle}`,
//             htmlContent: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <h2 style="color: #2c3e50; text-align: center;">Performance Review Notification</h2>
//                     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Dear <strong>${employeeName}</strong>,
//                         </p>
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             This is to inform you that the ${reviewData.cycle} performance review cycle has begun.
//                         </p>
                        
//                         <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Review Cycle</td>
//                                 <td style="padding: 8px;">${reviewData.cycle}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Self Assessment Due</td>
//                                 <td style="padding: 8px;">${new Date(reviewData.selfAssessmentDue).toLocaleDateString()}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Manager Review Due</td>
//                                 <td style="padding: 8px;">${new Date(reviewData.managerReviewDue).toLocaleDateString()}</td>
//                             </tr>
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Review Meeting</td>
//                                 <td style="padding: 8px;">${new Date(reviewData.reviewMeeting).toLocaleDateString()}</td>
//                             </tr>
//                         </table>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Please complete your self-assessment by the due date. Your manager will then provide their feedback
//                             and schedule a review discussion.
//                         </p>
                        
//                         <div style="text-align: center; margin: 30px 0;">
//                             <a href="${process.env.CLIENT_URL}/performance/review/${reviewData.id}"
//                                style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
//                                Start Self Assessment
//                             </a>
//                         </div>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             If you have any questions about the review process, please contact your manager or the HR department.
//                         </p>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Best regards,<br>
//                             HR Team<br>
//                             ${companyName}
//                         </p>
//                     </div>
//                 </div>
//             `
//         };

//         return await sendBrevoEmail(emailData);
//     } catch (error) {
//         return error;
//     }
// };

// export const sendAttendanceAnomalyEmail = async (employeeEmail, employeeName, managerEmail, managerName, anomalyData, companyName) => {
//     try {
//         // Determine the anomaly type message
//         let anomalyTitle = '';
//         let anomalyDescription = '';
        
//         switch (anomalyData.type) {
//             case 'consecutive_absences':
//                 anomalyTitle = 'Consecutive Absences Detected';
//                 anomalyDescription = `We've noticed you've been absent for ${anomalyData.count} consecutive working days.`;
//                 break;
//             case 'frequent_late':
//                 anomalyTitle = 'Frequent Late Arrivals';
//                 anomalyDescription = `We've noticed you've been late ${anomalyData.count} times in the past ${anomalyData.period} days.`;
//                 break;
//             case 'early_departure':
//                 anomalyTitle = 'Frequent Early Departures';
//                 anomalyDescription = `We've noticed you've left early ${anomalyData.count} times in the past ${anomalyData.period} days.`;
//                 break;
//             case 'missing_checkout':
//                 anomalyTitle = 'Missing Check-out Records';
//                 anomalyDescription = `We've noticed you have ${anomalyData.count} missing check-out records in the past ${anomalyData.period} days.`;
//                 break;
//             default:
//                 anomalyTitle = 'Attendance Anomaly Detected';
//                 anomalyDescription = 'We\'ve noticed an unusual pattern in your attendance records.';
//         }
        
//         const emailData = {
//             sender: {
//                 name: companyName,
//                 email: process.env.SENDER_EMAIL
//             },
//             to: [
//                 {
//                     email: employeeEmail,
//                     name: employeeName
//                 }
//             ],
//             cc: [
//                 {
//                     email: managerEmail,
//                     name: managerName
//                 }
//             ],
//             subject: `${anomalyTitle} - ${employeeName}`,
//             htmlContent: `
//                 <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//                     <h2 style="color: #dc3545; text-align: center;">${anomalyTitle}</h2>
//                     <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Dear <strong>${employeeName}</strong>,
//                         </p>
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             ${anomalyDescription}
//                         </p>
                        
//                         <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Period</td>
//                                 <td style="padding: 8px;">${anomalyData.startDate ? `${new Date(anomalyData.startDate).toLocaleDateString()} to ${new Date(anomalyData.endDate).toLocaleDateString()}` : `Past ${anomalyData.period} days`}</td>
//                             </tr>
//                             ${anomalyData.dates ? `
//                             <tr style="border-bottom: 1px solid #ddd;">
//                                 <td style="padding: 8px; font-weight: bold;">Dates Affected</td>
//                                 <td style="padding: 8px;">${anomalyData.dates.map(date => new Date(date).toLocaleDateString()).join(', ')}</td>
//                             </tr>
//                             ` : ''}
//                         </table>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             If there are legitimate reasons for these attendance patterns, please discuss this with your manager.
//                             Regular attendance and adherence to company working hours are important.
//                         </p>
                        
//                         <div style="text-align: center; margin: 30px 0;">
//                             <a href="${process.env.CLIENT_URL}/attendance/records"
//                                style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
//                                View Your Attendance Records
//                             </a>
//                         </div>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             If you believe there is an error in the attendance records, please contact the HR department.
//                         </p>
                        
//                         <p style="color: #636363; margin-bottom: 15px;">
//                             Best regards,<br>
//                             HR Team<br>
//                             ${companyName}
//                         </p>
//                     </div>
//                 </div>
//             `
//         };

//         return await sendBrevoEmail(emailData);
//     } catch (error) {
//         return error;
//     }
// };

export const sendEmailWithCustomContent = async (to, subject, htmlContent, companyName) => {
    try {
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: to,
                    name: "User"
                }
            ],
            subject: subject,
            htmlContent: htmlContent
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        return error;
    }
}

// Onboarding Email Functions
export const sendOnboardingInvitationEmail = async (email, firstName, onboardingUrl, companyName) => {
    try {
        console.log('=== SENDING ONBOARDING EMAIL ===');
        console.log('Email:', email);
        console.log('First Name:', firstName);
        console.log('Onboarding URL:', onboardingUrl);
        console.log('Company Name:', companyName);
        console.log('================================');
        
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [{
                email,
                name: firstName
            }],
            subject: `Welcome to Alkaa - Complete Your Onboarding`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #4CAF50, #FF9800); border-radius: 10px;">
                        <img src="https://www.alkaa.online/logo.svg" alt="Alkaa" style="height: 60px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Alkaa!</h1>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Hello ${firstName},
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            We're excited to have you join our team at Alkaa! To complete your onboarding process, 
                            please click the button below to provide some additional information we need to set up your account.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${onboardingUrl}"
                               style="background: linear-gradient(135deg, #4CAF50, #66BB6A); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                               Complete Your Onboarding
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            This link will expire in 7 days. If you have any questions, please contact your hiring manager.
                        </p>
                        
                        <p style="font-size: 12px; color: #636363;">
                            If you did not expect this email, please ignore it.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #8e8e93; font-size: 12px;">
                        <p style="margin: 0;">© 2024 Alkaa. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        console.error('Error sending onboarding invitation email:', error);
        return error;
    }
};

export const sendOnboardingChangeRequestEmail = async (email, firstName, onboardingUrl, feedback, companyName, managerName) => {
    try {
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [{
                email,
                name: firstName
            }],
            subject: `Action Required: Update Your Onboarding Information`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #4CAF50, #FF9800); border-radius: 10px;">
                        <img src="https://www.alkaa.online/logo.svg" alt="Alkaa" style="height: 60px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Onboarding Information Update</h1>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Hello ${firstName},
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Thank you for submitting your information. We need a few changes to complete your onboarding process. 
                            Please review the feedback below and update your information:
                        </p>
                        
                        <div style="background-color: #ffffff; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0;">
                            <p style="margin: 0; color: #636363;">
                                <strong>Feedback from ${managerName}:</strong><br>
                                ${feedback}
                            </p>
                        </div>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${onboardingUrl}"
                               style="background: linear-gradient(135deg, #4CAF50, #66BB6A); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                               Update Your Information
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            This link will expire in 7 days. If you have any questions, please contact your hiring manager.
                        </p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #8e8e93; font-size: 12px;">
                        <p style="margin: 0;">© 2024 Alkaa. All rights reserved.</p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        console.error('Error sending onboarding change request email:', error);
        return error;
    }
};

export const sendEmployeeWelcomeEmail = async (email, firstName, loginUrl, employeeId, companyName) => {
    try {
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [{
                email,
                name: firstName
            }],
            subject: `Welcome to Alkaa - Your Onboarding is Complete!`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #4CAF50, #FF9800); border-radius: 10px;">
                        <img src="https://www.alkaa.online/logo.svg" alt="Alkaa" style="height: 60px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to Alkaa!</h1>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${firstName}</strong>,
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Congratulations! Your onboarding process is complete, and your account has been set up in our HR system.
                        </p>
                        
                        <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
                            <p style="margin: 0; color: #636363;">
                                <strong>Your Employee ID:</strong> ${employeeId}<br>
                                <strong>Email:</strong> ${email}
                            </p>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            To get started, please set your password by clicking the button below:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${loginUrl}"
                               style="background: linear-gradient(135deg, #28a745, #66BB6A); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                               Set Your Password
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            After setting your password, you can log in to our HR portal at <a href="${process.env.CLIENT_URL}" style="color: #3498db; text-decoration: none;">${process.env.CLIENT_URL}</a> using your email and password.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            This link will expire in 24 hours for security reasons.
                        </p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        console.error('Error sending employee welcome email:', error);
        return error;
    }
};
export const sendEmployeeOnboardingSubmissionEmailToManager = async (email, firstName, managerEmail, managerName, companyName) => {
    try {
        const emailData = {
            sender: {
                name: "Alkaa",
                email: process.env.SENDER_EMAIL
            },
            to: [{
                email: managerEmail,
                name: managerName
            }],
            subject: `New Employee Onboarding Submission - ${firstName}`,
            htmlContent: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #4CAF50, #FF9800); border-radius: 10px;">
                        <img src="https://www.alkaa.online/logo.svg" alt="Alkaa" style="height: 60px; margin-bottom: 10px;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">New Employee Onboarding Submission</h1>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Hello ${managerName},
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            ${firstName} has completed their onboarding submission. Please review the information and take any necessary actions.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            You can view the submission details in the HR portal.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/p/onboarding"
                               style="background: linear-gradient(135deg, #4CAF50, #66BB6A); color: white; padding: 12px 25px; text-decoration: none; border-radius: 25px; display: inline-block; font-weight: bold;">
                               Review Onboarding Submission
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If you have any questions, please contact the HR department.
                        </p>
                    </div>
                </div>
            `
        };

        return await sendBrevoEmail(emailData);
    } catch (error) {
        console.error('Error sending onboarding submission email to manager:', error);
        return error;
    }
}