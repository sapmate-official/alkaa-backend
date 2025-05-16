import prisma from "../../../db/connectDb.js";
import { format, differenceInDays, isAfter, isBefore, endOfMonth, startOfMonth } from 'date-fns';

/**
 * Get special events for the current user based on role and permissions
 */
export const getSpecialEvents = async (req, res) => {
    try {
        const userId = req.user.id;
        const events = [];
        const today = new Date();
        
        // Get user with roles and permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                },
                organization: {
                    select: { id: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const orgId = user.orgId;

        // Check user permissions
        const hasViewAllPermission = user.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        const isManager = user.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_subordinates_attendance'
            )
        );

        // 1. Get upcoming employee birthdays (next 7 days)
        let userFilter = {};
        if (hasViewAllPermission) {
            // Admin can see all users in organization
            userFilter = { orgId };
        } else if (isManager) {
            // Manager can see subordinates
            userFilter = { managerId: userId };
        } else {
            // Regular user can only see their own birthday
            userFilter = { id: userId };
        }

        const users = await prisma.user.findMany({
            where: {
                ...userFilter,
                dateOfBirth: { not: null },
                status: 'active'
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });

        // Process birthdays
        users.forEach(employee => {
            if (employee.dateOfBirth) {
                const birthDate = new Date(employee.dateOfBirth);
                const birthDay = birthDate.getDate();
                const birthMonth = birthDate.getMonth();
                
                // Create date for this year's birthday
                const thisBirthday = new Date(today.getFullYear(), birthMonth, birthDay);
                
                // If birthday has passed this year, look at next year
                if (isBefore(thisBirthday, today)) {
                    thisBirthday.setFullYear(today.getFullYear() + 1);
                }
                
                const daysToEvent = differenceInDays(thisBirthday, today);
                
                // Only include if birthday is within the next 7 days
                if (daysToEvent <= 7) {
                    events.push({
                        type: 'BIRTHDAY',
                        title: `${employee.firstName} ${employee.lastName}'s Birthday`,
                        description: `${employee.firstName}'s birthday is ${daysToEvent === 0 ? 'today' : `in ${daysToEvent} days`}!`,
                        date: thisBirthday,
                        priority: daysToEvent === 0 ? 'high' : 'medium',
                        entity: {
                            id: employee.id,
                            name: `${employee.firstName} ${employee.lastName}`,
                            department: employee.department?.name || 'Unassigned'
                        }
                    });
                }
            }
        });

        // 2. Check for pending bills if user is an admin
        if (hasViewAllPermission) {
            const pendingBills = await prisma.billingRecord.findMany({
                where: {
                    organizationId: orgId,
                    status: 'UNPAID',
                    dueDate: {
                        lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) // Due in the next 7 days
                    }
                },
                orderBy: {
                    dueDate: 'asc'
                }
            });

            pendingBills.forEach(bill => {
                const daysToEvent = differenceInDays(new Date(bill.dueDate), today);
                const priority = daysToEvent <= 2 ? 'high' : 'medium';
                
                events.push({
                    type: 'BILL',
                    title: `Pending Bill for ${format(new Date(bill.year, bill.month - 1), 'MMMM yyyy')}`,
                    description: `Bill payment due ${daysToEvent <= 0 ? 'today' : `in ${daysToEvent} days`}`,
                    date: new Date(bill.dueDate),
                    priority: priority,
                    entity: {
                        id: bill.id,
                        amount: bill.totalAmount,
                        month: bill.month,
                        year: bill.year
                    }
                });
            });
        }

        // 3. Check for pending leave requests
        if (isManager ) {
            // Filter based on role
            const leaveFilter = hasViewAllPermission 
                ? { user: { orgId } } 
                : { user: { managerId: userId } };
            
            const pendingLeaves = await prisma.leaveRequest.findMany({
                where: {
                    ...leaveFilter,
                    status: 'PENDING'
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            department: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    },
                    leaveType: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    startDate: 'asc'
                }
            });

            pendingLeaves.forEach(leave => {
                const startDate = new Date(leave.startDate);
                const daysToEvent = differenceInDays(startDate, today);
                
                // Prioritize leaves starting soon
                const priority = daysToEvent <= 2 ? 'high' : 'medium';
                
                events.push({
                    type: 'LEAVE_REQUEST',
                    title: `Pending Leave Request from ${leave.user.firstName}`,
                    description: `${leave.user.firstName} ${leave.user.lastName} has requested ${leave.leaveType.name} leave starting ${daysToEvent <= 0 ? 'today' : `in ${daysToEvent} days`}`,
                    date: startDate,
                    priority: priority,
                    entity: {
                        id: leave.id,
                        userId: leave.userId,
                        name: `${leave.user.firstName} ${leave.user.lastName}`,
                        department: leave.user.department?.name || 'Unassigned',
                        leaveType: leave.leaveType.name,
                        startDate: leave.startDate,
                        endDate: leave.endDate
                    }
                });
            });
        }

        // 4. Month-end attendance verification reminder (last 3 days of month)
        const endOfCurrentMonth = endOfMonth(today);
        const daysToMonthEnd = differenceInDays(endOfCurrentMonth, today);
        
        if (daysToMonthEnd <= 3) {
            // For managers: Remind to verify subordinates' attendance
            if (isManager || hasViewAllPermission) {
                // Get unverified attendance records for this month
                const unverifiedFilter = hasViewAllPermission 
                    ? { user: { orgId } } 
                    : { user: { managerId: userId } };
                
                const unverifiedCount = await prisma.attendanceRecord.count({
                    where: {
                        ...unverifiedFilter,
                        date: {
                            gte: startOfMonth(today),
                            lte: endOfCurrentMonth
                        },
                        verificationStatus: { not: 'VERIFIED' }
                    }
                });
                
                if (unverifiedCount > 0) {
                    events.push({
                        type: 'MONTH_END_VERIFICATION',
                        title: 'Month-End Attendance Verification',
                        description: `${unverifiedCount} attendance records need verification before month end (${daysToMonthEnd} days left)`,
                        date: endOfCurrentMonth,
                        priority: 'high',
                        entity: {
                            count: unverifiedCount,
                            month: today.getMonth() + 1,
                            year: today.getFullYear()
                        }
                    });
                }
            }
            
            // For all users: Remind to complete their own attendance
            const userIncompleteCount = await prisma.attendanceRecord.count({
                where: {
                    userId,
                    date: {
                        gte: startOfMonth(today),
                        lte: endOfCurrentMonth
                    },
                    checkOutTime: null
                }
            });
            
            if (userIncompleteCount > 0) {
                events.push({
                    type: 'INCOMPLETE_ATTENDANCE',
                    title: 'Incomplete Attendance Records',
                    description: `You have ${userIncompleteCount} incomplete attendance records this month. Please complete before month end.`,
                    date: endOfCurrentMonth,
                    priority: 'high',
                    entity: {
                        count: userIncompleteCount,
                        month: today.getMonth() + 1,
                        year: today.getFullYear()
                    }
                });
            }
        }

        // Sort events by priority and date
        events.sort((a, b) => {
            // Priority sorting (high > medium > low)
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            
            if (priorityDiff !== 0) return priorityDiff;
            
            // Then sort by date (closest first)
            return new Date(a.date) - new Date(b.date);
        });

        return res.status(200).json({
            success: true,
            data: events
        });

    } catch (error) {
        console.error("Error fetching special events:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch special events",
            error: error.message
        });
    }
};
