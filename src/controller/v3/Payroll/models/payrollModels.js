/**
 * Format payslip data for response
 */
export function formatPayslipData(payslips) {
    return payslips.map(payslip => {
        const designation = payslip.user?.department?.name || 'Not Assigned';

        return {
            id: payslip.id,
            userId: payslip.userId,
            month: payslip.month,
            year: payslip.year,
            basicSalary: payslip.basicSalary,
            netSalary: payslip.netSalary,
            status: payslip.status,
            paymentStatus: payslip.paymentStatus,
            processedAt: payslip.processedAt,
            reviewedAt: payslip.reviewedAt,
            reviewComments: payslip.reviewComments,
            createdAt: payslip.createdAt,
            updatedAt: payslip.updatedAt,
            allowances: payslip.allowances,
            deductions: payslip.deductions,
            paymentMode: payslip.paymentMode,
            paymentRef: payslip.paymentRef,
            remarks: payslip.remarks,
            incentive: payslip.incentive,
            bonus: payslip.bonus,
            anomalies: payslip.anomalies,
            employee: {
                firstName: payslip.user?.firstName,
                lastName: payslip.user?.lastName,
                employeeId: payslip.user?.employeeId,
                department: payslip.user?.department?.name,
                designation: designation,
                bankDetails: payslip.user?.bankDetails ? {
                    accountNumber: `XXXX${payslip.user.bankDetails.accountNumber.slice(-4)}`,
                    bankName: payslip.user.bankDetails.bankName,
                    ifscCode: payslip.user.bankDetails.ifscCode
                } : null
            }
        };
    });
}

/**
 * Format salary statistics data for response
 */
export function formatSalaryStatistics(salaryRecord, additionalData) {
    const { month, year } = salaryRecord;
    const {
        workingDays,
        attendanceStats,
        ytdTotal,
        previousSalaryRecord,
        salaryContext = {},
        attendanceContext = {},
        ruleContext = {},
        penaltyContext = {}
    } = additionalData;

    // Parse allowances and deductions
    const allowances = salaryRecord.allowances || {};
    const deductions = salaryRecord.deductions || {};
    
    // Calculate totals
    const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    
    // Format month name
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

    // Calculate ratios and percentages
    const earningsRatio = salaryRecord.basicSalary > 0 
        ? (salaryRecord.netSalary / salaryRecord.basicSalary) * 100 
        : 0;

    // Prepare comparison with previous month
    const monthlyComparison = previousSalaryRecord 
        ? {
            difference: salaryRecord.netSalary - previousSalaryRecord.netSalary,
            percentageChange: previousSalaryRecord.netSalary > 0 
                ? ((salaryRecord.netSalary - previousSalaryRecord.netSalary) / previousSalaryRecord.netSalary) * 100 
                : 0
        } 
        : null;

    const normalizedAttendanceStats = attendanceStats || {};
    const daysInMonthFromContext = attendanceContext?.metadata?.daysInMonth;
    const attendanceTotals = attendanceContext?.totals || {
        hoursWorked: 0,
        breakMinutes: 0,
        attendanceEntries: 0,
        geofenceViolationCount: 0
    };

    return {
        basicInfo: {
            salaryRecordId: salaryRecord.id,
            month: month,
            monthName: monthName,
            year: year,
            employee: {
                id: salaryRecord.user.id,
                name: `${salaryRecord.user.firstName || ''} ${salaryRecord.user.lastName || ''}`.trim(),
                employeeId: salaryRecord.user.employeeId,
                department: salaryRecord.user.department?.name
            },
            status: salaryRecord.status,
            processedAt: salaryRecord.processedAt,
            paymentInfo: {
                mode: salaryRecord.paymentMode,
                reference: salaryRecord.paymentRef,
                remarks: salaryRecord.remarks
            }
        },
        salaryBreakdown: {
            basicSalary: salaryRecord.basicSalary,
            totalAllowances: totalAllowances,
            allowanceDetails: allowances,
            totalDeductions: totalDeductions,
            deductionDetails: deductions,
            netSalary: salaryRecord.netSalary,
            taxAmount: salaryRecord.tax,
            additionalPayments: {
                incentive: salaryRecord.incentive || 0,
                bonus: salaryRecord.bonus || 0
            }
        },
        attendanceAnalysis: {
            totalDaysInMonth: daysInMonthFromContext || new Date(year, month, 0).getDate(),
            workingDays: workingDays,
            ...normalizedAttendanceStats,
            summaryByStatus: attendanceContext?.summaryByStatus || {},
            totals: attendanceTotals
        },
        attendanceDetails: attendanceContext,
        salaryContext,
        ruleContext,
        penaltyContext,
        comparisons: {
            earningsRatio: parseFloat(earningsRatio.toFixed(2)),
            previousMonth: monthlyComparison,
            yearToDateEarnings: parseFloat(ytdTotal.toFixed(2))
        },
        visualData: {
            earningsVsDeductions: {
                earnings: salaryRecord.basicSalary + totalAllowances,
                deductions: totalDeductions
            },
            salaryComponents: {
                basic: salaryRecord.basicSalary,
                allowances: totalAllowances,
                deductions: totalDeductions,
                net: salaryRecord.netSalary
            }
        }
    };
}

/**
 * Format multiple payslip status response
 */
export function formatMultiplePayslipStatus(statusMap) {
    return statusMap;
}

/**
 * Format payslip data specifically for frontend PDF generation
 */
export function formatPayslipForFrontendPDF(salaryRecord, additionalData) {
    const { month, year } = salaryRecord;
    const {
        workingDays,
        attendanceStats,
        salaryContext = {},
        attendanceContext = {},
        ruleContext = {},
        penaltyContext = {}
    } = additionalData;

    const normalizedAttendanceStats = attendanceStats || {};

    // Parse allowances and deductions
    const allowances = salaryRecord.allowances || {};
    const deductions = salaryRecord.deductions || {};
    
    // Calculate totals
    const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const grossPay = salaryRecord.basicSalary + totalAllowances + (salaryRecord.incentive || 0) + (salaryRecord.bonus || 0);
    
    // Format month name and dates
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
    const payDate = salaryRecord.processedAt ? new Date(salaryRecord.processedAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');
    const period = `M${month.toString().padStart(2, '0')}${year}`;

    // Employee information
    const employee = {
        name: `${salaryRecord.user.firstName || ''} ${salaryRecord.user.lastName || ''}`.trim(),
        employeeId: salaryRecord.user.employeeId || 'N/A',
        department: salaryRecord.user.department?.name || 'N/A',
        email: salaryRecord.user.email || 'N/A',
        bankDetails: salaryRecord.user.bankDetails ? {
            bankName: salaryRecord.user.bankDetails.bankName || 'N/A',
            accountNumber: `XXXX${(salaryRecord.user.bankDetails.accountNumber || '').slice(-4)}`,
            ifscCode: salaryRecord.user.bankDetails.ifscCode || 'N/A'
        } : null
    };

    // Company information
    const company = {
        name: salaryRecord.user.organization?.name || 'Company Name',
        address: salaryRecord.user.organization?.address || 'Company Address',
        email: salaryRecord.user.organization?.email || 'hr@company.com',
        phone: salaryRecord.user.organization?.phone || 'Company Phone'
    };

    // Earnings breakdown
    const effectiveWorkingDays = workingDays || 0;
    const basicRate = effectiveWorkingDays > 0
        ? salaryRecord.basicSalary / effectiveWorkingDays
        : salaryRecord.basicSalary;

    const earnings = {
        basicSalary: {
            description: 'Basic Salary',
            hours: effectiveWorkingDays,
            rate: basicRate,
            current: salaryRecord.basicSalary,
            ytd: salaryRecord.basicSalary * month
        },
        allowances: Object.entries(allowances).map(([key, value]) => ({
            description: key.toUpperCase(),
            current: parseFloat(value) || 0,
            ytd: (parseFloat(value) || 0) * month
        })),
        additionalPayments: []
    };

    // Add incentive and bonus if they exist
    if (salaryRecord.incentive) {
        earnings.additionalPayments.push({
            description: 'Incentive',
            current: salaryRecord.incentive,
            ytd: salaryRecord.incentive * month
        });
    }

    if (salaryRecord.bonus) {
        earnings.additionalPayments.push({
            description: 'Bonus',
            current: salaryRecord.bonus,
            ytd: salaryRecord.bonus * month
        });
    }

    // Deductions breakdown
    const deductionsBreakdown = Object.entries(deductions).map(([key, value]) => ({
        description: key.toUpperCase(),
        current: parseFloat(value) || 0,
        ytd: (parseFloat(value) || 0) * month
    }));

    // Add tax if exists
    if (salaryRecord.tax) {
        deductionsBreakdown.push({
            description: 'Tax',
            current: salaryRecord.tax,
            ytd: salaryRecord.tax * month
        });
    }

    return {
        // Basic Information
        month,
        year,
        monthName,
        payDate,
        period,
        status: salaryRecord.status,
        paymentStatus: salaryRecord.paymentStatus,
        paymentMode: salaryRecord.paymentMode || 'MANUAL',
        paymentRef: salaryRecord.paymentRef,
        
        // Employee & Company Information
        employee,
        company,
        
        // Financial Data
        basicSalary: salaryRecord.basicSalary,
        grossPay,
        totalDeductions: totalDeductions + (salaryRecord.tax || 0),
        netSalary: salaryRecord.netSalary,
        
        // Detailed Breakdown
        earnings,
        deductions: deductionsBreakdown,
        
        // Attendance Information
        attendance: {
            workingDays,
            ...normalizedAttendanceStats
        },
        attendanceDetails: attendanceContext,
        salaryContext,
        ruleContext,
        penaltyContext,
        
        // YTD Information
        ytd: {
            grossPay: grossPay * month,
            totalDeductions: (totalDeductions + (salaryRecord.tax || 0)) * month,
            netSalary: salaryRecord.netSalary * month
        }
    };
}

/**
 * Mask sensitive information in bank details
 */
export function maskBankDetails(bankDetails) {
    if (!bankDetails) return null;

    return {
        ...bankDetails,
        accountNumber: bankDetails.accountNumber 
            ? `XXXX${bankDetails.accountNumber.slice(-4)}`
            : 'N/A'
    };
}
