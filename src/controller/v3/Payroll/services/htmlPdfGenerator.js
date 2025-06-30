import puppeteer from 'puppeteer';
import { formatCurrency } from '../utils/salaryCalculations.js';
import { PDFConfig } from '../config/pdfConfig.js';

export class HTMLPayslipPDFGenerator {
    /**
     * Generate payslip PDF using HTML template approach
     */
    static async generatePayslipPDF(salaryRecord, res) {
        try {
            // Set response headers
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=payslip-${salaryRecord.month}-${salaryRecord.year}.pdf`);

            // Generate HTML content
            const htmlContent = this.generateHTMLTemplate(salaryRecord);

            // Generate PDF from HTML
            const pdfBuffer = await this.generatePDFFromHTML(htmlContent);

            // Send PDF buffer to response
            res.send(pdfBuffer);

        } catch (error) {
            console.error('Error generating HTML payslip PDF:', error);
            throw error;
        }
    }

    /**
     * Generate HTML template for payslip
     */
    static generateHTMLTemplate(salaryRecord) {
        const monthName = new Date(salaryRecord.year, salaryRecord.month - 1, 1).toLocaleString('default', { month: 'long' });
        const fullName = `${salaryRecord.user.firstName || ''} ${salaryRecord.user.lastName || ''}`.trim();
        
        // Parse allowances and deductions
        const allowances = salaryRecord.allowances || {};
        const deductions = salaryRecord.deductions || {};
        
        // Calculate totals
        const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        const grossPay = salaryRecord.basicSalary + totalAllowances + (salaryRecord.incentive || 0) + (salaryRecord.bonus || 0);

        // Format date
        const payDate = salaryRecord.processedAt ? new Date(salaryRecord.processedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
        const period = `M${salaryRecord.month.toString().padStart(2, '0')}${salaryRecord.year}`;

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payslip - ${fullName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
        }
        
        .container {
            width: 595px;
            margin: 0 auto;
            padding: 40px;
            background: white;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 15px;
        }
        
        .company-info h1 {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 5px;
            color: #1f2937;
        }
        
        .company-info p {
            font-size: 10px;
            margin: 2px 0;
            color: #6b7280;
        }
        
        .payslip-title {
            text-align: right;
        }
        
        .payslip-title h2 {
            font-size: 16px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 5px;
        }
        
        .payslip-title p {
            font-size: 12px;
            color: #6b7280;
        }
        
        .employee-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
            padding: 15px;
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
            border-radius: 8px;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #1f2937;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 5px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 10px;
        }
        
        .info-label {
            font-weight: 600;
            color: #374151;
        }
        
        .info-value {
            color: #6b7280;
        }
        
        .pay-info {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            padding: 10px;
            background: #f9fafb;
            border-radius: 6px;
            font-size: 10px;
        }
        
        .pay-info-item {
            text-align: center;
        }
        
        .pay-info-label {
            font-weight: 600;
            color: #374151;
            margin-bottom: 2px;
        }
        
        .pay-info-value {
            color: #6b7280;
        }
        
        .table-section {
            margin-bottom: 20px;
        }
        
        .table-title {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
            padding: 8px 12px;
            font-size: 14px;
            font-weight: 600;
            color: #1f2937;
            border: 1px solid #d1d5db;
            border-bottom: none;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            border: 1px solid #d1d5db;
        }
        
        th, td {
            padding: 8px 6px;
            text-align: center;
            vertical-align: middle;
            border: 1px solid #d1d5db;
        }
        
        th {
            background-color: #f3f4f6;
            font-weight: 600;
            color: #374151;
        }
        
        .earnings-table tbody tr:nth-child(even) {
            background-color: #f9fafb;
        }
        
        .deductions-table tbody tr:nth-child(even) {
            background-color: #fef2f2;
        }
        
        .total-row {
            background-color: #e5e7eb !important;
            font-weight: 600;
            color: #1f2937;
        }
        
        .net-pay {
            text-align: center;
            padding: 15px;
            font-size: 16px;
            font-weight: 700;
            background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%);
            border: 2px solid #10b981;
            border-radius: 8px;
            color: #047857;
            margin-bottom: 20px;
        }
        
        .footer {
            text-align: center;
            font-size: 9px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            margin-top: 20px;
        }
        
        .footer p {
            margin: 5px 0;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            
            .container {
                width: 100%;
                margin: 0;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header Section -->
        <div class="header">
            <div class="company-info">
                <h1>${salaryRecord.user.organization?.name || 'Company Name'}</h1>
                <p>${salaryRecord.user.organization?.address || 'Company Address'}</p>
                <p>Email: ${salaryRecord.user.organization?.email || 'hr@company.com'}</p>
            </div>
            <div class="payslip-title">
                <h2>PAYSLIP</h2>
                <p>${monthName} ${salaryRecord.year}</p>
            </div>
        </div>

        <!-- Employee Information Section -->
        <div class="employee-section">
            <div class="employee-details">
                <div class="section-title">Employee Information</div>
                <div class="info-row">
                    <span class="info-label">Full Name:</span>
                    <span class="info-value">${fullName}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Employee ID:</span>
                    <span class="info-value">${salaryRecord.user.employeeId || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Department:</span>
                    <span class="info-value">${salaryRecord.user.department?.name || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Email:</span>
                    <span class="info-value">${salaryRecord.user.email || 'N/A'}</span>
                </div>
                ${salaryRecord.user.bankDetails ? `
                <div class="info-row">
                    <span class="info-label">Bank:</span>
                    <span class="info-value">${salaryRecord.user.bankDetails.bankName || 'N/A'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Account:</span>
                    <span class="info-value">****${(salaryRecord.user.bankDetails.accountNumber || '').slice(-4)}</span>
                </div>
                ` : ''}
            </div>
            <div class="payment-details">
                <div class="section-title">Payment Information</div>
                <div class="pay-info">
                    <div class="pay-info-item">
                        <div class="pay-info-label">Pay Date</div>
                        <div class="pay-info-value">${payDate}</div>
                    </div>
                    <div class="pay-info-item">
                        <div class="pay-info-label">Pay Type</div>
                        <div class="pay-info-value">Monthly</div>
                    </div>
                    <div class="pay-info-item">
                        <div class="pay-info-label">Period</div>
                        <div class="pay-info-value">${period}</div>
                    </div>
                </div>
                <div class="info-row" style="margin-top: 10px;">
                    <span class="info-label">Payment Status:</span>
                    <span class="info-value">${salaryRecord.status}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Payment Mode:</span>
                    <span class="info-value">${salaryRecord.paymentMode || 'MANUAL'}</span>
                </div>
                ${salaryRecord.paymentRef ? `
                <div class="info-row">
                    <span class="info-label">Payment Ref:</span>
                    <span class="info-value">${salaryRecord.paymentRef}</span>
                </div>
                ` : ''}
            </div>
        </div>

        <!-- Earnings Section -->
        <div class="table-section">
            <div class="table-title">Earnings</div>
            <table class="earnings-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Current (₹)</th>
                        <th>YTD (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Basic Salary</td>
                        <td>${formatCurrency(salaryRecord.basicSalary)}</td>
                        <td>${formatCurrency(salaryRecord.basicSalary * salaryRecord.month)}</td>
                    </tr>
                    ${Object.entries(allowances).map(([key, value]) => `
                    <tr>
                        <td>${key.toUpperCase()}</td>
                        <td>${formatCurrency(parseFloat(value) || 0)}</td>
                        <td>${formatCurrency((parseFloat(value) || 0) * salaryRecord.month)}</td>
                    </tr>
                    `).join('')}
                    ${salaryRecord.incentive ? `
                    <tr>
                        <td>Incentive</td>
                        <td>${formatCurrency(salaryRecord.incentive)}</td>
                        <td>${formatCurrency(salaryRecord.incentive * salaryRecord.month)}</td>
                    </tr>
                    ` : ''}
                    ${salaryRecord.bonus ? `
                    <tr>
                        <td>Bonus</td>
                        <td>${formatCurrency(salaryRecord.bonus)}</td>
                        <td>${formatCurrency(salaryRecord.bonus * salaryRecord.month)}</td>
                    </tr>
                    ` : ''}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td>Gross Pay</td>
                        <td>${formatCurrency(grossPay)}</td>
                        <td>${formatCurrency(grossPay * salaryRecord.month)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- Deductions Section -->
        <div class="table-section">
            <div class="table-title">Deductions</div>
            <table class="deductions-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Current (₹)</th>
                        <th>YTD (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(deductions).map(([key, value]) => `
                    <tr>
                        <td>${key.toUpperCase()}</td>
                        <td>${formatCurrency(parseFloat(value) || 0)}</td>
                        <td>${formatCurrency((parseFloat(value) || 0) * salaryRecord.month)}</td>
                    </tr>
                    `).join('')}
                    ${salaryRecord.tax ? `
                    <tr>
                        <td>Tax</td>
                        <td>${formatCurrency(salaryRecord.tax)}</td>
                        <td>${formatCurrency(salaryRecord.tax * salaryRecord.month)}</td>
                    </tr>
                    ` : ''}
                </tbody>
                <tfoot>
                    <tr class="total-row">
                        <td>Total Deductions</td>
                        <td>${formatCurrency(totalDeductions + (salaryRecord.tax || 0))}</td>
                        <td>${formatCurrency((totalDeductions + (salaryRecord.tax || 0)) * salaryRecord.month)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <!-- Net Pay Section -->
        <div class="net-pay">
            Net Pay: ${formatCurrency(salaryRecord.netSalary)} 
            (YTD: ${formatCurrency(salaryRecord.netSalary * salaryRecord.month)})
        </div>

        <!-- Footer Section -->
        <div class="footer">
            <p>If you have any questions about this payslip, please contact HR.</p>
            <p>Payslip generated on ${payDate} by ${salaryRecord.user.organization?.name || 'Company'}</p>
            <p>This is a computer-generated document and does not require a signature.</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * Generate PDF from HTML using Puppeteer
     */
    static async generatePDFFromHTML(htmlContent) {
        let browser;
        try {
            // Launch Puppeteer browser with configuration
            browser = await puppeteer.launch(PDFConfig.puppeteer);

            const page = await browser.newPage();

            // Set content and wait for it to load
            await page.setContent(htmlContent, {
                waitUntil: 'networkidle0'
            });

            // Generate PDF with configuration
            const pdfBuffer = await page.pdf(PDFConfig.pdfOptions);

            return pdfBuffer;

        } catch (error) {
            console.error('Error generating PDF with Puppeteer:', error);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }

    /**
     * Alternative method using html-pdf library (lighter weight)
     */
    static async generatePDFFromHTMLAlternative(htmlContent) {
        const pdf = require('html-pdf');
        
        return new Promise((resolve, reject) => {
            pdf.create(htmlContent, PDFConfig.htmlPdf).toBuffer((err, buffer) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buffer);
                }
            });
        });
    }
}
