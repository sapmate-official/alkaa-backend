import prisma from "../../../../db/connectDb.js";

/**
 * Calculate allowances based on salary parameters
 */
export function calculateAllowances(baseSalary, salaryParams, adjustmentAmount = 0) {
    const hraAmount = (baseSalary * salaryParams.hraPercentage) / 100;
    const daAmount = (baseSalary * salaryParams.daPercentage) / 100;
    const taAmount = (baseSalary * salaryParams.taPercentage) / 100;

    const additionalAllowances = salaryParams.additionalAllowances || {};
    let totalAdditionalAllowances = 0;

    Object.values(additionalAllowances).forEach(amount => {
        totalAdditionalAllowances += parseFloat(amount);
    });

    const breakdown = {
        hra: hraAmount,
        da: daAmount,
        ta: taAmount,
        ...additionalAllowances
    };

    // Add adjustment amount if any
    if (adjustmentAmount > 0) {
        breakdown.salaryAdjustment = adjustmentAmount;
    }

    const total = hraAmount + daAmount + taAmount + totalAdditionalAllowances + adjustmentAmount;

    return {
        breakdown,
        total
    };
}

/**
 * Calculate deductions based on salary parameters and attendance
 */
export function calculateDeductions(baseSalary, salaryParams, attendanceStats, workingDays) {
    const pfAmount = (baseSalary * salaryParams.pfPercentage) / 100;
    const taxAmount = (baseSalary * salaryParams.taxPercentage) / 100;
    const insuranceAmount = salaryParams.insuranceFixed;

    // Calculate absence deduction
    const perDaySalary = workingDays > 0 ? baseSalary / workingDays : 0;
    const absenceDeduction = attendanceStats.absentDays * perDaySalary;

    // Additional custom deductions
    const additionalDeductions = salaryParams.additionalDeductions || {};
    let totalAdditionalDeductions = 0;

    Object.values(additionalDeductions).forEach(amount => {
        totalAdditionalDeductions += parseFloat(amount);
    });

    const breakdown = {
        pf: pfAmount,
        tax: taxAmount,
        insurance: insuranceAmount,
        absence: absenceDeduction,
        ...additionalDeductions
    };

    const total = pfAmount + taxAmount + insuranceAmount + absenceDeduction + totalAdditionalDeductions;

    return {
        breakdown,
        total
    };
}

/**
 * Calculate net salary
 */
export function calculateNetSalary(baseSalary, allowances, deductions) {
    return Math.max(0, baseSalary + allowances.total - deductions.total);
}

/**
 * Format currency for display
 */
export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}
