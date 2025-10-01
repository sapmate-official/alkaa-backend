import prisma from "../../../../db/connectDb.js";
import { calculateAllowances, calculateDeductions, calculateNetSalary } from "../utils/salaryCalculations.js";
import { calculateAttendanceStats } from "../utils/attendanceUtils.js";
import { processLeaveAdjustments, processAttendanceAdjustments } from "../utils/adjustmentUtils.js";

export class PayrollService {
    /**
     * Get payslips based on parameters
     */
    static async getPayslips(userId, month, year) {
        const query = {
            where: {
                userId: userId
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        department: {
                            select: {
                                name: true
                            }
                        },
                        bankDetails: {
                            select: {
                                accountNumber: true,
                                bankName: true,
                                ifscCode: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                {year: 'desc'},
                {month: 'desc'}
            ]
        };

        // Add month and year filters if provided
        if (month && month !== 'undefined') {
            query.where.month = parseInt(month);
        }

        if (year && year !== 'undefined') {
            query.where.year = parseInt(year);
        }

        return await prisma.salaryRecord.findMany(query);
    }

    /**
     * Generate salary for a user
     */
    static async generateSalary(targetUserId, month, year, cycleId = null, options = {}) {
        console.log("[SALARY_GENERATE] Starting salary generation for user:", targetUserId);

        const { replaceExisting = false, initiatedBy = null } = options;

        // Check if salary already exists
        const existingSalary = await prisma.salaryRecord.findUnique({
            where: {
                userId_month_year: {
                    userId: targetUserId,
                    month: parseInt(month),
                    year: parseInt(year)
                }
            }
        });

        if (existingSalary && !replaceExisting) {
            throw new Error("Salary for this month and year already exists");
        }

        // Process pending adjustments
        const adjustmentAmount = await this.processPendingAdjustments(targetUserId, month, year);

        // Fetch user data
    const user = await this.fetchUserData(targetUserId);
        
        // Get salary parameters
        const salaryParams = user.salaryParameter || this.getDefaultSalaryParams();
        
        // Get base salary
        const baseSalary = user.monthlySalary || 0;

        // Calculate working days and attendance
        const { workingDays, attendanceStats } = await calculateAttendanceStats(targetUserId, month, year, user.orgId);

        // Calculate allowances
        const allowances = calculateAllowances(baseSalary, salaryParams, adjustmentAmount);

        // Calculate deductions
        const deductions = calculateDeductions(baseSalary, salaryParams, attendanceStats, workingDays);

        // Calculate net salary
        const netSalary = calculateNetSalary(baseSalary, allowances, deductions);

        // Create salary record with cycle reference
        const wasReplaced = Boolean(existingSalary);

        const salaryRecord = await this.createSalaryRecord({
            userId: targetUserId,
            cycleId, // Add cycle reference
            orgId: user.orgId,
            month: parseInt(month),
            year: parseInt(year),
            basicSalary: baseSalary,
            netSalary: netSalary,
            allowances: allowances.breakdown,
            deductions: deductions.breakdown,
            adjustmentAmount
        }, existingSalary, {
            initiatedBy,
            adjustmentAmount,
            replaceExisting
        });

        return {
            ...salaryRecord,
            wasReplaced,
            initiatedBy
        };
    }

    /**
     * Get salary statistics
     */    static async getSalaryStatistics(salaryRecordId) {
        const salaryRecord = await prisma.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    include: {
                        department: true,
                        bankDetails: true,
                        organization: true,
                        salaryParameter: true,
                        salaryTemplate: true
                    }
                }
            }
        });

        if (!salaryRecord) {
            throw new Error("Salary record not found");
        }

        // Get additional statistics data
        const additionalData = await this.getAdditionalStatisticsData(salaryRecord);

        return {
            salaryRecord,
            ...additionalData
        };
    }

    /**
     * Check multiple payslip status
     */
    static async checkMultiplePayslipStatus(payslipData) {
        const statusMap = {};

        for (const data of payslipData) {
            const { userId, month, year } = data;
            
            const existingRecord = await prisma.salaryRecord.findUnique({
                where: {
                    userId_month_year: {
                        userId,
                        month: parseInt(month),
                        year: parseInt(year)
                    }
                },
                select: {
                    id: true,
                    status: true,
                    netSalary: true,
                    paymentStatus: true,
                    createdAt: true
                }
            });

            const key = `${userId}_${month}_${year}`;
            statusMap[key] = existingRecord ? {
                exists: true,
                status: existingRecord.status,
                salaryRecordId: existingRecord.id,
                netSalary: existingRecord.netSalary,
                paymentStatus: existingRecord.paymentStatus,
                createdAt: existingRecord.createdAt
            } : {
                exists: false
            };
        }

        return statusMap;
    }

    /**
     * Bulk approve salaries
     */
    static async bulkApproveSalaries(salaryRecordIds, approvedBy, notes = null) {
        try {
            const now = new Date();
            const result = await prisma.salaryRecord.updateMany({
                where: {
                    id: { in: salaryRecordIds },
                    status: 'PROCESSED'
                },
                data: {
                    status: 'APPROVED',
                    paymentStatus: 'PENDING',
                    processedAt: now,
                    reviewedAt: now,
                    reviewedById: approvedBy,
                    reviewComments: notes,
                    remarks: notes ? `${notes} - Bulk approved` : 'Bulk approved'
                }
            });

            // Log the bulk approval
            for (const salaryRecordId of salaryRecordIds) {
                await prisma.activityLog.create({
                    data: {
                        orgId: await this.getOrgIdFromSalaryRecord(salaryRecordId),
                        actorId: approvedBy,
                        action: 'APPROVE',
                        entity: 'SALARY_RECORD',
                        entityId: salaryRecordId,
                        description: `Bulk approved salary record ${salaryRecordId}`
                    }
                });
            }

            return result;
        } catch (error) {
            console.error("[BULK_APPROVE_SALARIES] Error:", error);
            throw error;
        }
    }

    /**
     * Helper method to get organization ID from salary record
     */
    static async getOrgIdFromSalaryRecord(salaryRecordId) {
        const salaryRecord = await prisma.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    select: { orgId: true }
                }
            }
        });
        return salaryRecord?.user?.orgId;
    }

    // Private helper methods
    static async processPendingAdjustments(targetUserId, month, year) {
        const currentSalaryKey = `${year}-${month.toString().padStart(2, '0')}`;
        
        const leaveAdjustments = await processLeaveAdjustments(targetUserId, currentSalaryKey);
        const attendanceAdjustments = await processAttendanceAdjustments(targetUserId, currentSalaryKey);

        return leaveAdjustments + attendanceAdjustments;
    }

    static async fetchUserData(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                salaryParameter: true,
                department: true,
                organization: true
            }
        });

        if (!user) {
            throw new Error("User not found");
        }

        return user;
    }

    static getDefaultSalaryParams() {
        return {
            hraPercentage: 0,
            daPercentage: 0,
            taPercentage: 0,
            pfPercentage: 0,
            taxPercentage: 0,
            insuranceFixed: 0,
            additionalAllowances: {},
            additionalDeductions: {}
        };
    }

    static async createSalaryRecord(salaryData, existingRecord = null, metadata = {}) {
        const monthName = new Date(salaryData.year, salaryData.month - 1, 1).toLocaleString('default', { month: 'long' });

        const { adjustmentAmount = 0 } = metadata;

        // Remove adjustmentAmount from salaryData as it's not a valid field in SalaryRecord
        const { adjustmentAmount: _ignoredAdjustment, ...validSalaryData } = salaryData;

        const processedAt = new Date();
        const taxAmount = validSalaryData.deductions?.tax || 0;

        const baseData = {
            ...validSalaryData,
            tax: taxAmount,
            status: "PROCESSED",
            paymentStatus: 'PENDING',
            processedAt,
            reviewedById: null,
            reviewedAt: null,
            reviewComments: null,
            paymentMode: null,
            paymentRef: null,
            remarks: `Salary for ${monthName} ${salaryData.year}${adjustmentAmount > 0 ? ` (includes adjustment of ${adjustmentAmount.toFixed(2)})` : ''}`
        };

        if (existingRecord) {
            return await prisma.salaryRecord.update({
                where: { id: existingRecord.id },
                data: {
                    ...baseData,
                    salaryTransactions: {
                        deleteMany: {}
                    }
                }
            });
        }

        return await prisma.salaryRecord.create({
            data: baseData
        });
    }

    static async getAdditionalStatisticsData(salaryRecord) {
        const { month, year, userId } = salaryRecord;

        // Get working days calculation
        const orgId = salaryRecord.user?.organization?.id || salaryRecord.user?.orgId;
        if (!orgId) {
            throw new Error("Organization information not found for salary record");
        }

        const attendanceData = await calculateAttendanceStats(userId, month, year, orgId);
        const {
            workingDays,
            attendanceStats,
            records: attendanceRecords = [],
            leaveRequests = [],
            metadata = {}
        } = attendanceData;

        const monthStart = metadata?.monthStart ?? new Date(year, month - 1, 1);
        const nextMonthStart = metadata?.nextMonthStart ?? new Date(year, month, 1);

        const [
            attendanceRules,
            breakRules,
            geofenceRules,
            organizationSettings,
            progressivePenalties,
            calculationRules
        ] = await prisma.$transaction([
            prisma.organizationAttendanceRules.findMany({
                where: { orgId, isActive: true },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.organizationBreakRules.findMany({
                where: { orgId, isActive: true },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.organizationGeofence.findMany({
                where: { orgId, isActive: true },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.organizationSettings.findFirst({
                where: { orgId },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.progressivePenaltyHistory.findMany({
                where: {
                    userId,
                    payrollMonth: month,
                    payrollYear: year
                },
                orderBy: { dateApplied: 'asc' }
            }),
            prisma.calculationRule.findMany({
                where: { orgId, isActive: true },
                orderBy: { createdAt: 'asc' }
            })
        ]);

        const [attendanceViolations, breakRecords, geofenceViolations] = await Promise.all([
            prisma.attendanceRuleViolation.findMany({
                where: {
                    attendance: {
                        userId,
                        date: {
                            gte: monthStart,
                            lt: nextMonthStart
                        }
                    }
                },
                include: {
                    rule: true,
                    attendance: {
                        select: {
                            date: true,
                            status: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            }),
            prisma.breakRecord.findMany({
                where: {
                    userId,
                    startTime: {
                        gte: monthStart,
                        lt: nextMonthStart
                    }
                },
                orderBy: { startTime: 'asc' }
            }),
            prisma.geofenceViolation.findMany({
                where: {
                    userId,
                    startTime: {
                        gte: monthStart,
                        lt: nextMonthStart
                    }
                },
                include: {
                    geofence: true
                },
                orderBy: { startTime: 'asc' }
            })
        ]);

        const salaryParameters = normalizeSalaryParameters(
            salaryRecord.user?.salaryParameter || this.getDefaultSalaryParams()
        );
        const salaryTemplate = sanitizeSalaryTemplate(salaryRecord.user?.salaryTemplate || null);
        const normalizedCalculationRules = calculationRules.map(formatCalculationRule);

        const attendanceContext = buildAttendanceContext({
            month,
            year,
            attendanceRecords,
            leaveRequests,
            metadata: { ...metadata, monthStart, nextMonthStart },
            breakRecords,
            geofenceViolations
        });

        const ruleContext = buildRuleContext({
            attendanceRules,
            breakRules,
            geofenceRules,
            organizationSettings,
            attendanceViolations,
            breakRecords,
            geofenceViolations
        });

        const penaltyContext = buildPenaltyContext({
            attendanceViolations,
            breakRecords,
            geofenceViolations,
            progressivePenalties
        });

        // Get YTD earnings
        const ytdEarnings = await prisma.salaryRecord.findMany({
            where: {
                userId,
                year,
                month: { lte: month }
            },
            select: { netSalary: true }
        });

        const ytdTotal = ytdEarnings.reduce((sum, record) => sum + record.netSalary, 0);

        // Get previous month comparison
        const previousMonth = month === 1 ? 12 : month - 1;
        const previousYear = month === 1 ? year - 1 : year;

        const previousSalaryRecord = await prisma.salaryRecord.findUnique({
            where: {
                userId_month_year: {
                    userId,
                    month: previousMonth,
                    year: previousYear
                }
            }
        });

        return {
            workingDays,
            attendanceStats,
            ytdTotal,
            previousSalaryRecord,
            salaryContext: {
                salaryParameters,
                salaryTemplate,
                calculationRules: normalizedCalculationRules
            },
            attendanceContext,
            ruleContext,
            penaltyContext
        };
    }
    static async preStatsSalaryGeneration(targetUserId, validMonth, validYear){
        try {
            const user = await this.fetchUserData(targetUserId);
            // Calculate working days and attendance statistics using attendanceUtils function
            const { workingDays, attendanceStats } = await calculateAttendanceStats(targetUserId, validMonth, validYear, user.orgId);
            // Fetch verified attendance, unverified attendance, and leave stats for this month
            const verifiedAttendance = await prisma.attendanceRecord.count({
                where: {
                    userId: targetUserId,
                    date: {
                        gte: new Date(validYear, validMonth - 1, 1),
                        lt: new Date(validYear, validMonth, 1)
                    },
                    verificationStatus: 'VERIFIED'
                }
            });

            const unverifiedAttendance = await prisma.attendanceRecord.count({
                where: {
                    userId: targetUserId,
                    date: {
                        gte: new Date(validYear, validMonth - 1, 1),
                        lt: new Date(validYear, validMonth, 1)
                    },
                    verificationStatus: 'UNVERIFIED'
                }
            });

            const leaveStats = await prisma.leaveRequest.findMany({
                where: {
                    userId: targetUserId,
                    startDate: {
                        gte: new Date(validYear, validMonth - 1, 1),
                        lt: new Date(validYear, validMonth, 1)
                    },
                    status: 'APPROVED'
                },
                select: {
                    leaveType: true,
                    numberOfDays: true,
                    startDate: true,
                    endDate: true
                }
            });

            return {
                userId: targetUserId,
                month: validMonth,
                year: validYear,
                workingDays: workingDays,
                attendanceStats: attendanceStats,
                verifiedAttendance: verifiedAttendance,
                unverifiedAttendance: unverifiedAttendance,
                leaveStats: leaveStats,
                userName: `${user.firstName} ${user.lastName}`,
                department: user.department ? user.department.name : "N/A",
                organization: user.organization ? user.organization.name : "N/A"
            }
        }catch (e) {
            console.error(e);
            throw new Error("Failed to pre-generate salary statistics");

        }
    }
}

// ------------------------- Helper utilities -------------------------

const ATTENDANCE_RULE_DEFINITIONS = {
    LATE_ARRIVAL: "Triggers when employees check in after the permitted late threshold.",
    EARLY_DEPARTURE: "Monitors early departures before the scheduled end time.",
    MINIMUM_HOURS: "Ensures employees meet the minimum working hours per shift.",
    BREAK_VIOLATION: "Applies when break policies are exceeded or unapproved breaks occur.",
    GEOFENCE_VIOLATION: "Flags check-ins or locations outside the configured geofence.",
    ABSENTEEISM: "Tracks consecutive absenteeism against organizational policy."
};

const BREAK_RULE_DESCRIPTIONS = {
    LUNCH: "Defines the maximum allowable duration and frequency for lunch breaks.",
    TEA_BREAK: "Regulates tea breaks to balance downtime and productivity.",
    PERSONAL: "Controls personal breaks to maintain schedule adherence.",
    MEDICAL: "Captures medical breaks that may require approval and tracking.",
    UNAUTHORIZED: "Monitors unapproved or unscheduled breaks." 
};

function normalizeSalaryParameters(params) {
    const source = params || {};
    const normalizeRecord = (value) => {
        const plain = ensurePlainObject(value);
        const result = {};
        Object.entries(plain).forEach(([key, val]) => {
            const numericValue = toNumber(val);
            if (numericValue !== null) {
                result[key] = Number(numericValue.toFixed(2));
            }
        });
        return result;
    };

    return {
        hraPercentage: Number(source.hraPercentage ?? 0),
        daPercentage: Number(source.daPercentage ?? 0),
        taPercentage: Number(source.taPercentage ?? 0),
        pfPercentage: Number(source.pfPercentage ?? 0),
        taxPercentage: Number(source.taxPercentage ?? 0),
        insuranceFixed: Number(source.insuranceFixed ?? 0),
        additionalAllowances: normalizeRecord(source.additionalAllowances),
        additionalDeductions: normalizeRecord(source.additionalDeductions)
    };
}

function sanitizeSalaryTemplate(template) {
    if (!template) {
        return null;
    }

    return {
        id: template.id,
        name: template.name,
        description: template.description,
        isDefault: Boolean(template.isDefault),
        isActive: Boolean(template.isActive),
        rules: ensurePlainObject(template.rules),
        createdAt: template.createdAt ? template.createdAt.toISOString() : null,
        updatedAt: template.updatedAt ? template.updatedAt.toISOString() : null
    };
}

function formatCalculationRule(rule) {
    return {
        id: rule.id,
        name: rule.name,
        formula: rule.formula,
        type: rule.type,
        isActive: Boolean(rule.isActive),
        createdAt: rule.createdAt ? rule.createdAt.toISOString() : null,
        updatedAt: rule.updatedAt ? rule.updatedAt.toISOString() : null
    };
}

function buildAttendanceContext({ month, year, attendanceRecords, leaveRequests, metadata, breakRecords, geofenceViolations }) {
    const sanitizedRecords = (attendanceRecords || [])
        .map(formatAttendanceRecord)
        .filter(Boolean);
    const sanitizedLeaves = (leaveRequests || [])
        .map(sanitizeLeaveRequest)
        .filter(Boolean);
    const sanitizedHolidays = ((metadata && metadata.holidays) || [])
        .map(sanitizeHoliday)
        .filter(Boolean);
    const sanitizedBreaks = (breakRecords || [])
        .map(formatBreakRecord)
        .filter(Boolean);
    const sanitizedGeofenceViolations = (geofenceViolations || [])
        .map(formatGeofenceViolation)
        .filter(Boolean);

    const daysInMonth = metadata?.daysInMonth || new Date(year, month, 0).getDate();
    const weekendDays = metadata?.weekendDays || [];

    const calendarData = buildAttendanceCalendar({
        month,
        year,
        daysInMonth,
        records: sanitizedRecords,
        leaves: sanitizedLeaves,
        holidays: sanitizedHolidays,
        weekendDays
    });

    const totalHoursWorked = sanitizedRecords.reduce((sum, record) => sum + (record.durationHours || 0), 0);
    const totalBreakMinutes = sanitizedBreaks.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);

    const monthStartIso = metadata?.monthStart
        ? (metadata.monthStart instanceof Date ? metadata.monthStart.toISOString() : metadata.monthStart)
        : new Date(year, month - 1, 1).toISOString();
    const monthEndIso = metadata?.nextMonthStart
        ? new Date((metadata.nextMonthStart instanceof Date ? metadata.nextMonthStart : new Date(metadata.nextMonthStart)).getTime() - 1).toISOString()
        : new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    return {
        calendar: calendarData.calendar,
        summaryByStatus: calendarData.summaryByStatus,
        records: sanitizedRecords,
        leaves: sanitizedLeaves,
        holidays: sanitizedHolidays,
        breakHistory: sanitizedBreaks,
        geofenceHistory: sanitizedGeofenceViolations,
        totals: {
            hoursWorked: Number(totalHoursWorked.toFixed(2)),
            breakMinutes: Math.round(totalBreakMinutes),
            attendanceEntries: sanitizedRecords.length,
            geofenceViolationCount: sanitizedGeofenceViolations.length
        },
        metadata: {
            weekendDays,
            daysInMonth,
            monthStart: monthStartIso,
            monthEnd: monthEndIso
        }
    };
}

function buildRuleContext({
    attendanceRules,
    breakRules,
    geofenceRules,
    organizationSettings,
    attendanceViolations,
    breakRecords,
    geofenceViolations
}) {
    const formattedAttendanceViolations = (attendanceViolations || [])
        .map(formatAttendanceViolation)
        .filter(Boolean);
    const formattedBreakRecords = (breakRecords || [])
        .map(formatBreakRecord)
        .filter(Boolean);
    const formattedGeofenceViolations = (geofenceViolations || [])
        .map(formatGeofenceViolation)
        .filter(Boolean);

    const attendanceRuleInsights = (attendanceRules || []).map((rule) => {
        const violations = formattedAttendanceViolations.filter((violation) => violation.ruleId === rule.id);
        return {
            id: rule.id,
            ruleType: rule.ruleType,
            definition: ATTENDANCE_RULE_DEFINITIONS[rule.ruleType] || "Custom attendance rule configured by your organization.",
            threshold: ensurePlainObject(rule.threshold),
            penalty: ensurePlainObject(rule.penalty),
            isActive: rule.isActive,
            violationCount: violations.length,
            violations,
            severityBreakdown: buildSeverityBreakdown(violations)
        };
    });

    const breakRuleInsights = (breakRules || []).map((rule) => {
        const relatedBreaks = formattedBreakRecords.filter((record) => record.breakType === rule.breakType);
        const violations = relatedBreaks.filter((record) => Boolean(record.violation));
        return {
            id: rule.id,
            breakType: rule.breakType,
            definition: getBreakRuleDescription(rule.breakType),
            maxDuration: rule.maxDuration,
            maxFrequency: rule.maxFrequency,
            timeWindow: rule.timeWindow || null,
            penaltyPerMinute: toNumber(rule.penaltyPerMinute),
            isActive: rule.isActive,
            totalBreaks: relatedBreaks.length,
            violationCount: violations.length,
            violations
        };
    });

    const geofenceRuleInsights = (geofenceRules || []).map((rule) => {
        const violations = formattedGeofenceViolations.filter((violation) => violation.geofenceId === rule.id);
        return {
            id: rule.id,
            name: rule.name,
            type: rule.type,
            definition: getGeofenceDefinition(rule),
            radius: toNumber(rule.radius),
            strictMode: rule.strictMode,
            allowedDeviation: toNumber(rule.allowedDeviation) ?? 0,
            isActive: rule.isActive,
            violationCount: violations.length,
            violations
        };
    });

    return {
        attendanceRules: attendanceRuleInsights,
        breakRules: breakRuleInsights,
        geofenceRules: geofenceRuleInsights,
        organizationSettings: organizationSettings ? sanitizeOrganizationSettings(organizationSettings) : null
    };
}

function buildPenaltyContext({ attendanceViolations, breakRecords, geofenceViolations, progressivePenalties }) {
    const formattedAttendanceViolations = (attendanceViolations || [])
        .map(formatAttendanceViolation)
        .filter(Boolean);
    const formattedBreakViolations = (breakRecords || [])
        .map(formatBreakRecord)
        .filter((record) => record && Boolean(record.violation));
    const formattedGeofenceViolations = (geofenceViolations || [])
        .map(formatGeofenceViolation)
        .filter(Boolean);

    return {
        progressivePenalties: (progressivePenalties || [])
            .map(formatProgressivePenalty)
            .filter(Boolean),
        attendanceViolations: {
            summary: summarizeAttendanceViolations(formattedAttendanceViolations),
            records: formattedAttendanceViolations
        },
        breakViolations: {
            summary: summarizeBreakViolations(formattedBreakViolations),
            records: formattedBreakViolations
        },
        geofenceViolations: {
            summary: summarizeGeofenceViolations(formattedGeofenceViolations),
            records: formattedGeofenceViolations
        }
    };
}

function formatAttendanceRecord(record) {
    if (!record) {
        return null;
    }

    const durationHours = deriveDurationHours(record);
    const ruleViolations = (record.ruleViolations || []).map(formatAttendanceViolation);
    const breakHistory = (record.breakRecords || []).map(formatBreakRecord);
    const geofenceHistory = (record.geofenceViolations || []).map(formatGeofenceViolation);
    const locationValidations = (record.locationValidations || []).map(formatLocationValidation);

    return {
        id: record.id,
        date: record.date instanceof Date ? record.date.toISOString() : record.date,
        status: record.status,
        checkInTime: record.checkInTime ? record.checkInTime.toISOString() : null,
        checkOutTime: record.checkOutTime ? record.checkOutTime.toISOString() : null,
        durationHours,
        verificationStatus: record.verificationStatus,
        notes: record.notes,
        ruleViolations,
        breakRecords: breakHistory,
        geofenceViolations: geofenceHistory,
        locationValidations
    };
}

function deriveDurationHours(record) {
    if (!record) {
        return null;
    }

    const duration = record.duration;

    if (duration && typeof duration === 'object') {
        if (typeof duration.hours === 'number') {
            return Number(duration.hours.toFixed(2));
        }
        if (typeof duration.totalHours === 'number') {
            return Number(duration.totalHours.toFixed(2));
        }
        if (typeof duration.minutes === 'number') {
            return Number((duration.minutes / 60).toFixed(2));
        }
    }

    if (typeof duration === 'number') {
        return Number(duration.toFixed(2));
    }

    if (record.checkInTime && record.checkOutTime) {
        const diffMs = record.checkOutTime.getTime() - record.checkInTime.getTime();
        if (diffMs > 0) {
            return Number((diffMs / (1000 * 60 * 60)).toFixed(2));
        }
    }

    return null;
}

function formatAttendanceViolation(violation) {
    if (!violation) {
        return null;
    }

    return {
        id: violation.id,
        ruleId: violation.ruleId,
        ruleType: violation.rule?.ruleType || null,
        violationType: violation.violationType,
        severity: violation.severity,
        penaltyAmount: toNumber(violation.penaltyAmount),
        isApproved: Boolean(violation.isApproved),
        approvedBy: violation.approvedBy || null,
        approvedAt: violation.approvedAt ? violation.approvedAt.toISOString() : null,
        createdAt: violation.createdAt ? violation.createdAt.toISOString() : null,
        attendanceDate: violation.attendance?.date ? (violation.attendance.date instanceof Date ? violation.attendance.date.toISOString() : violation.attendance.date) : null,
        attendanceStatus: violation.attendance?.status || null
    };
}

function formatBreakRecord(record) {
    if (!record) {
        return null;
    }

    const durationMinutes = deriveDurationMinutes(record);

    return {
        id: record.id,
        breakType: record.breakType,
        startTime: record.startTime ? record.startTime.toISOString() : null,
        endTime: record.endTime ? record.endTime.toISOString() : null,
        durationMinutes,
        status: record.status,
        isApproved: Boolean(record.isApproved),
        approvedBy: record.approvedBy || null,
        violation: record.violation || null,
        note: record.note || null
    };
}

function deriveDurationMinutes(record) {
    if (!record) {
        return 0;
    }

    const duration = record.duration;

    if (duration && typeof duration === 'object') {
        if (typeof duration.minutes === 'number') {
            return Math.round(duration.minutes);
        }
        if (typeof duration.totalMinutes === 'number') {
            return Math.round(duration.totalMinutes);
        }
        if (typeof duration.hours === 'number') {
            return Math.round(duration.hours * 60);
        }
    }

    if (typeof duration === 'number') {
        return Math.round(duration);
    }

    if (record.startTime && record.endTime) {
        const diffMs = record.endTime.getTime() - record.startTime.getTime();
        if (diffMs > 0) {
            return Math.round(diffMs / (1000 * 60));
        }
    }

    return 0;
}

function formatGeofenceViolation(violation) {
    if (!violation) {
        return null;
    }

    return {
        id: violation.id,
        geofenceId: violation.geofenceId,
        geofenceName: violation.geofence?.name || null,
        geofenceType: violation.geofence?.type || null,
        violationType: violation.violationType,
        severity: violation.severity,
        startTime: violation.startTime ? violation.startTime.toISOString() : null,
        resolvedAt: violation.resolvedAt ? violation.resolvedAt.toISOString() : null,
        resolutionType: violation.resolutionType || null,
        resolutionNote: violation.resolutionNote || null,
        violationCount: violation.violationCount ?? 1,
        distance: toNumber(violation.distance),
        latitude: toNumber(violation.latitude),
        longitude: toNumber(violation.longitude),
        action: violation.action || null,
        isBreakRelated: Boolean(violation.isBreakRelated),
        metadata: ensurePlainObject(violation.metadata)
    };
}

function formatLocationValidation(validation) {
    if (!validation) {
        return null;
    }

    return {
        id: validation.id,
        validationType: validation.validationType,
        isValid: Boolean(validation.isValid),
        timestamp: validation.timestamp ? validation.timestamp.toISOString() : null,
        deviation: toNumber(validation.deviation),
        geofenceId: validation.geofenceId || null,
        latitude: toNumber(validation.latitude),
        longitude: toNumber(validation.longitude)
    };
}

function sanitizeLeaveRequest(leave) {
    if (!leave) {
        return null;
    }

    return {
        id: leave.id,
        leaveTypeId: leave.leaveTypeId,
        leaveType: leave.leaveType?.name || null,
        isPaid: leave.leaveType ? Boolean(leave.leaveType.isPaid) : null,
        status: leave.status,
        numberOfDays: Number(leave.numberOfDays || 0),
        startDate: leave.startDate ? leave.startDate.toISOString() : null,
        endDate: leave.endDate ? leave.endDate.toISOString() : null,
        contributedToSalary: ensurePlainObject(leave.contributedToSalary)
    };
}

function sanitizeHoliday(holiday) {
    if (!holiday) {
        return null;
    }

    return {
        id: holiday.id,
        name: holiday.name,
        date: holiday.date instanceof Date ? holiday.date.toISOString() : holiday.date,
        isOptional: Boolean(holiday.isOptional),
        type: holiday.type || null
    };
}

function buildAttendanceCalendar({ month, year, daysInMonth, records, leaves, holidays, weekendDays }) {
    const recordsByDay = new Map();
    (records || []).forEach((record) => {
        if (!record || !record.date) return;
        const day = new Date(record.date).getDate();
        if (!recordsByDay.has(day)) {
            recordsByDay.set(day, []);
        }
        recordsByDay.get(day).push(record);
    });

    const leavesByDay = new Map();
    (leaves || []).forEach((leave) => {
        if (!leave || !leave.startDate || !leave.endDate) return;
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const cursor = new Date(start);

        while (cursor <= end) {
            if (cursor.getFullYear() === year && cursor.getMonth() + 1 === month) {
                const day = cursor.getDate();
                if (!leavesByDay.has(day)) {
                    leavesByDay.set(day, []);
                }
                leavesByDay.get(day).push(leave);
            }
            cursor.setDate(cursor.getDate() + 1);
        }
    });

    const holidayByDay = new Map();
    (holidays || []).forEach((holiday) => {
        if (!holiday || !holiday.date) return;
        const holidayDate = new Date(holiday.date);
        if (holidayDate.getFullYear() === year && holidayDate.getMonth() + 1 === month) {
            holidayByDay.set(holidayDate.getDate(), holiday);
        }
    });

    const calendar = [];

    for (let day = 1; day <= daysInMonth; day += 1) {
        const currentDate = new Date(year, month - 1, day);
        const dailyRecords = recordsByDay.get(day) || [];
        const leaveEntries = leavesByDay.get(day) || [];
        const holiday = holidayByDay.get(day) || null;
        const isWeekend = weekendDays.includes(currentDate.getDay());

        const attendanceStatus = determineAttendanceStatus(dailyRecords, leaveEntries, holiday, isWeekend);

        calendar.push({
            date: currentDate.toISOString(),
            day,
            isWeekend,
            attendanceStatus,
            records: dailyRecords,
            leave: leaveEntries.length ? leaveEntries : null,
            holiday
        });
    }

    const summaryByStatus = calendar.reduce((acc, item) => {
        const key = item.attendanceStatus || 'UNSPECIFIED';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return {
        calendar,
        summaryByStatus
    };
}

function determineAttendanceStatus(records, leaveEntries, holiday, isWeekend) {
    if (holiday) {
        return 'HOLIDAY';
    }

    if (leaveEntries && leaveEntries.length) {
        const isPaidLeave = leaveEntries.some((leave) => leave.isPaid !== false);
        return isPaidLeave ? 'PAID_LEAVE' : 'UNPAID_LEAVE';
    }

    if (!records || records.length === 0) {
        return isWeekend ? 'WEEKEND' : 'NO_RECORD';
    }

    const priority = ['ABSENT', 'HALF_DAY', 'EARLY_DEPARTURE', 'LATE', 'PRESENT'];
    for (const status of priority) {
        if (records.some((record) => record.status === status)) {
            return status;
        }
    }

    return records[0].status || 'NO_RECORD';
}

function summarizeAttendanceViolations(violations) {
    let totalPenalty = 0;
    const byRuleType = {};

    (violations || []).forEach((violation) => {
        const penaltyAmount = typeof violation?.penaltyAmount === 'number' ? violation.penaltyAmount : 0;
        totalPenalty += penaltyAmount;

        const key = violation?.ruleType || 'UNSPECIFIED';
        if (!byRuleType[key]) {
            byRuleType[key] = { count: 0, penalty: 0 };
        }
        byRuleType[key].count += 1;
        byRuleType[key].penalty += penaltyAmount;
    });

    return {
        totalViolations: violations?.length || 0,
        totalPenalty: Number(totalPenalty.toFixed(2)),
        byRuleType
    };
}

function summarizeBreakViolations(violations) {
    const summary = {
        totalViolations: violations?.length || 0,
        totalMinutesImpacted: 0,
        byBreakType: {}
    };

    (violations || []).forEach((violation) => {
        const key = violation?.breakType || 'UNSPECIFIED';
        if (!summary.byBreakType[key]) {
            summary.byBreakType[key] = { count: 0, totalMinutes: 0 };
        }
        summary.byBreakType[key].count += 1;
        summary.byBreakType[key].totalMinutes += violation?.durationMinutes || 0;
        summary.totalMinutesImpacted += violation?.durationMinutes || 0;
    });

    return summary;
}

function summarizeGeofenceViolations(violations) {
    const summary = {
        totalViolations: violations?.length || 0,
        byViolationType: {},
        maxRecordedDistance: 0
    };

    (violations || []).forEach((violation) => {
        const key = violation?.violationType || 'GENERAL';
        if (!summary.byViolationType[key]) {
            summary.byViolationType[key] = { count: 0 };
        }
        summary.byViolationType[key].count += 1;
        const distance = typeof violation?.distance === 'number' ? violation.distance : null;
        if (distance !== null) {
            summary.maxRecordedDistance = Math.max(summary.maxRecordedDistance, distance);
        }
    });

    return summary;
}

function buildSeverityBreakdown(violations) {
    return (violations || []).reduce((acc, violation) => {
        const key = violation?.severity || 'UNSPECIFIED';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
}

function sanitizeOrganizationSettings(settings) {
    if (!settings) {
        return null;
    }

    return {
        geofencingEnabled: Boolean(settings.geofencingEnabled),
        attendanceRules: ensurePlainObject(settings.attendanceRules),
        breakPolicies: ensurePlainObject(settings.breakPolicies),
        breakRules: ensurePlainObject(settings.breakRules),
        alertConfiguration: ensurePlainObject(settings.alertConfiguration),
        penaltySystem: ensurePlainObject(settings.penaltySystem),
        updatedAt: settings.updatedAt ? settings.updatedAt.toISOString() : null
    };
}

function getBreakRuleDescription(breakType) {
    return BREAK_RULE_DESCRIPTIONS[breakType] || "Custom break policy configured by your organization.";
}

function getGeofenceDefinition(rule) {
    if (!rule) {
        return "Geofence policy defined by your organization.";
    }

    const typeText = rule.type ? rule.type.replace(/_/g, ' ').toLowerCase() : 'geofence';
    const strictText = rule.strictMode
        ? 'Employees must remain within this boundary; deviations trigger immediate alerts.'
        : 'Limited deviation is permitted before a violation is raised.';

    return `${rule.name || 'Geofence'} (${typeText}). ${strictText}`;
}

function formatProgressivePenalty(penalty) {
    if (!penalty) {
        return null;
    }

    return {
        id: penalty.id,
        violationType: penalty.violationType,
        penaltyAmount: toNumber(penalty.penaltyAmount),
        progressiveMultiplier: toNumber(penalty.progressiveMultiplier),
        violationCount: penalty.violationCount,
        status: penalty.status,
        dateApplied: penalty.dateApplied ? penalty.dateApplied.toISOString() : null,
        payrollMonth: penalty.payrollMonth,
        payrollYear: penalty.payrollYear,
        metadata: ensurePlainObject(penalty.metadata)
    };
}

function ensurePlainObject(value) {
    if (!value) {
        return {};
    }

    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    if (Array.isArray(value)) {
        return value.reduce((acc, item, index) => {
            if (item && typeof item === 'object' && 'name' in item) {
                acc[item.name] = toNumber(item.amount ?? item.value ?? 0) ?? 0;
            } else {
                acc[`item_${index}`] = toNumber(item) ?? 0;
            }
            return acc;
        }, {});
    }

    if (typeof value === 'object') {
        return value;
    }

    return {};
}

function toNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === 'number') {
        return value;
    }

    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? null : parsed;
    }

    if (typeof value === 'object') {
        if (typeof value.toNumber === 'function') {
            return value.toNumber();
        }
        if ('value' in value && typeof value.value === 'number') {
            return value.value;
        }
    }

    return null;
}
