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

    export const sendLeaveRequestEmail = async (managerEmail, adminEmail, employeeName, employeeEmail, leaveData, companyName) => {
    try {
        // managerEmail = "parambrataghosh26@gmail.com"

        
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
            subject: `Leave Request from ${employeeName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Leave Request</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            <strong>${employeeName}</strong> has submitted a leave request for your approval.
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
                               style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
                               Approve
                            </a>
                            <a href="${process.env.CLIENT_URL}/p/leaverequest/approve"
                               style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Reject
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            Please review and respond to this leave request at your earliest convenience.
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Checkout Reminder</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Hello <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            Our records show that you checked in at <strong>${new Date(checkInTime).toLocaleTimeString()}</strong> today 
                            but haven't checked out yet. It has been more than 8 hours since your check-in.
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Attendance Verification Required</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Leave Request Update</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Salary Notification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            Your salary for ${new Date(salaryData.year, salaryData.month - 1).toLocaleDateString('default', { month: 'long', year: 'numeric' })} has been processed.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Basic Salary</td>
                                <td style="padding: 8px; text-align: right;">${salaryData.currency || '$'}${salaryData.basicSalary.toFixed(2)}</td>
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
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            <strong>Payment Method:</strong> ${salaryData.paymentMode || 'Bank Transfer'}
                        </p>
                        ${salaryData.paymentRef ? `
                        <p style="color: #636363; margin-bottom: 15px;">
                            <strong>Payment Reference:</strong> ${salaryData.paymentRef}
                        </p>
                        ` : ''}
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/payslip/${salaryData.id}"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               View Detailed Payslip
                            </a>
                        </div>
                        
                        <p style="font-size: 12px; color: #636363;">
                            For any queries regarding your salary, please contact the HR department.
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

export const sendNewEmployeeWelcomeEmail = async (employeeEmail, employeeName, managerEmail, managerName, departmentHead, teamMembers, employeeDetails, companyName) => {
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
            cc: [
                {
                    email: managerEmail,
                    name: managerName
                },
                ...(departmentHead ? [{
                    email: departmentHead.email,
                    name: departmentHead.name
                }] : [])
            ],
            subject: `Welcome to ${companyName}!`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Welcome to ${companyName}!</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            We are delighted to welcome you to ${companyName}! We are excited to have you join our team 
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
                            ${companyName}
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

export const sendSecurityAlertEmail = async (email, alertType, details, ipAddress, deviceInfo, companyName) => {
    try {
        let subject = '';
        let actionText = '';
        let actionDescription = '';
        let alertColor = '';
        
        switch (alertType) {
            case 'password_reset':
                subject = 'Password Reset Requested';
                actionText = 'Reset Password';
                actionDescription = 'A password reset was requested for your account.';
                alertColor = '#ffc107'; // Warning yellow
                break;
            case 'suspicious_login':
                subject = 'Suspicious Login Detected';
                actionText = 'Secure Account';
                actionDescription = 'We detected a suspicious login attempt on your account.';
                alertColor = '#dc3545'; // Danger red
                break;
            case 'account_locked':
                subject = 'Account Temporarily Locked';
                actionText = 'Unlock Account';
                actionDescription = 'Your account has been temporarily locked due to multiple failed login attempts.';
                alertColor = '#dc3545'; // Danger red
                break;
            default:
                subject = 'Security Alert';
                actionText = 'Review Account';
                actionDescription = 'A security event was detected on your account.';
                alertColor = '#ffc107'; // Warning yellow
        }
        
        const emailData = {
            sender: {
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: [
                {
                    email: email,
                    name: "User"
                }
            ],
            subject: `${subject} - ${companyName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: ${alertColor}; text-align: center;">${subject}</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            <strong>${actionDescription}</strong>
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Time</td>
                                <td style="padding: 8px;">${new Date().toLocaleString()}</td>
                            </tr>
                            ${ipAddress ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">IP Address</td>
                                <td style="padding: 8px;">${ipAddress}</td>
                            </tr>
                            ` : ''}
                            ${deviceInfo ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Device</td>
                                <td style="padding: 8px;">${deviceInfo}</td>
                            </tr>
                            ` : ''}
                            ${details ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Details</td>
                                <td style="padding: 8px;">${details}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/security/account"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               ${actionText}
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If this was not you, please contact our support team immediately or change your password.
                        </p>
                        
                        <p style="font-size: 12px; color: #636363;">
                            This is an automated security alert. Please do not reply to this email.
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
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Holiday Announcement</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
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
                            ${companyName}
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
                name: companyName,
                email: process.env.SENDER_EMAIL
            },
            to: recipients,
            cc: cc,
            subject: `Department Change Notification - ${employeeName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Department Change Notification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
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
                            ${companyName}
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

export const sendManagerAssignmentEmail = async (employeeEmail, employeeName, newManager, effectiveDate, companyName) => {
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
            cc: [
                {
                    email: newManager.email,
                    name: newManager.name
                }
            ],
            subject: `Manager Assignment Notification - ${employeeName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Manager Assignment Notification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            This is to inform you that <strong>${newManager.name}</strong> has been assigned as your manager 
                            effective from <strong>${new Date(effectiveDate).toLocaleDateString()}</strong>.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">New Manager</td>
                                <td style="padding: 8px;">${newManager.name}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Manager Email</td>
                                <td style="padding: 8px;">${newManager.email}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Effective Date</td>
                                <td style="padding: 8px;">${new Date(effectiveDate).toLocaleDateString()}</td>
                            </tr>
                        </table>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Your manager will schedule an initial meeting to discuss your work responsibilities and expectations.
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
                            ${companyName}
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

export const sendRoleChangeEmail = async (employeeEmail, employeeName, managerEmail, managerName, oldRoles, newRoles, effectiveDate, companyName) => {
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
            cc: [
                {
                    email: managerEmail,
                    name: managerName
                }
            ],
            subject: `Role/Permission Change Notification - ${employeeName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Role Change Notification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            This is to inform you that your roles and permissions in the system have been updated 
                            effective from <strong>${new Date(effectiveDate).toLocaleDateString()}</strong>.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Previous Roles</td>
                                <td style="padding: 8px;">${oldRoles.join(', ')}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">New Roles</td>
                                <td style="padding: 8px;">${newRoles.join(', ')}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Effective Date</td>
                                <td style="padding: 8px;">${new Date(effectiveDate).toLocaleDateString()}</td>
                            </tr>
                        </table>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            This change may affect your access to certain features and functionalities in the system.
                            If you notice any issues with your access, please contact your manager or the IT support team.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/profile"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               View Your Profile
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Best regards,<br>
                            System Administration Team<br>
                            ${companyName}
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

export const sendBillingAlertEmail = async (adminEmails, billingData, alertType, companyName) => {
    try {
        // Format recipients for bulk email
        const recipients = adminEmails.map(email => ({ email, name: "Admin" }));
        
        // Determine alert message and color based on type
        let alertMessage = '';
        let alertColor = '';
        let subject = '';
        
        switch (alertType) {
            case 'renewal':
                subject = 'Subscription Renewal Reminder';
                alertMessage = `Your subscription plan will renew on ${new Date(billingData.renewalDate).toLocaleDateString()}.`;
                alertColor = '#007bff'; // Info blue
                break;
            case 'payment_due':
                subject = 'Payment Due Reminder';
                alertMessage = `Your payment for the current billing cycle is due on ${new Date(billingData.dueDate).toLocaleDateString()}.`;
                alertColor = '#ffc107'; // Warning yellow
                break;
            case 'payment_overdue':
                subject = 'Payment Overdue Alert';
                alertMessage = `Your payment is overdue by ${billingData.overdueBy} days. Please process the payment immediately to avoid service interruption.`;
                alertColor = '#dc3545'; // Danger red
                break;
            case 'plan_change':
                subject = 'Subscription Plan Changed';
                alertMessage = `Your subscription plan has been changed from ${billingData.oldPlan} to ${billingData.newPlan}.`;
                alertColor = '#28a745'; // Success green
                break;
            default:
                subject = 'Billing Alert';
                alertMessage = `There is an update regarding your subscription.`;
                alertColor = '#007bff'; // Info blue
        }
        
        const emailData = {
            sender: {
                name: "Alkaa Billing",
                email: process.env.SENDER_EMAIL
            },
            to: recipients,
            subject: `${subject} - ${companyName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: ${alertColor}; text-align: center;">${subject}</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear Administrator,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px; font-weight: bold;">
                            ${alertMessage}
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Organization</td>
                                <td style="padding: 8px;">${companyName}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Subscription Plan</td>
                                <td style="padding: 8px;">${billingData.planName}</td>
                            </tr>
                            ${billingData.amount ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Amount</td>
                                <td style="padding: 8px;">$${billingData.amount.toFixed(2)}</td>
                            </tr>
                            ` : ''}
                            ${billingData.dueDate ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Due Date</td>
                                <td style="padding: 8px;">${new Date(billingData.dueDate).toLocaleDateString()}</td>
                            </tr>
                            ` : ''}
                            ${billingData.renewalDate ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Renewal Date</td>
                                <td style="padding: 8px;">${new Date(billingData.renewalDate).toLocaleDateString()}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.ADMIN_URL || process.env.CLIENT_URL}/billing/manage"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Manage Billing
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If you have any questions regarding your billing, please contact our support team.
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

export const sendPerformanceReviewEmail = async (employeeEmail, employeeName, managerEmail, managerName, reviewData, companyName) => {
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
            cc: [
                {
                    email: managerEmail,
                    name: managerName
                }
            ],
            subject: `Performance Review Notification - ${reviewData.cycle}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2c3e50; text-align: center;">Performance Review Notification</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            This is to inform you that the ${reviewData.cycle} performance review cycle has begun.
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Review Cycle</td>
                                <td style="padding: 8px;">${reviewData.cycle}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Self Assessment Due</td>
                                <td style="padding: 8px;">${new Date(reviewData.selfAssessmentDue).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Manager Review Due</td>
                                <td style="padding: 8px;">${new Date(reviewData.managerReviewDue).toLocaleDateString()}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Review Meeting</td>
                                <td style="padding: 8px;">${new Date(reviewData.reviewMeeting).toLocaleDateString()}</td>
                            </tr>
                        </table>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Please complete your self-assessment by the due date. Your manager will then provide their feedback
                            and schedule a review discussion.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/performance/review/${reviewData.id}"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               Start Self Assessment
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If you have any questions about the review process, please contact your manager or the HR department.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Best regards,<br>
                            HR Team<br>
                            ${companyName}
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

export const sendAttendanceAnomalyEmail = async (employeeEmail, employeeName, managerEmail, managerName, anomalyData, companyName) => {
    try {
        // Determine the anomaly type message
        let anomalyTitle = '';
        let anomalyDescription = '';
        
        switch (anomalyData.type) {
            case 'consecutive_absences':
                anomalyTitle = 'Consecutive Absences Detected';
                anomalyDescription = `We've noticed you've been absent for ${anomalyData.count} consecutive working days.`;
                break;
            case 'frequent_late':
                anomalyTitle = 'Frequent Late Arrivals';
                anomalyDescription = `We've noticed you've been late ${anomalyData.count} times in the past ${anomalyData.period} days.`;
                break;
            case 'early_departure':
                anomalyTitle = 'Frequent Early Departures';
                anomalyDescription = `We've noticed you've left early ${anomalyData.count} times in the past ${anomalyData.period} days.`;
                break;
            case 'missing_checkout':
                anomalyTitle = 'Missing Check-out Records';
                anomalyDescription = `We've noticed you have ${anomalyData.count} missing check-out records in the past ${anomalyData.period} days.`;
                break;
            default:
                anomalyTitle = 'Attendance Anomaly Detected';
                anomalyDescription = 'We\'ve noticed an unusual pattern in your attendance records.';
        }
        
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
            cc: [
                {
                    email: managerEmail,
                    name: managerName
                }
            ],
            subject: `${anomalyTitle} - ${employeeName}`,
            htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #dc3545; text-align: center;">${anomalyTitle}</h2>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #636363; margin-bottom: 15px;">
                            Dear <strong>${employeeName}</strong>,
                        </p>
                        <p style="color: #636363; margin-bottom: 15px;">
                            ${anomalyDescription}
                        </p>
                        
                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Period</td>
                                <td style="padding: 8px;">${anomalyData.startDate ? `${new Date(anomalyData.startDate).toLocaleDateString()} to ${new Date(anomalyData.endDate).toLocaleDateString()}` : `Past ${anomalyData.period} days`}</td>
                            </tr>
                            ${anomalyData.dates ? `
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 8px; font-weight: bold;">Dates Affected</td>
                                <td style="padding: 8px;">${anomalyData.dates.map(date => new Date(date).toLocaleDateString()).join(', ')}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If there are legitimate reasons for these attendance patterns, please discuss this with your manager.
                            Regular attendance and adherence to company working hours are important.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.CLIENT_URL}/attendance/records"
                               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">
                               View Your Attendance Records
                            </a>
                        </div>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            If you believe there is an error in the attendance records, please contact the HR department.
                        </p>
                        
                        <p style="color: #636363; margin-bottom: 15px;">
                            Best regards,<br>
                            HR Team<br>
                            ${companyName}
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