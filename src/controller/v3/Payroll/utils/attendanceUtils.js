import prisma from "../../../../db/connectDb.js";

/**
 * Calculate working days for a given month and year
 */
export async function calculateWorkingDays(month, year, orgId, client = prisma) {
    // Get organization settings for weekends
    const orgSettings = await client.organizationSettings.findFirst({
        where: { orgId: orgId }
    });

    const weekendDays = orgSettings?.settings?.weekoff || [0, 6]; // Default: Sunday and Saturday

    // Get holidays for the month
    const holidays = await client.holiday.findMany({
        where: {
            orgId: orgId,
            date: {
                gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                lt: new Date(parseInt(year), parseInt(month), 1)
            }
        }
    });

    // Calculate working days
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(parseInt(year), parseInt(month) - 1, day);
        const dayOfWeek = date.getDay();

        if (!weekendDays.includes(dayOfWeek) &&
            !holidays.some(h => new Date(h.date).getDate() === day)) {
            workingDays++;
        }
    }

    return { workingDays, weekendDays, holidays };
}

/**
 * Calculate attendance statistics for a user
 */
export async function calculateAttendanceStats(userId, month, year, orgId, client = prisma) {
    const { workingDays, weekendDays, holidays } = await calculateWorkingDays(month, year, orgId, client);

    // Get attendance records
    const attendanceRecords = await client.attendanceRecord.findMany({
        where: {
            userId: userId,
            verificationStatus: 'VERIFIED',
            date: {
                gte: new Date(parseInt(year), parseInt(month) - 1, 1),
                lt: new Date(parseInt(year), parseInt(month), 1)
            }
        }
    });

    // Count present days (unique dates only)
    const presentDays = new Set(
        attendanceRecords
            .filter(record => record.status === "PRESENT")
            .map(record => new Date(record.date).getDate())
    ).size;

    // Count half days
    const halfDays = attendanceRecords.filter(record => record.status === "HALF_DAY").length;

    // Get approved leave requests
    const leaveRequests = await client.leaveRequest.findMany({
        where: {
            userId: userId,
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

    // Calculate paid leave days
    let paidLeaveDays = 0;
    let unpaidLeaveDays = 0;

    leaveRequests.forEach(leave => {
        if (leave.leaveType.isPaid) {
            const startDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            const currentMonth = parseInt(month);
            const currentYear = parseInt(year);
            
            let currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
                if (currentDate.getMonth() + 1 === currentMonth && 
                    currentDate.getFullYear() === currentYear) {
                    
                    const dayOfWeek = currentDate.getDay();
                    const isWeekend = weekendDays.includes(dayOfWeek);
                    const isHoliday = holidays.some(h => 
                        new Date(h.date).toDateString() === currentDate.toDateString()
                    );
                    
                    if (!isWeekend && !isHoliday) {
                        paidLeaveDays++;
                    }
                }
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
        } else {
            // Similar calculation for unpaid leave
            const startDate = new Date(leave.startDate);
            const endDate = new Date(leave.endDate);
            
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            const currentMonth = parseInt(month);
            const currentYear = parseInt(year);
            
            let currentDate = new Date(startDate);
            
            while (currentDate <= endDate) {
                if (currentDate.getMonth() + 1 === currentMonth && 
                    currentDate.getFullYear() === currentYear) {
                    
                    const dayOfWeek = currentDate.getDay();
                    const isWeekend = weekendDays.includes(dayOfWeek);
                    const isHoliday = holidays.some(h => 
                        new Date(h.date).toDateString() === currentDate.toDateString()
                    );
                    
                    if (!isWeekend && !isHoliday) {
                        unpaidLeaveDays++;
                    }
                }
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
    });

    // Calculate absent days (excluding paid leaves)
    let absentDays = workingDays - presentDays - (halfDays / 2) - paidLeaveDays;
    absentDays = Math.max(0, absentDays);

    // Calculate attendance percentage
    const attendancePercentage = workingDays > 0 
        ? ((presentDays + (halfDays / 2) + paidLeaveDays) / workingDays) * 100 
        : 0;

    return {
        workingDays,
        attendanceStats: {
            presentDays,
            halfDays,
            absentDays,
            paidLeaveDays,
            unpaidLeaveDays,
            attendancePercentage: parseFloat(attendancePercentage.toFixed(2))
        }
    };
}
