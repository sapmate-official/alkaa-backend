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
            processedAt: payslip.processedAt,
            createdAt: payslip.createdAt,
            updatedAt: payslip.updatedAt,
            allowances: payslip.allowances,
            deductions: payslip.deductions,
            paymentMode: payslip.paymentMode,
            paymentRef: payslip.paymentRef,
            remarks: payslip.remarks,
            incentive: payslip.incentive,
            bonus: payslip.bonus,
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
    const { workingDays, attendanceStats, ytdTotal, previousSalaryRecord } = additionalData;

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
            totalDaysInMonth: new Date(year, month, 0).getDate(),
            workingDays: workingDays,
            ...attendanceStats
        },
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
