import prisma from "../../../db/connectDb.js";

const PERMISSIONS = {
    VIEW_ALL: "view_all_user_attendance",
    VIEW_SUBORDINATES: "view_subordinates_attendance"
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const buildActivityEntry = (record, type, timestamp) => {
    if (!timestamp) {
        return null;
    }

    const { user } = record;
    const fullName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

    return {
        id: `${record.id}:${type}`,
        recordId: record.id,
        userId: record.userId,
        userName: fullName || user?.email || "Unknown",
        employeeId: user?.employeeId || null,
        department: user?.department?.name || null,
        managerId: user?.managerId || null,
        sessionNumber: record.sessionNumber,
        status: record.status,
        type,
        timestamp,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        duration: record.duration,
        notes: record.notes,
        locations: {
            checkIn: record.checkInLocation,
            checkOut: record.checkOutLocation
        }
    };
};

const getUserPermissionKeys = async (userId) => {
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
            }
        }
    });

    const permissionKeys = new Set();

    user?.roles?.forEach((userRole) => {
        userRole.role?.permissions?.forEach((permissionLink) => {
            if (permissionLink.permission?.key) {
                permissionKeys.add(permissionLink.permission.key);
            }
        });
    });

    return permissionKeys;
};

export const getAttendanceActivity = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit: limitParam } = req.query;

        if (!req.user?.orgId || req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied",
                message: "You cannot view activity for another organization"
            });
        }

        const limit = Math.min(
            Math.max(parseInt(limitParam, 10) || DEFAULT_LIMIT, 1),
            MAX_LIMIT
        );

        const permissionKeys = await getUserPermissionKeys(req.user.id);
        const canViewAll = permissionKeys.has(PERMISSIONS.VIEW_ALL);
        const canViewSubordinates = permissionKeys.has(PERMISSIONS.VIEW_SUBORDINATES);

        let scope = "SELF";
        const whereClause = {
            user: {
                orgId
            }
        };

        let subordinateIds = [];

        if (canViewAll) {
            scope = "ORGANIZATION";
        } else if (canViewSubordinates) {
            subordinateIds = await prisma.user.findMany({
                where: {
                    managerId: req.user.id,
                    orgId
                },
                select: { id: true }
            });

            const ids = subordinateIds.map((entry) => entry.id);

            if (ids.length === 0) {
                return res.status(200).json({
                    success: true,
                    scope: "SUBORDINATES",
                    data: [],
                    pagination: {
                        limit,
                        total: 0
                    }
                });
            }

            whereClause.userId = { in: ids };
            scope = "SUBORDINATES";
        } else {
            whereClause.userId = req.user.id;
            scope = "SELF";
        }

        const records = await prisma.attendanceRecord.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        managerId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                checkInTime: "desc"
            },
            take: limit * 2
        });

        const activityEntries = records
            .flatMap((record) => [
                buildActivityEntry(record, "CHECK_IN", record.checkInTime),
                buildActivityEntry(record, "CHECK_OUT", record.checkOutTime)
            ])
            .filter(Boolean)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const limitedEntries = activityEntries.slice(0, limit);

        res.status(200).json({
            success: true,
            scope,
            data: limitedEntries,
            pagination: {
                limit,
                total: activityEntries.length
            }
        });
    } catch (error) {
        console.error("Error fetching attendance activity:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message || "Failed to fetch attendance activity"
        });
    }
};

export default {
    getAttendanceActivity
};
