import prisma from "../../../db/connectDb.js";

/**
 * Get payslip based on provided parameters
 */
export const getPaySlipBasedOnParams = async (req, res) => {
    try {
        const { month, year, userId } = req.params;
        const currentUserId = req.user.id;

        // Check if requesting payslip for another user
        if (userId && userId !== 'undefined' && userId !== currentUserId) {
            // Check if user is authorized to view other user's payslip
            const hasManagerPermission = await prisma.user.findFirst({
                where: {
                    id: userId,
                    managerId: currentUserId
                }
            });

            const hasSubordinatePermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_of_subordinates"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            const hasAllPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_of_all"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            if (!(hasManagerPermission && hasSubordinatePermission) && !hasAllPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized access to this payslip"
                });
            }
        } else {
            // Check if user has permission to view their own payslip
            const hasSelfPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_to_myself"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            if (!hasSelfPermission) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view your payslip"
                });
            }
        }

        // Build the query based on parameters
        const queryUserId = userId && userId !== 'undefined' ? userId : currentUserId;
        const query = {
            where: {
                userId: queryUserId
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

        // Fetch payslips from database
        const payslips = await prisma.salaryRecord.findMany(query);

        // Format the payslips data
        const formattedPayslips = payslips.map(payslip => {
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

        return res.status(200).json({
            success: true,
            count: formattedPayslips.length,
            data: formattedPayslips
        });

    } catch (error) {
        console.error("Error fetching payslips:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch payslips",
            error: error.message
        });
    }
};

/**
 * Generate salary based on provided parameters
 */
export const generateSalaryBasedOnParams = async (req, res) => {
    try {
        console.log("[SALARY_GENERATE] Starting salary generation process", {
            requestParams: req.params,
            requestUser: req.user.id
        });

        const { month, year, userId } = req.params;
        const currentUserId = req.user.id;

        if (!month || !year) {
            console.log("[SALARY_GENERATE] Missing required parameters", {
                providedMonth: month,
                providedYear: year
            });
            return res.status(400).json({
                success: false,
                message: "Month and year are required"
            });
        }

        // Determine target user ID
        const targetUserId = userId && userId !== 'undefined' ? userId : currentUserId;
        console.log("[SALARY_GENERATE] Target user determined", {
            targetUserId,
            isForCurrentUser: targetUserId === currentUserId
        });

        // Permission check
        if (targetUserId !== currentUserId) {
            console.log("[SALARY_GENERATE] Checking permissions for generating other user's salary", {
                currentUserId,
                targetUserId
            });
            
            // Check if user has permission to generate salary for others
            const hasManagerPermission = await prisma.user.findFirst({
                where: {
                    id: targetUserId,
                    managerId: currentUserId
                }
            });

            const hasSubordinatePermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "generate_salary_of_subordinates"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            const hasAllPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "generate_salary_of_all"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            console.log("[SALARY_GENERATE] Permission check results", {
                hasManagerPermission: !!hasManagerPermission,
                hasSubordinatePermission: !!hasSubordinatePermission,
                hasAllPermission: !!hasAllPermission
            });

            if (!(hasManagerPermission && hasSubordinatePermission) && !hasAllPermission) {
                console.log("[SALARY_GENERATE] Permission denied for generating other user's salary", {
                    currentUserId,
                    targetUserId
                });
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized to generate salary for this user"
                });
            }
        } else {
            console.log("[SALARY_GENERATE] Checking permissions for generating own salary", {
                userId: currentUserId
            });
            
            // Check if user has permission to generate their own salary
            const hasSelfPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "generate_salary_to_myself"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            console.log("[SALARY_GENERATE] Self permission check result", {
                hasSelfPermission: !!hasSelfPermission
            });

            if (!hasSelfPermission) {
                console.log("[SALARY_GENERATE] Permission denied for generating own salary", {
                    userId: currentUserId
                });
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to generate your own salary"
                });
            }
        }

        // Check if salary is already generated for this month
        const existingSalary = await prisma.salaryRecord.findUnique({
            where: {
                userId_month_year: {
                    userId: targetUserId,
                    month: parseInt(month),
                    year: parseInt(year)
                }
            }
        });

        console.log("[SALARY_GENERATE] Checking for existing salary record", {
            exists: !!existingSalary,
            month,
            year,
            targetUserId
        });

        if (existingSalary) {
            return res.status(409).json({
                success: false,
                message: "Salary already generated for this month"
            });
        }

        // 1. DATA COLLECTION
        console.log("[SALARY_GENERATE] Starting data collection phase");

        // Fetch user details
        const user = await prisma.user.findUnique({
            where: { id: targetUserId },
            include: {
                salaryParameter: true,
                department: true,
                organization: true
            }
        });

        console.log("[SALARY_GENERATE] User details fetched", {
            userFound: !!user,
            userId: targetUserId,
            hasSalaryParameters: !!user?.salaryParameter
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Get base salary
        const baseSalary = user.monthlySalary || 0;
        console.log("[SALARY_GENERATE] Base salary determined", { baseSalary });

        // Get salary parameters (or default values)
        const salaryParams = user.salaryParameter || {
            hraPercentage: 40,
            daPercentage: 10,
            taPercentage: 10,
            pfPercentage: 12,
            taxPercentage: 10,
            insuranceFixed: 1000,
            additionalAllowances: {},
            additionalDeductions: {}
        };

        console.log("[SALARY_GENERATE] Salary parameters", salaryParams);

        // Get organization holiday settings
        const holidays = await prisma.holiday.findMany({
            where: {
                orgId: user.orgId,
                date: {
                    gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                    lt: new Date(parseInt(year), parseInt(month), 1)
                }
            }
        });

        console.log("[SALARY_GENERATE] Holidays fetched", {
            count: holidays.length,
            month,
            year,
            orgId: user.orgId
        });

        // Get attendance records
        const attendanceRecords = await prisma.attendanceRecord.findMany({
            where: {
                userId: targetUserId,
                verificationStatus : 'VERIFIED',
                date: {
                    gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                    lt: new Date(parseInt(year), parseInt(month), 1)
                }
            }
        });

        console.log("[SALARY_GENERATE] Attendance records fetched", {
            count: attendanceRecords.length,
            month,
            year,
            userId: targetUserId
        });

        // Get approved leave requests
        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                userId: targetUserId,
                status: "APPROVED",
                OR: [
                    {
                        startDate: {
                            gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                            lt: new Date(parseInt(year), parseInt(month), 1)
                        }
                    },
                    {
                        endDate: {
                            gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                            lt: new Date(parseInt(year), parseInt(month), 1)
                        }
                    }
                ]
            },
            include: {
                leaveType: true
            }
        });

        console.log("[SALARY_GENERATE] Leave requests fetched", {
            count: leaveRequests.length,
            month,
            year,
            userId: targetUserId
        });

        // Get weekoff settings
        const orgSettings = await prisma.organizationSettings.findFirst({
            where: {
                orgId: user.orgId
            }
        });

        console.log("[SALARY_GENERATE] Organization settings fetched", {
            hasSettings: !!orgSettings,
            orgId: user.orgId,
            weekendDays: orgSettings?.settings?.weekoff
        });

        // 2. BASIC CALCULATION
        console.log("[SALARY_GENERATE] Starting basic calculation phase");

        // Calculate working days
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

        // Default weekend days (0 = Sunday, 6 = Saturday)
        const weekendDays = orgSettings?.settings?.weekoff || [0, 6];

        // Count working days
        let workingDays = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(parseInt(year), parseInt(month) - 1, day);
            const dayOfWeek = date.getDay();

            if (!weekendDays.includes(dayOfWeek) &&
                !holidays.some(h => new Date(h.date).getDate() === day)) {
                workingDays++;
            }
        }

        console.log("[SALARY_GENERATE] Working days calculated", {
            daysInMonth,
            workingDays,
            weekendDays
        });

        // 3. ALLOWANCE CALCULATION
        console.log("[SALARY_GENERATE] Starting allowance calculation phase");
        
        const hraAmount = (baseSalary * salaryParams.hraPercentage) / 100;
        const daAmount = (baseSalary * salaryParams.daPercentage) / 100;
        const taAmount = (baseSalary * salaryParams.taPercentage) / 100;

        const additionalAllowances = salaryParams.additionalAllowances || {};
        let totalAdditionalAllowances = 0;

        Object.values(additionalAllowances).forEach(amount => {
            totalAdditionalAllowances += parseFloat(amount);
        });

        const allowances = {
            hra: hraAmount,
            da: daAmount,
            ta: taAmount,
            ...additionalAllowances
        };

        const totalAllowances = hraAmount + daAmount + taAmount + totalAdditionalAllowances;

        console.log("[SALARY_GENERATE] Allowances calculated", {
            hraAmount,
            daAmount,
            taAmount,
            additionalAllowancesCount: Object.keys(additionalAllowances).length,
            totalAdditionalAllowances,
            totalAllowances
        });

        // 4. WORKING DAYS AND ATTENDANCE ANALYSIS
        console.log("[SALARY_GENERATE] Starting attendance analysis phase");
        
        // Count present days
        const presentDays = new Set(
            attendanceRecords
                .filter(record => record.status === "PRESENT")
                .map(record => new Date(record.date).getDate())
        ).size;

        // Count half days
        const halfDays = attendanceRecords.filter(record => record.status === "HALF_DAY").length;

        // Calculate absent days (excluding paid leaves)
        let absentDays = workingDays - presentDays - (halfDays / 2);

        console.log("[SALARY_GENERATE] Attendance calculated", {
            presentDays,
            halfDays,
            initialAbsentDays: absentDays
        });

        // Count days on paid leave
        let paidLeaveDays = 0;
        leaveRequests.forEach(leave => {
            if (leave.leaveType.isPaid) {
                const startDate = new Date(leave.startDate);
                const endDate = new Date(leave.endDate);

                // Count days in the current month
                for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    if (d.getMonth() + 1 === parseInt(month) && d.getFullYear() === parseInt(year)) {
                        const dayOfWeek = d.getDay();
                        if (!weekendDays.includes(dayOfWeek) &&
                            !holidays.some(h => new Date(h.date).toDateString() === d.toDateString())) {
                            paidLeaveDays++;
                        }
                    }
                }
            }
        });

        console.log("[SALARY_GENERATE] Paid leave days calculated", { paidLeaveDays });

        // Adjust absent days accounting for paid leave
        absentDays = Math.max(0, absentDays - paidLeaveDays);

        console.log("[SALARY_GENERATE] Final absent days after paid leave adjustment", { 
            absentDays,
            paidLeaveDays
        });

        // 5. LEAVE AND ABSENCE DEDUCTION
        console.log("[SALARY_GENERATE] Starting absence deduction calculation");
        
        const perDaySalary = workingDays > 0 ? baseSalary / workingDays : 0;
        const absenceDeduction = absentDays * perDaySalary;

        console.log("[SALARY_GENERATE] Absence deduction calculated", {
            perDaySalary,
            absentDays,
            absenceDeduction
        });

        // 6. STANDARD DEDUCTIONS
        console.log("[SALARY_GENERATE] Starting standard deductions calculation");
        
        const pfAmount = (baseSalary * salaryParams.pfPercentage) / 100;
        const taxAmount = (baseSalary * salaryParams.taxPercentage) / 100;
        const insuranceAmount = salaryParams.insuranceFixed;

        // Additional custom deductions
        const additionalDeductions = salaryParams.additionalDeductions || {};
        let totalAdditionalDeductions = 0;

        Object.values(additionalDeductions).forEach(amount => {
            totalAdditionalDeductions += parseFloat(amount);
        });

        const deductions = {
            pf: pfAmount,
            tax: taxAmount,
            insurance: insuranceAmount,
            absence: absenceDeduction,
            ...additionalDeductions
        };

        const totalDeductions = pfAmount + taxAmount + insuranceAmount + absenceDeduction + totalAdditionalDeductions;

        console.log("[SALARY_GENERATE] Deductions calculated", {
            pfAmount,
            taxAmount,
            insuranceAmount,
            absenceDeduction,
            additionalDeductionsCount: Object.keys(additionalDeductions).length,
            totalAdditionalDeductions,
            totalDeductions
        });

        // 7. FINAL CALCULATION
        const netSalary = Math.max(0, baseSalary + totalAllowances - totalDeductions);

        console.log("[SALARY_GENERATE] Final salary calculated", {
            baseSalary,
            totalAllowances,
            totalDeductions,
            netSalary
        });

        // 8. RECORD CREATION
        const salaryRecord = await prisma.salaryRecord.create({
            data: {
                userId: targetUserId,
                month: parseInt(month),
                year: parseInt(year),
                basicSalary: baseSalary,
                netSalary: netSalary,
                tax: taxAmount,
                allowances: allowances,
                deductions: deductions,
                status: "PENDING",
                remarks: `Salary for ${new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'long' })} ${year}`
            }
        });

        console.log("[SALARY_GENERATE] Salary record created successfully", {
            salaryRecordId: salaryRecord.id,
            userId: targetUserId,
            month,
            year,
            status: salaryRecord.status
        });

        return res.status(201).json({
            success: true,
            message: "Salary generated successfully",
            data: salaryRecord
        });

    } catch (error) {
        console.error("[SALARY_GENERATE] Error generating salary:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate salary",
            error: error.message
        });
    }
};

/**
 * Get salary statistics based on salary record ID
 */
export const getSalaryStatisticsBasedOnId = async (req, res) => {
    try {
        const { salaryRecordId } = req.params;
        const currentUserId = req.user.id;

        if (!salaryRecordId) {
            return res.status(400).json({
                success: false,
                message: "Salary record ID is required"
            });
        }

        // Get the salary record with related data
        const salaryRecord = await prisma.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        managerId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!salaryRecord) {
            return res.status(404).json({
                success: false,
                message: "Salary record not found"
            });
        }

        // Permission check
        if (salaryRecord.user.id !== currentUserId) {
            // Check if user is authorized to view this salary record
            const hasManagerPermission = salaryRecord.user.managerId === currentUserId;

            const hasSubordinatePermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_of_subordinates"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            const hasAllPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_of_all"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            if (!(hasManagerPermission && hasSubordinatePermission) && !hasAllPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized access to this salary statistic"
                });
            }
        } else {
            // Check if user has permission to view their own salary slip
            const hasSelfPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_to_myself"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            if (!hasSelfPermission) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view your salary statistics"
                });
            }
        }

        // Fetch additional data needed for statistics
        const { month, year, userId } = salaryRecord;

        // Get organization settings for weekends
        const orgSettings = await prisma.organizationSettings.findFirst({
            where: {
                orgId: {
                    equals: (await prisma.user.findUnique({
                        where: { id: userId },
                        select: { orgId: true }
                    }))?.orgId
                }
            }
        });

        // Default weekend days (0 = Sunday, 6 = Saturday)
        const weekendDays = orgSettings?.settings?.weekendDays || [0, 6];

        // Get holidays for the month
        const holidays = await prisma.holiday.findMany({
            where: {
                orgId: {
                    equals: (await prisma.user.findUnique({
                        where: { id: userId },
                        select: { orgId: true }
                    }))?.orgId
                },
                date: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1)
                }
            }
        });

        // Get attendance records
        const attendanceRecords = await prisma.attendanceRecord.findMany({
            where: {
                userId: userId,
                verificationStatus : 'VERIFIED',
                date: {
                    gte: new Date(year, month - 1, 1),
                    lt: new Date(year, month, 1)
                }
            }
        });

        // Get approved leave requests
        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                userId: userId,
                status: "APPROVED",
                OR: [
                    {
                        startDate: {
                            gte: new Date(year, month - 1, 1),
                            lt: new Date(year, month, 1)
                        }
                    },
                    {
                        endDate: {
                            gte: new Date(year, month - 1, 1),
                            lt: new Date(year, month, 1)
                        }
                    }
                ]
            },
            include: {
                leaveType: true
            }
        });

        // Get previous month's salary record for comparison
        const previousMonth = month === 1 ? 12 : month - 1;
        const previousYear = month === 1 ? year - 1 : year;
        
        const previousSalaryRecord = await prisma.salaryRecord.findUnique({
            where: {
                userId_month_year: {
                    userId: userId,
                    month: previousMonth,
                    year: previousYear
                }
            }
        });

        // Get year-to-date earnings
        const ytdEarnings = await prisma.salaryRecord.findMany({
            where: {
                userId: userId,
                year: year,
                month: {
                    lte: month
                }
            },
            select: {
                netSalary: true
            }
        });

        const ytdTotal = ytdEarnings.reduce((sum, record) => sum + record.netSalary, 0);

        // Calculate attendance statistics
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Count working days
        let workingDays = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dayOfWeek = date.getDay();

            if (!weekendDays.includes(dayOfWeek) &&
                !holidays.some(h => new Date(h.date).getDate() === day)) {
                workingDays++;
            }
        }

        // Count present, half, and absent days
        const presentDays = new Set(
            attendanceRecords
                .filter(record => record.status === "PRESENT")
                .map(record => new Date(record.date).getDate())
        ).size;
        
        const halfDays = attendanceRecords.filter(record => record.status === "HALF_DAY").length;
        
        // Calculate leave days
        let paidLeaveDays = 0;
        let unpaidLeaveDays = 0;
        
        leaveRequests.forEach(leave => {
            const startDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            const isLeaveTypePaid = leave.leaveType.isPaid;
            
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                if (d.getMonth() + 1 === month && d.getFullYear() === year) {
                    const dayOfWeek = d.getDay();
                    if (!weekendDays.includes(dayOfWeek) &&
                        !holidays.some(h => new Date(h.date).toDateString() === d.toDateString())) {
                        if (isLeaveTypePaid) {
                            paidLeaveDays++;
                        } else {
                            unpaidLeaveDays++;
                        }
                    }
                }
            }
        });
        
        // Calculate absent days (excluding leaves)
        const absentDays = Math.max(0, workingDays - presentDays - (halfDays / 2) - paidLeaveDays - unpaidLeaveDays);
        
        // Calculate attendance percentage
        const attendancePercentage = workingDays > 0 
            ? ((presentDays + (halfDays / 2) + paidLeaveDays) / workingDays) * 100 
            : 0;

        // Parse allowances and deductions from salary record
        const allowances = salaryRecord.allowances || {};
        const deductions = salaryRecord.deductions || {};
        
        // Calculate totals
        const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        
        // Format month name
        const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });

        // Format salary percentages
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

        // Prepare response object
        const statistics = {
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
                totalDaysInMonth: daysInMonth,
                workingDays: workingDays,
                presentDays: presentDays,
                halfDays: halfDays,
                absentDays: absentDays,
                paidLeaveDays: paidLeaveDays,
                unpaidLeaveDays: unpaidLeaveDays,
                attendancePercentage: parseFloat(attendancePercentage.toFixed(2))
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

        return res.status(200).json({
            success: true,
            data: statistics
        });

    } catch (error) {
        console.error("Error fetching salary statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch salary statistics",
            error: error.message
        });
    }
};

/**
 * Download payslip as PDF based on salary record ID
 */
export const downloadPayslipAsPDF = async (req, res) => {
    try {
        const { salaryRecordId } = req.params;
        const currentUserId = req.user.id;

        if (!salaryRecordId) {
            return res.status(400).json({
                success: false,
                message: "Salary record ID is required"
            });
        }

        // Get the salary record with related data
        const salaryRecord = await prisma.salaryRecord.findUnique({
            where: { id: salaryRecordId },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true,
                        managerId: true,
                        email: true,
                        department: {
                            select: {
                                name: true
                            }
                        },
                        organization: {
                            select: {
                                name: true,
                                logo: true,
                                address: true
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
            }
        });

        if (!salaryRecord) {
            return res.status(404).json({
                success: false,
                message: "Salary record not found"
            });
        }

        // Permission check
        if (salaryRecord.user.id !== currentUserId) {
            // Check if user is authorized to download this payslip
            const hasManagerPermission = salaryRecord.user.managerId === currentUserId;

            const hasSubordinatePermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_of_subordinates"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            const hasAllPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_of_all"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            if (!(hasManagerPermission && hasSubordinatePermission) && !hasAllPermission) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized access to download this payslip"
                });
            }
        } else {
            // Check if user has permission to view their own payslip
            const hasSelfPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_salary_slip_to_myself"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });

            if (!hasSelfPermission) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to download your payslip"
                });
            }
        }

        // Import PDF document creation libraries - using PDFKit
        const PDFDocument = await import('pdfkit');
        const { default: PDFDocumentInstance } = PDFDocument;

        // Create a document
        const doc = new PDFDocumentInstance({ margin: 50 });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payslip-${salaryRecord.month}-${salaryRecord.year}.pdf`);

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Format month name
        const monthName = new Date(salaryRecord.year, salaryRecord.month - 1, 1).toLocaleString('default', { month: 'long' });

        // Format currency
        const formatCurrency = (amount) => {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(amount);
        };

        // Parse allowances and deductions
        const allowances = salaryRecord.allowances || {};
        const deductions = salaryRecord.deductions || {};

        // Calculate totals
        const totalAllowances = Object.values(allowances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
        const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);

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

        // Employee details section
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

        // Salary Details section
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

        // Earnings table
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
        const totalEarnings = salaryRecord.basicSalary + totalAllowances + (salaryRecord.incentive || 0) + (salaryRecord.bonus || 0);
        doc.moveDown(0.5);
        earningsY = doc.y;
        doc.fontSize(10).text('Total Earnings', 50, earningsY, { font: 'Helvetica-Bold' });
        doc.fontSize(10).text(formatCurrency(totalEarnings), 250, earningsY, { align: 'right', font: 'Helvetica-Bold' });
        doc.moveDown();

        // Check if we need a new page for deductions
        if (doc.y > 700) {
            doc.addPage();
        } else {
            doc.moveDown();
        }

        // Deductions table
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
        doc.moveDown(0.5);
        deductionsY = doc.y;
        doc.fontSize(10).text('Total Deductions', 50, deductionsY, { font: 'Helvetica-Bold' });
        doc.fontSize(10).text(formatCurrency(totalDeductions + (salaryRecord.tax || 0)), 250, deductionsY, { align: 'right', font: 'Helvetica-Bold' });
        doc.moveDown();

        // Net Salary
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

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).text('This is a computer-generated document. No signature is required.', { align: 'center' });
        doc.fontSize(8).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

        // Finalize the PDF and end the stream
        doc.end();

    } catch (error) {
        console.error("Error generating payslip PDF:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate payslip PDF",
            error: error.message
        });
    }
};

/**
 * Check salary generation status for multiple employees
 */
export const checkMultiplePayslipStatus = async (req, res) => {
    try {
        const { userIds, month, year } = req.body;
        const currentUserId = req.user.id;
        
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "User IDs array is required"
            });
        }
        
        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: "Month and year are required"
            });
        }
        
        // Check if current user has permission to view these users' data
        // This can be a manager permission check or role-based access control
        const subordinates = await prisma.user.findMany({
            where: {
                id: { in: userIds },
                managerId: currentUserId
            },
            select: { id: true }
        });
        
        const allowedUserIds = subordinates.map(sub => sub.id);
        
        // Get all salary records for these users in the given month/year
        const salaryRecords = await prisma.salaryRecord.findMany({
            where: {
                userId: { in: allowedUserIds },
                month: parseInt(month),
                year: parseInt(year)
            },
            select: {
                userId: true,
                month: true,
                year: true,
                status: true
            }
        });
        
        // Create a map of user IDs to their salary status
        const statusMap = {};
        allowedUserIds.forEach(userId => {
            statusMap[userId] = {
                generated: false,
                status: null
            };
        });
        
        salaryRecords.forEach(record => {
            statusMap[record.userId] = {
                generated: true,
                status: record.status
            };
        });
        
        return res.status(200).json({
            success: true,
            data: statusMap
        });
    } catch (error) {
        console.error("Error checking multiple payslip status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to check payslip status",
            error: error.message
        });
    }
};