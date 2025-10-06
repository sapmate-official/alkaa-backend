import prisma from "../../../db/connectDb.js";
import AttendanceRulesProcessor from "../../../services/attendance/AttendanceRulesProcessor.js";
import ProgressiveDeductionEngine from "../../../services/attendance/ProgressiveDeductionEngine.js";

const rulesProcessor = new AttendanceRulesProcessor();
const deductionEngine = new ProgressiveDeductionEngine();

/**
 * Get comprehensive attendance analytics for organization
 */
export const getOrganizationAnalytics = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            fromDate, 
            toDate, 
            department,
            employeeIds,
            includeViolations = true,
            includeBreaks = true,
            includeGeofencing = true 
        } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Default to last 30 days if no dates provided
        const endDate = toDate ? new Date(toDate) : new Date();
        const startDate = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const where = {
            user: { orgId },
            date: {
                gte: startDate,
                lte: endDate
            }
        };

        if (department) {
            where.user.department = department;
        }

        if (employeeIds) {
            const ids = Array.isArray(employeeIds) ? employeeIds : employeeIds.split(',');
            where.user.id = { in: ids };
        }

        // Get attendance records
        const attendanceRecords = await prisma.attendanceRecord.findMany({
            where,
            include: {
                user: {
                    select: { 
                        id: true, 
                        firstName: true, 
                        lastName: true, 
                        employeeId: true,
                        department: true 
                    }
                }
            }
        });

        // Base analytics
        const analytics = {
            summary: {
                totalEmployees: new Set(attendanceRecords.map(r => r.userId)).size,
                totalAttendanceRecords: attendanceRecords.length,
                dateRange: { from: startDate, to: endDate },
                averageWorkingDays: 0,
                totalWorkingHours: 0,
                averageWorkingHours: 0
            },
            attendance: {
                presentDays: 0,
                absentDays: 0,
                lateDays: 0,
                earlyDepartures: 0,
                attendanceRate: 0,
                punctualityRate: 0
            },
            departments: {},
            employees: {},
            trends: {
                daily: {},
                weekly: {},
                monthly: {}
            }
        };

        // Calculate basic attendance metrics
        let totalWorkingMinutes = 0;
        let presentDays = 0;
        let lateDays = 0;
        let earlyDepartures = 0;

        attendanceRecords.forEach(record => {
            if (record.checkInTime && record.checkOutTime) {
                presentDays++;
                const workingMinutes = Math.floor((record.checkOutTime - record.checkInTime) / 60000);
                totalWorkingMinutes += workingMinutes;

                // Check for late arrival (assuming 9 AM start)
                const checkInHour = record.checkInTime.getHours();
                const checkInMinute = record.checkInTime.getMinutes();
                if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
                    lateDays++;
                }

                // Check for early departure (assuming 5 PM end)
                const checkOutHour = record.checkOutTime.getHours();
                if (checkOutHour < 17) {
                    earlyDepartures++;
                }
            }

            // Department analytics
            const dept = record.user.department || 'Unassigned';
            if (!analytics.departments[dept]) {
                analytics.departments[dept] = {
                    employeeCount: new Set(),
                    totalRecords: 0,
                    presentDays: 0,
                    totalWorkingHours: 0
                };
            }
            analytics.departments[dept].employeeCount.add(record.userId);
            analytics.departments[dept].totalRecords++;
            if (record.checkInTime && record.checkOutTime) {
                analytics.departments[dept].presentDays++;
                analytics.departments[dept].totalWorkingHours += 
                    Math.floor((record.checkOutTime - record.checkInTime) / 3600000);
            }

            // Employee analytics
            const employeeName = `${record.user.firstName} ${record.user.lastName}`;
            if (!analytics.employees[employeeName]) {
                analytics.employees[employeeName] = {
                    employeeId: record.user.employeeId,
                    department: record.user.department,
                    totalDays: 0,
                    presentDays: 0,
                    totalWorkingHours: 0,
                    lateArrivals: 0,
                    earlyDepartures: 0
                };
            }
            analytics.employees[employeeName].totalDays++;
            if (record.checkInTime && record.checkOutTime) {
                analytics.employees[employeeName].presentDays++;
                analytics.employees[employeeName].totalWorkingHours += 
                    Math.floor((record.checkOutTime - record.checkInTime) / 3600000);
            }

            // Daily trends
            const dateKey = record.date.toISOString().split('T')[0];
            if (!analytics.trends.daily[dateKey]) {
                analytics.trends.daily[dateKey] = { present: 0, absent: 0, late: 0 };
            }
            if (record.checkInTime) {
                analytics.trends.daily[dateKey].present++;
                if (lateDays > 0) analytics.trends.daily[dateKey].late++;
            } else {
                analytics.trends.daily[dateKey].absent++;
            }
        });

        // Finalize calculations
        analytics.summary.totalWorkingHours = Math.round(totalWorkingMinutes / 60);
        analytics.summary.averageWorkingHours = analytics.summary.totalEmployees > 0 ? 
            Math.round(analytics.summary.totalWorkingHours / analytics.summary.totalEmployees) : 0;

        analytics.attendance.presentDays = presentDays;
        analytics.attendance.lateDays = lateDays;
        analytics.attendance.earlyDepartures = earlyDepartures;
        analytics.attendance.attendanceRate = attendanceRecords.length > 0 ? 
            Math.round((presentDays / attendanceRecords.length) * 100) : 0;
        analytics.attendance.punctualityRate = presentDays > 0 ? 
            Math.round(((presentDays - lateDays) / presentDays) * 100) : 0;

        // Convert department employee sets to counts
        Object.keys(analytics.departments).forEach(dept => {
            analytics.departments[dept].employeeCount = analytics.departments[dept].employeeCount.size;
        });

        // Add violations data if requested
        if (includeViolations === 'true') {
            const violations = await prisma.attendanceRuleViolation.findMany({
                where: {
                    attendance: {
                        user: { orgId },
                        date: { gte: startDate, lte: endDate }
                    }
                },
                include: {
                    attendance: {
                        include: {
                            user: { select: { firstName: true, lastName: true, department: true } }
                        }
                    }
                }
            });

            analytics.violations = {
                total: violations.length,
                byType: {},
                bySeverity: {},
                byDepartment: {},
                approvalRate: 0,
                penaltyImpact: await calculatePenaltyImpact(violations)
            };

            let approvedCount = 0;
            violations.forEach(violation => {
                // Count by type
                if (!analytics.violations.byType[violation.violationType]) {
                    analytics.violations.byType[violation.violationType] = 0;
                }
                analytics.violations.byType[violation.violationType]++;

                // Count by severity
                if (!analytics.violations.bySeverity[violation.severity]) {
                    analytics.violations.bySeverity[violation.severity] = 0;
                }
                analytics.violations.bySeverity[violation.severity]++;

                // Count by department
                const dept = violation.attendance.user.department || 'Unassigned';
                if (!analytics.violations.byDepartment[dept]) {
                    analytics.violations.byDepartment[dept] = 0;
                }
                analytics.violations.byDepartment[dept]++;

                if (violation.isApproved) approvedCount++;
            });

            analytics.violations.approvalRate = violations.length > 0 ? 
                Math.round((approvedCount / violations.length) * 100) : 0;
        }

        // Add breaks data if requested
        if (includeBreaks === 'true') {
            const breaks = await prisma.breakRecord.findMany({
                where: {
                    user: { orgId },
                    startTime: { gte: startDate, lte: endDate }
                },
                include: {
                    user: { select: { firstName: true, lastName: true, department: true } }
                }
            });

            analytics.breaks = {
                total: breaks.length,
                totalDuration: 0,
                averageDuration: 0,
                byType: {},
                violations: breaks.filter(b => b.hasViolation).length,
                byDepartment: {}
            };

            let totalMinutes = 0;
            let completedBreaks = 0;

            breaks.forEach(breakRecord => {
                if (breakRecord.endTime) {
                    const duration = Math.floor((breakRecord.endTime - breakRecord.startTime) / 60000);
                    totalMinutes += duration;
                    completedBreaks++;
                }

                // Count by type
                if (!analytics.breaks.byType[breakRecord.breakType]) {
                    analytics.breaks.byType[breakRecord.breakType] = 0;
                }
                analytics.breaks.byType[breakRecord.breakType]++;

                // Count by department
                const dept = breakRecord.user.department || 'Unassigned';
                if (!analytics.breaks.byDepartment[dept]) {
                    analytics.breaks.byDepartment[dept] = 0;
                }
                analytics.breaks.byDepartment[dept]++;
            });

            analytics.breaks.totalDuration = totalMinutes;
            analytics.breaks.averageDuration = completedBreaks > 0 ? 
                Math.round(totalMinutes / completedBreaks) : 0;
        }

        // Add geofencing data if requested
        if (includeGeofencing === 'true') {
            const validations = await prisma.locationValidationLog.findMany({
                where: {
                    user: { orgId },
                    createdAt: { gte: startDate, lte: endDate }
                }
            });

            analytics.geofencing = {
                totalValidations: validations.length,
                validValidations: validations.filter(v => v.isValid).length,
                violations: validations.filter(v => !v.isValid).length,
                complianceRate: validations.length > 0 ? 
                    Math.round((validations.filter(v => v.isValid).length / validations.length) * 100) : 0
            };
        }

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting organization analytics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get organization analytics"
        });
    }
};

/**
 * Get employee-specific analytics
 */
export const getEmployeeAnalytics = async (req, res) => {
    try {
        const { orgId, userId } = req.params;
        const { fromDate, toDate } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Verify employee belongs to organization
        const employee = await prisma.user.findUnique({
            where: { id: userId },
            select: { orgId: true, firstName: true, lastName: true, employeeId: true, department: true }
        });

        if (!employee || employee.orgId !== orgId) {
            return res.status(404).json({
                error: "Employee not found"
            });
        }

        const endDate = toDate ? new Date(toDate) : new Date();
        const startDate = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Get attendance records
        const attendanceRecords = await prisma.attendanceRecord.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate }
            },
            orderBy: { date: 'asc' }
        });

        // Get violations
        const violations = await prisma.attendanceRuleViolation.findMany({
            where: {
                attendance: {
                    userId,
                    date: { gte: startDate, lte: endDate }
                }
            },
            include: { rule: true }
        });

        // Get breaks
        const breaks = await prisma.breakRecord.findMany({
            where: {
                userId,
                startTime: { gte: startDate, lte: endDate }
            }
        });

        // Calculate analytics
        const analytics = {
            employee: {
                name: `${employee.firstName} ${employee.lastName}`,
                employeeId: employee.employeeId,
                department: employee.department
            },
            summary: {
                totalDays: attendanceRecords.length,
                presentDays: attendanceRecords.filter(r => r.checkInTime).length,
                totalWorkingHours: 0,
                averageWorkingHours: 0,
                attendanceRate: 0
            },
            performance: {
                punctualityScore: 0,
                complianceScore: 0,
                productivityScore: 0,
                overallScore: 0
            },
            violations: {
                total: violations.length,
                byType: {},
                severity: { HIGH: 0, MEDIUM: 0, LOW: 0 },
                trends: {}
            },
            breaks: {
                total: breaks.length,
                totalDuration: 0,
                averageDuration: 0,
                violations: breaks.filter(b => b.hasViolation).length
            },
            trends: {
                workingHours: {},
                attendance: {},
                violations: {}
            },
            recommendations: []
        };

        // Calculate working hours
        let totalWorkingMinutes = 0;
        let presentDays = 0;
        let lateDays = 0;

        attendanceRecords.forEach(record => {
            if (record.checkInTime && record.checkOutTime) {
                presentDays++;
                const workingMinutes = Math.floor((record.checkOutTime - record.checkInTime) / 60000);
                totalWorkingMinutes += workingMinutes;

                // Check for late arrival
                const checkInHour = record.checkInTime.getHours();
                const checkInMinute = record.checkInTime.getMinutes();
                if (checkInHour > 9 || (checkInHour === 9 && checkInMinute > 15)) {
                    lateDays++;
                }

                // Daily trends
                const dateKey = record.date.toISOString().split('T')[0];
                analytics.trends.workingHours[dateKey] = Math.round(workingMinutes / 60);
                analytics.trends.attendance[dateKey] = 'present';
            } else {
                const dateKey = record.date.toISOString().split('T')[0];
                analytics.trends.attendance[dateKey] = 'absent';
            }
        });

        analytics.summary.totalWorkingHours = Math.round(totalWorkingMinutes / 60);
        analytics.summary.averageWorkingHours = presentDays > 0 ? 
            Math.round(totalWorkingMinutes / 60 / presentDays) : 0;
        analytics.summary.attendanceRate = attendanceRecords.length > 0 ? 
            Math.round((presentDays / attendanceRecords.length) * 100) : 0;

        // Analyze violations
        violations.forEach(violation => {
            if (!analytics.violations.byType[violation.violationType]) {
                analytics.violations.byType[violation.violationType] = 0;
            }
            analytics.violations.byType[violation.violationType]++;
            analytics.violations.severity[violation.severity]++;

            const dateKey = violation.createdAt.toISOString().split('T')[0];
            analytics.violations.trends[dateKey] = (analytics.violations.trends[dateKey] || 0) + 1;
        });

        // Calculate break analytics
        let totalBreakMinutes = 0;
        let completedBreaks = 0;

        breaks.forEach(breakRecord => {
            if (breakRecord.endTime) {
                const duration = Math.floor((breakRecord.endTime - breakRecord.startTime) / 60000);
                totalBreakMinutes += duration;
                completedBreaks++;
            }
        });

        analytics.breaks.totalDuration = totalBreakMinutes;
        analytics.breaks.averageDuration = completedBreaks > 0 ? 
            Math.round(totalBreakMinutes / completedBreaks) : 0;

        // Calculate performance scores
        analytics.performance.punctualityScore = presentDays > 0 ? 
            Math.round(((presentDays - lateDays) / presentDays) * 100) : 0;
        
        analytics.performance.complianceScore = attendanceRecords.length > 0 ? 
            Math.round(((attendanceRecords.length - violations.length) / attendanceRecords.length) * 100) : 100;
        
        analytics.performance.productivityScore = analytics.summary.averageWorkingHours >= 8 ? 100 : 
            Math.round((analytics.summary.averageWorkingHours / 8) * 100);
        
        analytics.performance.overallScore = Math.round(
            (analytics.performance.punctualityScore + 
             analytics.performance.complianceScore + 
             analytics.performance.productivityScore) / 3
        );

        // Generate recommendations
        if (analytics.performance.punctualityScore < 80) {
            analytics.recommendations.push({
                type: 'punctuality',
                message: 'Consider arriving earlier to improve punctuality score',
                priority: 'HIGH'
            });
        }

        if (violations.length > 5) {
            analytics.recommendations.push({
                type: 'compliance',
                message: 'Focus on following attendance policies to reduce violations',
                priority: 'MEDIUM'
            });
        }

        if (analytics.summary.averageWorkingHours < 7) {
            analytics.recommendations.push({
                type: 'productivity',
                message: 'Consider extending working hours to meet productivity targets',
                priority: 'LOW'
            });
        }

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting employee analytics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get employee analytics"
        });
    }
};

/**
 * Get attendance trends and predictions
 */
export const getAttendanceTrends = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { period = 'daily', days = 30 } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const endDate = new Date();
        const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

        // Get attendance data
        const attendanceRecords = await prisma.attendanceRecord.findMany({
            where: {
                user: { orgId },
                date: { gte: startDate, lte: endDate }
            },
            include: {
                user: { select: { department: true } }
            }
        });

        const trends = {
            period,
            data: {},
            summary: {
                totalRecords: attendanceRecords.length,
                averageAttendanceRate: 0,
                trendDirection: 'stable', // 'increasing', 'decreasing', 'stable'
                prediction: {}
            },
            departmentTrends: {}
        };

        // Group data by period
        attendanceRecords.forEach(record => {
            let key;
            if (period === 'daily') {
                key = record.date.toISOString().split('T')[0];
            } else if (period === 'weekly') {
                const startOfWeek = new Date(record.date);
                startOfWeek.setDate(record.date.getDate() - record.date.getDay());
                key = startOfWeek.toISOString().split('T')[0];
            } else if (period === 'monthly') {
                key = `${record.date.getFullYear()}-${String(record.date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!trends.data[key]) {
                trends.data[key] = { present: 0, absent: 0, total: 0 };
            }

            trends.data[key].total++;
            if (record.checkInTime) {
                trends.data[key].present++;
            } else {
                trends.data[key].absent++;
            }

            // Department trends
            const dept = record.user.department || 'Unassigned';
            if (!trends.departmentTrends[dept]) {
                trends.departmentTrends[dept] = {};
            }
            if (!trends.departmentTrends[dept][key]) {
                trends.departmentTrends[dept][key] = { present: 0, total: 0 };
            }
            trends.departmentTrends[dept][key].total++;
            if (record.checkInTime) {
                trends.departmentTrends[dept][key].present++;
            }
        });

        // Calculate attendance rates and trends
        const sortedDates = Object.keys(trends.data).sort();
        let totalRate = 0;
        let rateCount = 0;

        sortedDates.forEach(date => {
            const data = trends.data[date];
            data.attendanceRate = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
            totalRate += data.attendanceRate;
            rateCount++;
        });

        trends.summary.averageAttendanceRate = rateCount > 0 ? Math.round(totalRate / rateCount) : 0;

        // Determine trend direction
        if (sortedDates.length >= 7) {
            const recentRates = sortedDates.slice(-7).map(date => trends.data[date].attendanceRate);
            const earlierRates = sortedDates.slice(-14, -7).map(date => trends.data[date].attendanceRate);
            
            const recentAvg = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
            const earlierAvg = earlierRates.length > 0 ? 
                earlierRates.reduce((sum, rate) => sum + rate, 0) / earlierRates.length : recentAvg;

            if (recentAvg > earlierAvg + 2) {
                trends.summary.trendDirection = 'increasing';
            } else if (recentAvg < earlierAvg - 2) {
                trends.summary.trendDirection = 'decreasing';
            }
        }

        // Simple prediction for next week (basic linear trend)
        if (sortedDates.length >= 7) {
            const lastWeekRates = sortedDates.slice(-7).map(date => trends.data[date].attendanceRate);
            const avgRate = lastWeekRates.reduce((sum, rate) => sum + rate, 0) / lastWeekRates.length;
            
            trends.summary.prediction = {
                nextWeekRate: Math.round(avgRate),
                confidence: 'medium',
                factors: []
            };

            if (trends.summary.trendDirection === 'increasing') {
                trends.summary.prediction.nextWeekRate = Math.min(100, Math.round(avgRate + 2));
                trends.summary.prediction.factors.push('Positive trend observed');
            } else if (trends.summary.trendDirection === 'decreasing') {
                trends.summary.prediction.nextWeekRate = Math.max(0, Math.round(avgRate - 2));
                trends.summary.prediction.factors.push('Declining trend detected');
            }
        }

        res.status(200).json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Error getting attendance trends:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get attendance trends"
        });
    }
};

/**
 * Generate attendance report
 */
export const generateAttendanceReport = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            reportType = 'summary', // summary, detailed, violations, payroll
            fromDate, 
            toDate,
            format = 'json', // json, csv
            employeeIds,
            department
        } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const endDate = toDate ? new Date(toDate) : new Date();
        const startDate = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const where = {
            user: { orgId },
            date: { gte: startDate, lte: endDate }
        };

        if (department) where.user.department = department;
        if (employeeIds) where.user.id = { in: employeeIds };

        let reportData = {};

        switch (reportType) {
            case 'summary':
                reportData = await generateSummaryReport(where, startDate, endDate);
                break;
            case 'detailed':
                reportData = await generateDetailedReport(where, startDate, endDate);
                break;
            case 'violations':
                reportData = await generateViolationsReport(where, startDate, endDate);
                break;
            case 'payroll':
                reportData = await generatePayrollReport(where, startDate, endDate);
                break;
            default:
                return res.status(400).json({
                    error: "Invalid report type",
                    message: "Report type must be one of: summary, detailed, violations, payroll"
                });
        }

        res.status(200).json({
            success: true,
            data: {
                reportType,
                period: { from: startDate, to: endDate },
                generatedAt: new Date(),
                format,
                ...reportData
            }
        });
    } catch (error) {
        console.error('Error generating attendance report:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to generate attendance report"
        });
    }
};

// Helper functions for report generation
async function generateSummaryReport(where, startDate, endDate) {
    const records = await prisma.attendanceRecord.findMany({
        where,
        include: {
            user: { select: { firstName: true, lastName: true, department: true } }
        }
    });

    const summary = {
        totalEmployees: new Set(records.map(r => r.userId)).size,
        totalRecords: records.length,
        presentDays: records.filter(r => r.checkInTime).length,
        absentDays: records.filter(r => !r.checkInTime).length,
        attendanceRate: 0,
        departmentSummary: {}
    };

    summary.attendanceRate = summary.totalRecords > 0 ? 
        Math.round((summary.presentDays / summary.totalRecords) * 100) : 0;

    return { summary };
}

async function generateDetailedReport(where, startDate, endDate) {
    const records = await prisma.attendanceRecord.findMany({
        where,
        include: {
            user: { select: { firstName: true, lastName: true, employeeId: true, department: true } }
        },
        orderBy: [{ user: { lastName: 'asc' } }, { date: 'asc' }]
    });

    return { records };
}

async function generateViolationsReport(where, startDate, endDate) {
    const violations = await prisma.attendanceRuleViolation.findMany({
        where: {
            attendance: where,
            createdAt: { gte: startDate, lte: endDate }
        },
        include: {
            attendance: {
                include: {
                    user: { select: { firstName: true, lastName: true, employeeId: true } }
                }
            },
            rule: true
        }
    });

    return { violations };
}

async function generatePayrollReport(where, startDate, endDate) {
    const records = await prisma.attendanceRecord.findMany({
        where,
        include: {
            user: { select: { firstName: true, lastName: true, employeeId: true } }
        }
    });

    const payrollData = records.map(record => {
        const workingHours = record.checkInTime && record.checkOutTime ? 
            Math.round((record.checkOutTime - record.checkInTime) / 3600000) : 0;
        
        return {
            employeeId: record.user.employeeId,
            employeeName: `${record.user.firstName} ${record.user.lastName}`,
            date: record.date,
            workingHours,
            overtime: Math.max(0, workingHours - 8),
            present: !!record.checkInTime
        };
    });

    return { payrollData };
}

async function calculatePenaltyImpact(violations) {
    const impact = {
        totalPenalties: 0,
        estimatedDeduction: 0,
        byEmployee: {}
    };

    for (const violation of violations) {
        try {
            const penalty = await deductionEngine.calculatePenalty(
                violation.violationType,
                [], // Simplified for report
                violation
            );
            
            impact.totalPenalties++;
            impact.estimatedDeduction += penalty.amount || 0;
        } catch (error) {
            console.warn('Error calculating penalty for violation:', violation.id);
        }
    }

    return impact;
}
