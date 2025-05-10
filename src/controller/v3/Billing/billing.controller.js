import prisma from "../../../db/connectDb.js";
import PDFDocument from "pdfkit";

/**
 * Get billing dashboard statistics for the client
 */
export const getBillingDashboard = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Get user's organization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { orgId: true }
        });
        
        if (!user?.orgId) {
            return res.status(404).json({ 
                success: false, 
                message: "Organization not found for this user" 
            });
        }
        
        // Get organization's billing records
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        // Get billing statistics
        const allBills = await prisma.billingRecord.findMany({
            where: { organizationId: user.orgId },
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ]
        });
        
        // Get current year bills
        const currentYearBills = allBills.filter(bill => bill.year === currentYear);
        
        // Get latest bill
        const latestBill = allBills[0] || null;
        
        // Calculate total billed this year
        const totalBilledThisYear = currentYearBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        
        // Calculate unpaid amount
        const unpaidBills = allBills.filter(bill => bill.status === 'UNPAID' || bill.status === 'OVERDUE');
        const totalUnpaid = unpaidBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        
        // Get organization details
        const organization = await prisma.organization.findUnique({
            where: { id: user.orgId },
            select: {
                name: true,
                subscriptionPlan: true,
                subscriptionStart: true,
                subscriptionEnd: true,
                _count: {
                    select: { users: true }
                }
            }
        });
        
        // Calculate subscription metrics
        const subscriptionEnd = organization.subscriptionEnd;
        const daysRemaining = subscriptionEnd ? 
            Math.ceil((new Date(subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24)) : 
            null;
        
        const subscriptionStatus = !subscriptionEnd ? 'No End Date' :
                                  daysRemaining < 0 ? 'Expired' : 
                                  daysRemaining < 7 ? 'Expiring Soon' : 
                                  'Active';
        
        // Format response
        const response = {
            organization: {
                name: organization.name,
                subscriptionPlan: organization.subscriptionPlan,
                activeUsers: organization._count.users,
                subscriptionStart: organization.subscriptionStart,
                subscriptionEnd: organization.subscriptionEnd,
                daysRemaining,
                subscriptionStatus
            },
            billing: {
                latestBill,
                totalBilledThisYear,
                totalUnpaid,
                unpaidCount: unpaidBills.length
            },
            billStatus: {
                unpaid: allBills.filter(bill => bill.status === 'UNPAID').length,
                paid: allBills.filter(bill => bill.status === 'PAID').length,
                overdue: allBills.filter(bill => bill.status === 'OVERDUE').length,
                total: allBills.length
            },
            recentBills: allBills.slice(0, 3) // Get 3 most recent bills
        };
        
        res.status(200).json({
            success: true,
            data: response
        });
    } catch (error) {
        console.error("Error in getBillingDashboard:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve billing dashboard",
            error: error.message
        });
    }
};

/**
 * Get bill history with optional filters
 */
export const getBillHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, year, page = 1, limit = 10, sort = 'desc' } = req.query;
        
        // Get user's organization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { orgId: true }
        });
        
        if (!user?.orgId) {
            return res.status(404).json({ 
                success: false, 
                message: "Organization not found for this user" 
            });
        }
        
        // Build filter
        const filter = { organizationId: user.orgId };
        if (status) filter.status = status.toUpperCase();
        if (year) filter.year = parseInt(year);
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get bill count
        const totalBills = await prisma.billingRecord.count({
            where: filter
        });
        
        // Get bills
        const bills = await prisma.billingRecord.findMany({
            where: filter,
            orderBy: [
                { year: sort === 'desc' ? 'desc' : 'asc' },
                { month: sort === 'desc' ? 'desc' : 'asc' }
            ],
            skip,
            take: parseInt(limit)
        });
        
        // Add month name to each bill
        const billsWithMonthName = bills.map(bill => ({
            ...bill,
            monthName: new Date(bill.year, bill.month - 1).toLocaleString('default', { month: 'long' })
        }));
        
        res.status(200).json({
            success: true,
            data: billsWithMonthName,
            pagination: {
                total: totalBills,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalBills / parseInt(limit))
            }
        });
    } catch (error) {
        console.error("Error in getBillHistory:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve bill history",
            error: error.message
        });
    }
};

/**
 * Get specific bill details
 */
export const getBillDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: billId } = req.params;
        
        // Get user's organization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { orgId: true }
        });
        
        if (!user?.orgId) {
            return res.status(404).json({ 
                success: false, 
                message: "Organization not found for this user" 
            });
        }
        
        // Get bill details
        const bill = await prisma.billingRecord.findFirst({
            where: {
                id: billId,
                organizationId: user.orgId
            },
            include: {
                organization: {
                    select: {
                        name: true,
                        subscriptionPlan: true,
                        logo: true
                    }
                }
            }
        });
        
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found or you don't have access to this bill"
            });
        }
        
        // Format bill with month name
        const formattedBill = {
            ...bill,
            organizationName: bill.organization.name,
            organizationLogo: bill.organization.logo,
            subscriptionPlan: bill.organization.subscriptionPlan,
            monthName: new Date(bill.year, bill.month - 1).toLocaleString('default', { month: 'long' }),
            organization: undefined // Remove nested organization object
        };
        
        res.status(200).json({
            success: true,
            data: formattedBill
        });
    } catch (error) {
        console.error("Error in getBillDetails:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve bill details",
            error: error.message
        });
    }
};

/**
 * Mark bill as paid (records payment intention)
 */
export const markBillAsPaid = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: billId } = req.params;
        const { paymentMethod, paymentReference } = req.body;
        
        if (!paymentMethod) {
            return res.status(400).json({
                success: false,
                message: "Payment method is required"
            });
        }
        
        // Get user's organization
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { orgId: true }
        });
        
        if (!user?.orgId) {
            return res.status(404).json({ 
                success: false, 
                message: "Organization not found for this user" 
            });
        }
        
        // Get bill
        const bill = await prisma.billingRecord.findFirst({
            where: {
                id: billId,
                organizationId: user.orgId
            }
        });
        
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found or you don't have access to this bill"
            });
        }
        
        if (bill.status === 'PAID') {
            return res.status(400).json({
                success: false,
                message: "This bill is already paid"
            });
        }
        
        // Update bill status
        const updatedBill = await prisma.billingRecord.update({
            where: { id: billId },
            data: {
                status: 'PAID',
                paidDate: new Date(),
                paymentReference: paymentReference || `${paymentMethod}-${Date.now()}`
            }
        });
        
        // Create notification for super admin (optional)
        try {
            await prisma.backgroundJob.create({
                data: {
                    type: 'NOTIFICATION_DISPATCH',
                    status: 'PENDING',
                    scheduledFor: new Date(),
                    priority: 2,
                    payload: {
                        type: 'BILLING_PAYMENT',
                        organizationId: user.orgId,
                        billId: billId,
                        amount: bill.totalAmount,
                        paymentMethod,
                        paymentReference: updatedBill.paymentReference
                    }
                }
            });
        } catch (notificationError) {
            console.error("Error creating payment notification:", notificationError);
            // Continue execution even if notification fails
        }
        
        res.status(200).json({
            success: true,
            message: "Bill marked as paid successfully",
            data: updatedBill
        });
    } catch (error) {
        console.error("Error in markBillAsPaid:", error);
        res.status(500).json({
            success: false,
            message: "Failed to mark bill as paid",
            error: error.message
        });
    }
};

/**
 * Download bill invoice as PDF
 */
export const downloadBillInvoice = async (req, res) => {
    try {
        const { id: billId } = req.params;
        
        // Get bill details
        const bill = await prisma.billingRecord.findFirst({
            where: {
                id: billId,
            },
            include: {
                organization: {
                    select: {
                        name: true,
                        subscriptionPlan: true,
                        address: true
                    }
                }
            }
        });
        
        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found or you don't have access to this bill"
            });
        }
        
        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${bill.id}.pdf`);
        
        // Pipe the PDF to the response
        doc.pipe(res);
        
        // Define theme colors
        const themeColors = {
            primary: '#5D5CFF',      // Claude Purple
            secondary: '#7C76FF',    // Bright Purple
            muted: '#7B86A7',        // Muted Purple
            background: '#F6F8FC',   // Light Blue-Grey
            text: '#08091A'          // Nearly Black
        };
        
        // Add logo and header
        const logoPath = 'public/assets/logo.png'; // You'll need to convert your SVG to PNG
        try {
            doc.image(logoPath, 50, 45, { width: 150 });
        } catch (logoError) {
            console.warn("Logo image not found, using text instead");
            doc.fontSize(24).fillColor(themeColors.primary).text('Alkaa', 50, 45, { bold: true });
        }
        
        // Add colored header background
        doc.rect(50, 100, doc.page.width - 100, 2).fill(themeColors.primary);
        
        // Add invoice title
        doc.fontSize(28)
           .fillColor(themeColors.primary)
           .text('INVOICE', doc.page.width - 150, 50, { align: 'right' });
        
        const monthName = new Date(bill.year, bill.month - 1).toLocaleString('default', { month: 'long' });
        
        // Add invoice number and date below title
        doc.fontSize(10)
           .fillColor(themeColors.muted)
           .text(`#${bill.id.substring(0, 8)}`, doc.page.width - 150, 80, { align: 'right' })
           .text(`Issued: ${new Date(bill.billDate).toLocaleDateString()}`, { align: 'right' });
        
        // Reset position for main content
        doc.moveDown(4);
        
        // Add organization info
        doc.fontSize(15).fillColor(themeColors.primary).text('Billed To:');
        doc.fontSize(12).fillColor(themeColors.text).text(bill.organization.name);
        if (bill.organization.address) {
            doc.text(bill.organization.address);
        }
        doc.moveDown();
        
        // Two-column section for invoice and payment details
        const startY = doc.y;
        
        // Left column - Invoice Details
        doc.fontSize(15).fillColor(themeColors.primary).text('Invoice Details:', 50, startY);
        doc.fontSize(12).fillColor(themeColors.text)
           .text(`Invoice Number: ${bill.id.substring(0, 8)}`, 50, doc.y + 10)
           .text(`Billing Period: ${monthName} ${bill.year}`, 50, doc.y + 5)
           .text(`Issue Date: ${new Date(bill.billDate).toLocaleDateString()}`, 50, doc.y + 5)
           .text(`Due Date: ${new Date(bill.dueDate).toLocaleDateString()}`, 50, doc.y + 5);
        
        // Right column - Payment Status
        const rightColumnX = doc.page.width / 2 + 30;
        doc.fontSize(15).fillColor(themeColors.primary).text('Payment Status:', rightColumnX, startY);
        doc.fontSize(12).fillColor(themeColors.text)
           .text(`Status: ${bill.status}`, rightColumnX, doc.y + 10);
        
        if (bill.status === 'PAID' && bill.paidDate) {
            doc.text(`Paid Date: ${new Date(bill.paidDate).toLocaleDateString()}`, rightColumnX, doc.y + 5)
               .text(`Payment Reference: ${bill.paymentReference || 'N/A'}`, rightColumnX, doc.y + 5);
        }
        
        // Find the lower y-position between the two columns to continue
        const resumeY = Math.max(doc.y, startY + 100);
        doc.y = resumeY;
        doc.moveDown();
        
        // Add divider
        doc.rect(50, doc.y, doc.page.width - 100, 1).fill(themeColors.muted);
        doc.moveDown();
        
        // Add subscription info with light background
        doc.rect(50, doc.y, doc.page.width - 100, 80).fill(themeColors.background);
        doc.fillColor(themeColors.primary)
           .fontSize(15)
           .text('Subscription Details:', 60, doc.y + 10);
        
        doc.fillColor(themeColors.text)
           .fontSize(12)
           .text(`Plan: ${bill.organization.subscriptionPlan}`, 60, doc.y + 10)
           .text(`Active Users: ${bill.activeUserCount}`, 200, doc.y)
           .text(`Price Per User: $${bill.pricePerUser.toFixed(2)}`, 340, doc.y);
        
        // Reset y position after the background rectangle
        doc.y += 50;
        doc.moveDown();
        
        // Add divider
        doc.rect(50, doc.y, doc.page.width - 100, 1).fill(themeColors.muted);
        doc.moveDown();
        
        // Add totals with bold styling
        doc.fontSize(15).fillColor(themeColors.primary).text('Payment Summary:', 50, doc.y + 10);
        
        // Calculate positions for right-aligned amounts
        const amountX = doc.page.width - 150;
        
        doc.fontSize(12).fillColor(themeColors.text)
           .text('Subtotal:', 50, doc.y + 10)
           .text(`$${bill.totalAmount.toFixed(2)}`, amountX, doc.y, { align: 'right' });
        
        doc.moveDown(0.5);
        
        // Total with highlighted box
        doc.rect(50, doc.y, doc.page.width - 100, 30).fill(themeColors.primary);
        doc.fillColor('#FFFFFF')
           .fontSize(14)
           .text('Total Amount:', 60, doc.y + 8)
           .text(`$${bill.totalAmount.toFixed(2)}`, amountX, doc.y + 8, { align: 'right' });
        
        // Move down past the box
        doc.y += 40;
        
        // Add footer with thank you message
        doc.fontSize(10)
           .fillColor(themeColors.muted)
           .text('Thank you for your business!', { align: 'center' })
           .moveDown(0.5)
           .text('For questions about this invoice, please contact support@alkaa.com', { align: 'center' });
        
        // Add page number
        doc.fontSize(10)
           .fillColor(themeColors.muted)
           .text('Page 1 of 1', doc.page.width - 100, doc.page.height - 50, { align: 'right' });
        
        // Finalize PDF
        doc.end();
        
    } catch (error) {
        console.error("Error in downloadBillInvoice:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate invoice",
            error: error.message
        });
    }
};
