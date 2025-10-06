import prisma from "../../../db/connectDb.js";
import ContinuousTrackingService from "../../../services/attendance/ContinuousTrackingService.js";

const trackingService = new ContinuousTrackingService();

const normalizeLocationPayload = (rawLocation) => {
    if (!rawLocation || typeof rawLocation !== 'object') {
        return null;
    }

    const latitude = Number(rawLocation.latitude ?? rawLocation.lat);
    const longitude = Number(rawLocation.longitude ?? rawLocation.lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return null;
    }

    const accuracy = rawLocation.accuracy !== undefined ? Number(rawLocation.accuracy) : undefined;

    return {
        ...rawLocation,
        latitude,
        longitude,
        ...(accuracy !== undefined && Number.isFinite(accuracy) ? { accuracy } : {})
    };
};

/**
 * Start continuous location tracking session
 * Called when employee checks in
 */
export const startTrackingSession = async (req, res) => {
    try {
        const { userId, attendanceId, location, workMode = 'OFFICE' } = req.body;

        const normalizedLocation = normalizeLocationPayload(location);
        if (!normalizedLocation) {
            return res.status(400).json({
                error: "Invalid location data",
                message: "Valid latitude and longitude are required"
            });
        }

        // Validate required fields
        if (!userId || !attendanceId) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "userId and attendanceId are required"
            });
        }

        const attendanceRecord = await prisma.attendanceRecord.findUnique({
            where: { id: attendanceId },
            include: {
                user: {
                    select: { id: true, orgId: true }
                }
            }
        });

        if (!attendanceRecord) {
            return res.status(404).json({
                error: "Attendance record not found",
                message: "Unable to find attendance reference for tracking session"
            });
        }

        if (attendanceRecord.userId !== userId) {
            return res.status(403).json({
                error: "Attendance mismatch",
                message: "Attendance record does not belong to provided user"
            });
        }

        const orgId = attendanceRecord.user.orgId;

        // Verify permissions
        if (req.user.orgId !== orgId || (req.user.id !== userId && req.user.orgId !== orgId)) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Get organization geofences
        const geofences = await prisma.organizationGeofence.findMany({
            where: {
                orgId,
                isActive: true
            }
        });

        // Start tracking session
        const session = await trackingService.startTrackingSession({
            userId,
            orgId,
            attendanceId,
            location: normalizedLocation,
            workMode, // OFFICE, OUTSTATION, REMOTE, CLIENT_SITE
            geofences
        });

        res.status(201).json({
            success: true,
            data: session,
            message: "Continuous tracking started successfully"
        });
    } catch (error) {
        console.error('Error starting tracking session:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to start tracking session"
        });
    }
};

/**
 * Process location update from mobile app
 * Called every 10 minutes by the app
 */
export const processLocationUpdate = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { location, isBreakActive = false, breakId = null } = req.body;

        const normalizedLocation = normalizeLocationPayload(location);
        if (!normalizedLocation) {
            return res.status(400).json({
                error: "Invalid location data",
                message: "Valid latitude and longitude are required"
            });
        }

        // Get tracking session
        const session = await prisma.trackingSession.findFirst({
            where: {
                id: sessionId,
                isActive: true,
                user: { orgId: req.user.orgId }
            },
            include: {
                user: true,
                attendance: true
            }
        });

        if (!session) {
            return res.status(404).json({
                error: "Active tracking session not found"
            });
        }

        if (req.user.id !== session.userId && req.user.orgId !== session.user.orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Process the location update
        const result = await trackingService.processLocationUpdate({
            session,
            location: normalizedLocation,
            isBreakActive,
            breakId,
            timestamp: new Date()
        });

        res.status(200).json({
            success: true,
            data: result,
            message: "Location update processed successfully"
        });
    } catch (error) {
        console.error('Error processing location update:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to process location update"
        });
    }
};

/**
 * Handle violation resolution
 * Called when employee comes back into geofence
 */
export const resolveViolation = async (req, res) => {
    try {
        const { violationId } = req.params;
        const { location, resolutionNote } = req.body;

        const violation = await prisma.geofenceViolation.findFirst({
            where: {
                id: violationId,
                user: { orgId: req.user.orgId },
                resolvedAt: null
            },
            include: {
                user: true
            }
        });

        if (!violation) {
            return res.status(404).json({
                error: "Active violation not found"
            });
        }

        // Verify user permission
        if (req.user.id !== violation.userId && req.user.orgId !== violation.user.orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const result = await trackingService.resolveViolation({
            violationId,
            location,
            resolutionNote,
            resolvedBy: req.user.id
        });

        res.status(200).json({
            success: true,
            data: result,
            message: "Violation resolved successfully"
        });
    } catch (error) {
        console.error('Error resolving violation:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to resolve violation"
        });
    }
};

/**
 * End tracking session
 * Called when employee checks out
 */
export const endTrackingSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { location, endReason = 'CHECKOUT' } = req.body;

        const session = await prisma.trackingSession.findFirst({
            where: {
                id: sessionId,
                isActive: true,
                user: { orgId: req.user.orgId }
            }
        });

        if (!session) {
            return res.status(404).json({
                error: "Active tracking session not found"
            });
        }

        const result = await trackingService.endTrackingSession({
            sessionId,
            location,
            endReason,
            endedBy: req.user.id
        });

        res.status(200).json({
            success: true,
            data: result,
            message: "Tracking session ended successfully"
        });
    } catch (error) {
        console.error('Error ending tracking session:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to end tracking session"
        });
    }
};

/**
 * Update work mode (for outstation work)
 * Called when employee switches to outstation mode
 */
export const updateWorkMode = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { workMode, outstation } = req.body;

        // Validate work mode
        const validModes = ['OFFICE', 'OUTSTATION', 'REMOTE', 'CLIENT_SITE'];
        if (!validModes.includes(workMode)) {
            return res.status(400).json({
                error: "Invalid work mode",
                message: `Work mode must be one of: ${validModes.join(', ')}`
            });
        }

        const session = await prisma.trackingSession.findFirst({
            where: {
                id: sessionId,
                isActive: true,
                user: { orgId: req.user.orgId }
            }
        });

        if (!session) {
            return res.status(404).json({
                error: "Active tracking session not found"
            });
        }

        const result = await trackingService.updateWorkMode({
            sessionId,
            workMode,
            outstation, // { location, description, approvedBy, validUntil }
            updatedBy: req.user.id
        });

        res.status(200).json({
            success: true,
            data: result,
            message: "Work mode updated successfully"
        });
    } catch (error) {
        console.error('Error updating work mode:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to update work mode"
        });
    }
};

/**
 * Get tracking session details
 */
export const getTrackingSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const session = await prisma.trackingSession.findFirst({
            where: {
                id: sessionId,
                user: { orgId: req.user.orgId }
            },
            include: {
                user: {
                    select: { firstName: true, lastName: true, employeeId: true }
                },
                attendance: {
                    select: { checkInTime: true, checkOutTime: true, status: true }
                },
                violations: {
                    where: { resolvedAt: null },
                    include: {
                        geofence: {
                            select: { name: true, type: true }
                        }
                    }
                },
                locationUpdates: {
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }
            }
        });

        if (!session) {
            return res.status(404).json({
                error: "Tracking session not found"
            });
        }

        res.status(200).json({
            success: true,
            data: session
        });
    } catch (error) {
        console.error('Error getting tracking session:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get tracking session"
        });
    }
};

/**
 * Get tracking analytics for organization
 */
export const getTrackingAnalytics = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { days = 30, userId, department } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        const analytics = await trackingService.getTrackingAnalytics({
            orgId,
            fromDate,
            userId,
            department
        });

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting tracking analytics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get tracking analytics"
        });
    }
};

// Helper function
async function getUserOrg(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true }
    });
    return user?.orgId;
}