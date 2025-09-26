import prisma from "../../../../db/connectDb.js";

/**
 * Process pending leave adjustments that need compensation
 */
export async function processLeaveAdjustments(targetUserId, currentSalaryKey, client = prisma) {
    let adjustmentAmount = 0;
    const [yearPart, monthPart] = currentSalaryKey.split('-');
    const evaluationStart = new Date(parseInt(yearPart), parseInt(monthPart) - 2, 1);

    const userOrg = await client.user.findUnique({
        where: { id: targetUserId },
        select: { orgId: true }
    });

    const orgId = userOrg?.orgId;
    if (!orgId) {
        return adjustmentAmount;
    }

    // Check for late leave approvals that need compensation
    const pendingLeaveAdjustments = await client.leaveRequest.findMany({
        where: {
            userId: targetUserId,
            status: "APPROVED",
            approvedAt: {
                gte: evaluationStart,
            },
            OR: [
                { contributedToSalary: { equals: null } },
                { contributedToSalary: { not: { path: [currentSalaryKey], equals: "adjustment" } } }
            ]
        },
        include: {
            leaveType: true
        }
    });

    for (const leave of pendingLeaveAdjustments) {
        if (!leave.approvedAt) {
            continue;
        }

        const leaveStartDate = new Date(leave.startDate);
        const leaveEndDate = new Date(leave.endDate);
        const approvedDate = new Date(leave.approvedAt);
        
        // Check if this leave was approved after any salary was generated
        const affectedSalaryRecords = await client.salaryRecord.findMany({
            where: {
                userId: targetUserId,
                createdAt: { lt: approvedDate },
                OR: [
                    {
                        year: leaveStartDate.getFullYear(),
                        month: { gte: leaveStartDate.getMonth() + 1, lte: leaveEndDate.getMonth() + 1 }
                    }
                ]
            }
        });

        // Calculate compensation for each affected salary record
        for (const salaryRecord of affectedSalaryRecords) {
            const salaryMonthKey = `${salaryRecord.year}-${salaryRecord.month.toString().padStart(2, '0')}`;
            const contributedToSalary = leave.contributedToSalary || {};
            
            // Skip if already processed for this month
            if (contributedToSalary[salaryMonthKey] === "adjustment") {
                continue;
            }

            // Calculate working days and compensation
            const compensation = await calculateLeaveCompensation(leave, salaryRecord, orgId, client);
            adjustmentAmount += compensation;

            // Update contribution tracking
            await updateLeaveContributionTracking(leave.id, salaryMonthKey, client);
        }
    }

    return adjustmentAmount;
}

/**
 * Process pending attendance adjustments that need compensation
 */
export async function processAttendanceAdjustments(targetUserId, currentSalaryKey, client = prisma) {
    let adjustmentAmount = 0;
    const [yearPart, monthPart] = currentSalaryKey.split('-');
    const evaluationStart = new Date(parseInt(yearPart), parseInt(monthPart) - 2, 1);

    const userOrg = await client.user.findUnique({
        where: { id: targetUserId },
        select: { orgId: true }
    });

    const orgId = userOrg?.orgId;
    if (!orgId) {
        return adjustmentAmount;
    }

    // Check for late attendance verifications that need compensation  
    const pendingAttendanceAdjustments = await client.attendanceRecord.findMany({
        where: {
            userId: targetUserId,
            verificationStatus: "VERIFIED",
            verifiedAt: {
                gte: evaluationStart,
            },
            OR: [
                { contributedToSalary: { equals: null } },
                { contributedToSalary: { not: { path: [currentSalaryKey], equals: "adjustment" } } }
            ]
        }
    });

    for (const attendance of pendingAttendanceAdjustments) {
        if (!attendance.verifiedAt) {
            continue;
        }

        const attendanceDate = new Date(attendance.date);
        const verifiedDate = new Date(attendance.verifiedAt);
        
        // Find affected salary record
        const affectedSalaryRecord = await client.salaryRecord.findFirst({
            where: {
                userId: targetUserId,
                createdAt: { lt: verifiedDate },
                month: attendanceDate.getMonth() + 1,
                year: attendanceDate.getFullYear()
            }
        });

        if (affectedSalaryRecord) {
            const salaryMonthKey = `${affectedSalaryRecord.year}-${affectedSalaryRecord.month.toString().padStart(2, '0')}`;
            const contributedToSalary = attendance.contributedToSalary || {};
            
            // Skip if already processed
            if (contributedToSalary[salaryMonthKey] === "adjustment") {
                continue;
            }

            // Calculate compensation
            const compensation = await calculateAttendanceCompensation(attendance, affectedSalaryRecord, orgId, client);
            adjustmentAmount += compensation;

            // Update contribution tracking
            await updateAttendanceContributionTracking(attendance.id, salaryMonthKey, client);
        }
    }

    return adjustmentAmount;
}

/**
 * Calculate leave compensation amount
 */
async function calculateLeaveCompensation(leave, salaryRecord, orgId, client) {
    if (!leave.leaveType.isPaid) {
        return 0; // No compensation for unpaid leave
    }

    // Get working days for affected salary month
    const salaryMonthStart = new Date(salaryRecord.year, salaryRecord.month - 1, 1);
    const salaryMonthEnd = new Date(salaryRecord.year, salaryRecord.month, 0);
    const salaryMonthDays = salaryMonthEnd.getDate();
    
    // Get holidays and weekend settings for that month
    const salaryMonthHolidays = await client.holiday.findMany({
        where: {
            orgId,
            date: {
                gte: salaryMonthStart,
                lt: new Date(salaryRecord.year, salaryRecord.month, 1)
            }
        }
    });

    const orgSettings = await client.organizationSettings.findFirst({
        where: {
            orgId
        }
    });

    const weekendDays = orgSettings?.settings?.weekoff || [0, 6];

    // Calculate working days for that month
    let salaryMonthWorkingDays = 0;
    for (let day = 1; day <= salaryMonthDays; day++) {
        const date = new Date(salaryRecord.year, salaryRecord.month - 1, day);
        const dayOfWeek = date.getDay();

        if (!weekendDays.includes(dayOfWeek) &&
            !salaryMonthHolidays.some(h => new Date(h.date).getDate() === day)) {
            salaryMonthWorkingDays++;
        }
    }

    if (salaryMonthWorkingDays === 0) {
        return 0;
    }

    // Calculate days that need compensation in this salary month
    const leaveStartDate = new Date(leave.startDate);
    const leaveEndDate = new Date(leave.endDate);
    let compensationDays = 0;

    let currentDate = new Date(Math.max(leaveStartDate.getTime(), salaryMonthStart.getTime()));
    const endDate = new Date(Math.min(leaveEndDate.getTime(), salaryMonthEnd.getTime()));

    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const isWeekend = weekendDays.includes(dayOfWeek);
        const isHoliday = salaryMonthHolidays.some(h => 
            new Date(h.date).toDateString() === currentDate.toDateString()
        );

        if (!isWeekend && !isHoliday) {
            compensationDays++;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate compensation amount
    const perDaySalary = salaryRecord.basicSalary / salaryMonthWorkingDays;
    return compensationDays * perDaySalary;
}

/**
 * Calculate attendance compensation amount
 */
async function calculateAttendanceCompensation(attendance, salaryRecord, orgId, client) {
    // Get working days for affected salary month
    const salaryMonthStart = new Date(salaryRecord.year, salaryRecord.month - 1, 1);
    const salaryMonthEnd = new Date(salaryRecord.year, salaryRecord.month, 0);
    const salaryMonthDays = salaryMonthEnd.getDate();
    
    // Get organization settings and holidays
    const salaryMonthHolidays = await client.holiday.findMany({
        where: {
            orgId,
            date: {
                gte: salaryMonthStart,
                lt: new Date(salaryRecord.year, salaryRecord.month, 1)
            }
        }
    });

    const orgSettings = await client.organizationSettings.findFirst({
        where: {
            orgId
        }
    });

    const weekendDays = orgSettings?.settings?.weekoff || [0, 6];

    // Calculate working days for that month
    let salaryMonthWorkingDays = 0;
    for (let day = 1; day <= salaryMonthDays; day++) {
        const date = new Date(salaryRecord.year, salaryRecord.month - 1, day);
        const dayOfWeek = date.getDay();

        if (!weekendDays.includes(dayOfWeek) &&
            !salaryMonthHolidays.some(h => new Date(h.date).getDate() === day)) {
            salaryMonthWorkingDays++;
        }
    }

    if (salaryMonthWorkingDays === 0) {
        return 0;
    }

    // Calculate compensation (1 day or 0.5 day)
    const compensationDays = attendance.status === "HALF_DAY" ? 0.5 : 1;
    const perDaySalary = salaryRecord.basicSalary / salaryMonthWorkingDays;
    
    return compensationDays * perDaySalary;
}

/**
 * Update leave contribution tracking
 */
async function updateLeaveContributionTracking(leaveId, salaryMonthKey, client) {
    const leave = await client.leaveRequest.findUnique({
        where: { id: leaveId }
    });

    const updatedContribution = leave.contributedToSalary || {};
    updatedContribution[salaryMonthKey] = "adjustment";

    await client.leaveRequest.update({
        where: { id: leaveId },
        data: {
            contributedToSalary: updatedContribution
        }
    });
}

/**
 * Update attendance contribution tracking
 */
async function updateAttendanceContributionTracking(attendanceId, salaryMonthKey, client) {
    const attendance = await client.attendanceRecord.findUnique({
        where: { id: attendanceId }
    });

    const updatedContribution = attendance.contributedToSalary || {};
    updatedContribution[salaryMonthKey] = "adjustment";

    await client.attendanceRecord.update({
        where: { id: attendanceId },
        data: {
            contributedToSalary: updatedContribution
        }
    });
}
