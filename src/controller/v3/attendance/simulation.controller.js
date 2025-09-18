import express from 'express';
import prisma from '../../../db/connectDb.js';
import { authenticateToken } from '../../../middleware/auth.middleware.js';

const router = express.Router();

// Apply authentication middleware
router.use(authenticateToken);

/**
 * Run attendance simulation for testing
 */
router.post('/organizations/:orgId/simulate', async (req, res) => {
    try {
        const { orgId } = req.params;
        const { scenario = 'basic', month, year } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const results = {
            scenario,
            orgId,
            month: month || new Date().getMonth() + 1,
            year: year || new Date().getFullYear(),
            steps: [],
            employees: [],
            violations: [],
            summary: {
                totalEmployees: 0,
                totalViolations: 0,
                totalPenalties: 0,
                averageSalaryReduction: 0
            }
        };

        // Step 1: Create test attendance rules
        results.steps.push('Creating attendance rules...');
        
        const rules = [
            {
                ruleType: 'LATE_ARRIVAL',
                threshold: { minutes: 15 },
                penalty: { amount: 100, type: 'fixed' },
                isActive: true
            },
            {
                ruleType: 'EARLY_DEPARTURE',
                threshold: { minutes: 30 },
                penalty: { amount: 150, type: 'fixed' },
                isActive: true
            },
            {
                ruleType: 'MINIMUM_HOURS',
                threshold: { hours: 8 },
                penalty: { amount: 50, type: 'per_hour' },
                isActive: true
            }
        ];

        for (const rule of rules) {
            await prisma.organizationAttendanceRules.upsert({
                where: {
                    orgId_ruleType: {
                        orgId,
                        ruleType: rule.ruleType
                    }
                },
                update: {
                    threshold: rule.threshold,
                    penalty: rule.penalty,
                    isActive: rule.isActive
                },
                create: {
                    orgId,
                    ruleType: rule.ruleType,
                    threshold: rule.threshold,
                    penalty: rule.penalty,
                    isActive: rule.isActive
                }
            });
        }

        results.steps.push('✅ Attendance rules created');

        // Step 2: Create test geofences
        results.steps.push('Creating geofences...');
        
        const geofences = [
            {
                name: 'Main Office',
                type: 'MAIN_OFFICE',
                coordinates: {
                    latitude: 28.6139,
                    longitude: 77.2090,
                    address: 'Connaught Place, New Delhi'
                },
                radius: 100,
                isActive: true
            }
        ];

        for (const geofence of geofences) {
            await prisma.organizationGeofence.create({
                data: {
                    orgId,
                    name: geofence.name,
                    type: geofence.type,
                    coordinates: geofence.coordinates,
                    radius: geofence.radius,
                    isActive: geofence.isActive
                }
            });
        }

        results.steps.push('✅ Geofences created');

        // Step 3: Get test employees (use existing employees or create test ones)
        results.steps.push('Setting up test employees...');
        
        let employees = await prisma.user.findMany({
            where: { orgId },
            take: 5,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                monthlySalary: true,
                employeeId: true
            }
        });

        if (employees.length === 0) {
            // Create test employees if none exist
            const testEmployees = [
                { firstName: 'Perfect', lastName: 'Employee', monthlySalary: 50000, pattern: 'perfect' },
                { firstName: 'Late', lastName: 'Comer', monthlySalary: 45000, pattern: 'late' },
                { firstName: 'Early', lastName: 'Leaver', monthlySalary: 48000, pattern: 'early' }
            ];

            for (const emp of testEmployees) {
                const user = await prisma.user.create({
                    data: {
                        orgId,
                        email: `test_${emp.firstName.toLowerCase()}@simulation.com`,
                        firstName: emp.firstName,
                        lastName: emp.lastName,
                        monthlySalary: emp.monthlySalary,
                        employeeId: `SIM${Date.now()}${Math.random().toString(36).substr(2, 3)}`,
                        status: 'active'
                    }
                });
                employees.push(user);
            }
        }

        results.summary.totalEmployees = employees.length;
        results.steps.push(`✅ Setup ${employees.length} test employees`);

        // Step 4: Generate simulation attendance data
        results.steps.push('Generating attendance data...');
        
        const patterns = {
            perfect: { lateMinutes: 0, earlyMinutes: 0, workHours: 9 },
            late: { lateMinutes: 25, earlyMinutes: 0, workHours: 8.5 },
            early: { lateMinutes: 5, earlyMinutes: 45, workHours: 7.5 },
            mixed: { lateMinutes: 20, earlyMinutes: 20, workHours: 7.8 }
        };

        const workingDays = 22; // Typical working days in a month
        const baseDate = new Date(results.year, results.month - 1, 1);

        for (let empIndex = 0; empIndex < employees.length; empIndex++) {
            const employee = employees[empIndex];
            const patternKeys = Object.keys(patterns);
            const pattern = patterns[patternKeys[empIndex % patternKeys.length]];
            
            const employeeResult = {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                monthlySalary: employee.monthlySalary,
                violations: [],
                totalPenalties: 0,
                finalSalary: employee.monthlySalary
            };

            // Generate daily attendance for the month
            for (let day = 1; day <= workingDays; day++) {
                const currentDate = new Date(baseDate);
                currentDate.setDate(day);
                
                // Skip weekends
                if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue;

                const checkInTime = new Date(currentDate);
                checkInTime.setHours(9, pattern.lateMinutes, 0, 0);

                const checkOutTime = new Date(checkInTime);
                checkOutTime.setHours(18 - Math.floor(pattern.earlyMinutes / 60), 
                                    60 - (pattern.earlyMinutes % 60), 0, 0);

                // Create attendance record
                const attendanceRecord = await prisma.attendanceRecord.create({
                    data: {
                        userId: employee.id,
                        date: currentDate,
                        sessionNumber: 1,
                        checkInTime,
                        checkOutTime,
                        checkInLocation: { latitude: 28.6139, longitude: 77.2090 },
                        checkOutLocation: { latitude: 28.6139, longitude: 77.2090 },
                        status: 'PRESENT',
                        verificationStatus: 'VERIFIED'
                    }
                });

                // Check for violations and create them
                const violations = [];

                // Late arrival check
                if (pattern.lateMinutes > 15) {
                    const lateRule = await prisma.organizationAttendanceRules.findFirst({
                        where: { orgId, ruleType: 'LATE_ARRIVAL', isActive: true }
                    });

                    if (lateRule) {
                        const violation = await prisma.attendanceRuleViolation.create({
                            data: {
                                attendanceId: attendanceRecord.id,
                                ruleId: lateRule.id,
                                violationType: 'LATE_ARRIVAL',
                                severity: 'MINOR',
                                penaltyAmount: lateRule.penalty.amount
                            }
                        });
                        violations.push(violation);
                        employeeResult.totalPenalties += Number(lateRule.penalty.amount);
                    }
                }

                // Early departure check
                if (pattern.earlyMinutes > 30) {
                    const earlyRule = await prisma.organizationAttendanceRules.findFirst({
                        where: { orgId, ruleType: 'EARLY_DEPARTURE', isActive: true }
                    });

                    if (earlyRule) {
                        const violation = await prisma.attendanceRuleViolation.create({
                            data: {
                                attendanceId: attendanceRecord.id,
                                ruleId: earlyRule.id,
                                violationType: 'EARLY_DEPARTURE',
                                severity: 'MINOR',
                                penaltyAmount: earlyRule.penalty.amount
                            }
                        });
                        violations.push(violation);
                        employeeResult.totalPenalties += Number(earlyRule.penalty.amount);
                    }
                }

                employeeResult.violations.push(...violations);
            }

            employeeResult.finalSalary = Math.max(0, employeeResult.monthlySalary - employeeResult.totalPenalties);
            results.employees.push(employeeResult);
            results.summary.totalViolations += employeeResult.violations.length;
            results.summary.totalPenalties += employeeResult.totalPenalties;
        }

        results.steps.push(`✅ Generated attendance for ${workingDays} days`);
        results.steps.push(`✅ Processed ${results.summary.totalViolations} violations`);

        // Calculate average salary reduction
        const totalOriginalSalary = results.employees.reduce((sum, emp) => sum + emp.monthlySalary, 0);
        const totalFinalSalary = results.employees.reduce((sum, emp) => sum + emp.finalSalary, 0);
        results.summary.averageSalaryReduction = totalOriginalSalary > 0 
            ? ((totalOriginalSalary - totalFinalSalary) / totalOriginalSalary * 100)
            : 0;

        results.steps.push('✅ Simulation completed successfully');

        res.status(200).json({
            success: true,
            data: results,
            message: 'Attendance simulation completed successfully'
        });

    } catch (error) {
        console.error('Simulation error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to run simulation",
            details: error.message
        });
    }
});

/**
 * Clean up simulation data
 */
router.delete('/organizations/:orgId/simulation/cleanup', async (req, res) => {
    try {
        const { orgId } = req.params;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Delete simulation attendance records (those with test emails)
        const testUsers = await prisma.user.findMany({
            where: {
                orgId,
                email: { contains: '@simulation.com' }
            }
        });

        const testUserIds = testUsers.map(user => user.id);

        if (testUserIds.length > 0) {
            // Delete violations first
            await prisma.attendanceRuleViolation.deleteMany({
                where: {
                    attendance: {
                        userId: { in: testUserIds }
                    }
                }
            });

            // Delete attendance records
            await prisma.attendanceRecord.deleteMany({
                where: {
                    userId: { in: testUserIds }
                }
            });

            // Delete test users
            await prisma.user.deleteMany({
                where: {
                    id: { in: testUserIds }
                }
            });
        }

        // Delete test geofences
        await prisma.organizationGeofence.deleteMany({
            where: {
                orgId,
                name: { contains: 'Test' }
            }
        });

        res.status(200).json({
            success: true,
            message: 'Simulation data cleaned up successfully',
            data: {
                deletedUsers: testUserIds.length,
                deletedRecords: 'All simulation records'
            }
        });

    } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to cleanup simulation data"
        });
    }
});

export default router;
