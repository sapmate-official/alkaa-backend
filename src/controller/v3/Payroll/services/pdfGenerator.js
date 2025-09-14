import PDFDocument from 'pdfkit';
import { formatCurrency } from '../utils/salaryCalculations.js';

export class PayslipPDFGenerator {
    /**
     * Generate payslip PDF
     */
    static async generatePayslipPDF(salaryRecord, res) {
        // Create a new PDF document
        const doc = new PDFDocument();

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payslip-${salaryRecord.month}-${salaryRecord.year}.pdf`);

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Generate PDF content
        this.addHeader(doc, salaryRecord);
        this.addEmployeeDetails(doc, salaryRecord);
        this.addSalaryDetails(doc, salaryRecord);
        this.addEarningsTable(doc, salaryRecord);
        this.addDeductionsTable(doc, salaryRecord);
        this.addNetSalary(doc, salaryRecord);
        this.addFooter(doc, salaryRecord);

        // Finalize the PDF and end the stream
        doc.end();
    }

    /**
     * Add header to PDF
     */
    static addHeader(doc, salaryRecord) {
        const monthName = new Date(salaryRecord.year, salaryRecord.month - 1, 1).toLocaleString('default', { month: 'long' });

        // Document Header
        doc.fontSize(20).text('PAYSLIP', { align: 'center' });
        doc.fontSize(14).text(`${monthName} ${salaryRecord.year}`, { align: 'center' });
        doc.moveDown();

        // Company details
        if (salaryRecord.user.organization) {
            doc.fontSize(12).text(salaryRecord.user.organization.name, { align: 'left' });
            if (salaryRecord.user.organization.address) {
                doc.fontSize(10).text(salaryRecord.user.organization.address, { align: 'left' });
            }
        }

        doc.moveDown();
    }

    /**
     * Add employee details section
     */
    static addEmployeeDetails(doc, salaryRecord) {
        doc.fontSize(14).text('Employee Details', { underline: true });
        doc.moveDown(0.5);

        const fullName = `${salaryRecord.user.firstName || ''} ${salaryRecord.user.lastName || ''}`.trim();
        doc.fontSize(10).text(`Name: ${fullName}`);
        doc.fontSize(10).text(`Employee ID: ${salaryRecord.user.employeeId || 'N/A'}`);
        doc.fontSize(10).text(`Department: ${salaryRecord.user.department?.name || 'N/A'}`);
        doc.fontSize(10).text(`Email: ${salaryRecord.user.email || 'N/A'}`);

        // Bank details
        if (salaryRecord.user.bankDetails) {
            doc.moveDown();
            doc.fontSize(12).text('Bank Details', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).text(`Bank Name: ${salaryRecord.user.bankDetails.bankName || 'N/A'}`);
            
            // Mask account number for security
            const accountNumber = salaryRecord.user.bankDetails.accountNumber;
            const maskedAccountNumber = accountNumber ? 
                `XXXX${accountNumber.slice(-4)}` : 'N/A';
            doc.fontSize(10).text(`Account Number: ${maskedAccountNumber}`);
            doc.fontSize(10).text(`IFSC Code: ${salaryRecord.user.bankDetails.ifscCode || 'N/A'}`);
        }

        doc.moveDown();
    }

    /**
     * Add salary details section
     */
    static addSalaryDetails(doc, salaryRecord) {
        doc.fontSize(14).text('Salary Details', { underline: true });
        doc.moveDown(0.5);

        // Payment information
        doc.fontSize(10).text(`Payment Status: ${salaryRecord.status}`);
        if (salaryRecord.processedAt) {
            doc.fontSize(10).text(`Payment Date: ${new Date(salaryRecord.processedAt).toLocaleDateString()}`);
        }
        if (salaryRecord.paymentMode) {
            doc.fontSize(10).text(`Payment Mode: ${salaryRecord.paymentMode}`);
        }
        if (salaryRecord.paymentRef) {
            doc.fontSize(10).text(`Payment Reference: ${salaryRecord.paymentRef}`);
        }

        doc.moveDown();
    }

    /**
     * Add earnings table
     */
    static addEarningsTable(doc, salaryRecord) {
        const allowances = salaryRecord.allowances || {};

        doc.fontSize(12).text('Earnings', { underline: true });
        doc.moveDown(0.5);

        // Set up table layout for earnings
        const earningsStartY = doc.y;
        doc.fontSize(10).text('Component', 50, earningsStartY);
        doc.fontSize(10).text('Amount', 250, earningsStartY, { align: 'right' });
        doc.moveDown();

        let earningsY = doc.y;
        doc.fontSize(10).text('Basic Salary', 50, earningsY);
        doc.fontSize(10).text(formatCurrency(salaryRecord.basicSalary), 250, earningsY, { align: 'right' });
        doc.moveDown();

        // List all allowances
        Object.entries(allowances).forEach(([key, value]) => {
            earningsY = doc.y;
            doc.fontSize(10).text(key.charAt(0).toUpperCase() + key.slice(1), 50, earningsY);
            doc.fontSize(10).text(formatCurrency(value), 250, earningsY, { align: 'right' });
            doc.moveDown();
        });

        // Add incentive and bonus if they exist
        if (salaryRecord.incentive) {
            earningsY = doc.y;
            doc.fontSize(10).text('Incentive', 50, earningsY);
            doc.fontSize(10).text(formatCurrency(salaryRecord.incentive), 250, earningsY, { align: 'right' });
            doc.moveDown();
        }

        if (salaryRecord.bonus) {
            earningsY = doc.y;
            doc.fontSize(10).text('Bonus', 50, earningsY);
            doc.fontSize(10).text(formatCurrency(salaryRecord.bonus), 250, earningsY, { align: 'right' });
            doc.moveDown();
        }

        // Total earnings
        const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        const totalEarnings = salaryRecord.basicSalary + totalAllowances + (salaryRecord.incentive || 0) + (salaryRecord.bonus || 0);
        
        doc.moveDown(0.5);
        earningsY = doc.y;
        doc.fontSize(10).text('Total Earnings', 50, earningsY, { font: 'Helvetica-Bold' });
        doc.fontSize(10).text(formatCurrency(totalEarnings), 250, earningsY, { align: 'right', font: 'Helvetica-Bold' });
        doc.moveDown();
    }

    /**
     * Add deductions table
     */
    static addDeductionsTable(doc, salaryRecord) {
        const deductions = salaryRecord.deductions || {};

        // Check if we need a new page for deductions
        if (doc.y > 700) {
            doc.addPage();
        } else {
            doc.moveDown();
        }

        doc.fontSize(12).text('Deductions', { underline: true });
        doc.moveDown(0.5);

        // Set up table layout for deductions
        const deductionsStartY = doc.y;
        doc.fontSize(10).text('Component', 50, deductionsStartY);
        doc.fontSize(10).text('Amount', 250, deductionsStartY, { align: 'right' });
        doc.moveDown();

        // List all deductions
        let deductionsY = doc.y;
        Object.entries(deductions).forEach(([key, value]) => {
            deductionsY = doc.y;
            doc.fontSize(10).text(key.charAt(0).toUpperCase() + key.slice(1), 50, deductionsY);
            doc.fontSize(10).text(formatCurrency(value), 250, deductionsY, { align: 'right' });
            doc.moveDown();
        });

        // Tax amount
        if (salaryRecord.tax) {
            deductionsY = doc.y;
            doc.fontSize(10).text('Tax', 50, deductionsY);
            doc.fontSize(10).text(formatCurrency(salaryRecord.tax), 250, deductionsY, { align: 'right' });
            doc.moveDown();
        }

        // Total deductions
        const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        
        doc.moveDown(0.5);
        deductionsY = doc.y;
        doc.fontSize(10).text('Total Deductions', 50, deductionsY, { font: 'Helvetica-Bold' });
        doc.fontSize(10).text(formatCurrency(totalDeductions + (salaryRecord.tax || 0)), 250, deductionsY, { align: 'right', font: 'Helvetica-Bold' });
        doc.moveDown();
    }

    /**
     * Add net salary section
     */
    static addNetSalary(doc, salaryRecord) {
        doc.moveDown();
        const netSalaryY = doc.y;
        doc.fontSize(12).text('Net Salary', 50, netSalaryY, { font: 'Helvetica-Bold' });
        doc.fontSize(12).text(formatCurrency(salaryRecord.netSalary), 250, netSalaryY, { align: 'right', font: 'Helvetica-Bold' });

        // Remarks
        if (salaryRecord.remarks) {
            doc.moveDown(2);
            doc.fontSize(10).text('Remarks:', { font: 'Helvetica-Bold' });
            doc.fontSize(10).text(salaryRecord.remarks);
        }
    }

    /**
     * Add footer
     */
    static addFooter(doc, salaryRecord) {
        doc.moveDown(2);
        doc.fontSize(8).text('This is a computer-generated document. No signature is required.', { align: 'center' });
        doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
    }
}
