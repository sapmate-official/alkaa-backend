import prisma from '../../../db/connectDb.js';
import { getCurrentDate } from '../../../utils/date.js';

const dashboardController = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { roles: { include: { role: true } } }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const today = getCurrentDate();
        const orgId = user.orgId;

        // Get total employees count
        const totalEmployees = await prisma.user.count({
            where: { orgId: orgId }
        });

        // Get present employees count for today
        const presentToday = await prisma.attendanceRecord.count({
            where: {
                date: {
                    gte: new Date(today.setHours(0, 0, 0, 0)),
                    lte: new Date(today.setHours(23, 59, 59, 999))
                },
                status: 'PRESENT',
                user: { orgId: orgId }
            }
        });

        // Get pending leaves count
        const pendingLeaves = await prisma.leaveRequest.count({
            where: {
                status: 'PENDING',
                user: { orgId: orgId }
            }
        });

        // Get recent activities (last 5)
        const recentActivities = await prisma.leaveRequest.findMany({
            where: { user: { orgId: orgId } },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                },
                leaveType: {
                    select: { name: true }
                }
            }
        });

        // Get attendance stats for the last 7 days
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d;
        });

        const attendanceStats = await Promise.all(
            last7Days.map(async (date) => {
                const startOfDay = new Date(date.setHours(0, 0, 0, 0));
                const endOfDay = new Date(date.setHours(23, 59, 59, 999));

                const present = await prisma.attendanceRecord.count({
                    where: {
                        date: { gte: startOfDay, lte: endOfDay },
                        status: 'PRESENT',
                        user: { orgId: orgId }
                    }
                });

                const absent = totalEmployees - present;

                return {
                    date: startOfDay.toISOString().split('T')[0],
                    present,
                    absent
                };
            })
        );

        // Format recent activities
        const formattedActivities = recentActivities.map(activity => ({
            title: `${activity.user.firstName} ${activity.user.lastName} requested ${activity.leaveType.name} leave`,
            timestamp: activity.createdAt
        }));

        return res.status(200).json({
            totalEmployees,
            presentToday,
            pendingLeaves,
            recentActivities: formattedActivities,
            attendanceStats: attendanceStats.reverse() // Most recent first
        });

    } catch (error) {
        console.error('Dashboard Controller Error:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
};

export {
    dashboardController
};
