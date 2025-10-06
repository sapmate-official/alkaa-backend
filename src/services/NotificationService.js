import prisma from "../db/connectDb.js";

const VIOLATION_ALERT_TYPE = "GEOFENCE_VIOLATION";
const VIOLATION_RESOLVED_ALERT_TYPE = "GEOFENCE_VIOLATION_RESOLVED";

class NotificationService {
    mapSeverityToPriority(severity) {
        switch ((severity || "").toUpperCase()) {
            case "CRITICAL":
                return "CRITICAL";
            case "HIGH":
                return "HIGH";
            case "MEDIUM":
                return "MEDIUM";
            default:
                return "LOW";
        }
    }

    buildViolationMessage(violation) {
        const geofenceName = violation?.metadata?.nearestGeofenceName ?? violation?.metadata?.geofenceName;
        const distance = violation?.metadata?.distanceFromGeofence ?? violation?.distance;
        const distanceText = Number.isFinite(distance) ? `${Math.round(distance)}m` : "outside";

        if (geofenceName) {
            return `Geofence violation detected near ${geofenceName} (${distanceText} away).`;
        }
        return "Geofence violation detected outside the allowed area.";
    }

    buildResolutionMessage(violation) {
        const geofenceName = violation?.metadata?.nearestGeofenceName ?? violation?.metadata?.geofenceName;
        if (geofenceName) {
            return `Violation for ${geofenceName} has been resolved.`;
        }
        return "Geofence violation has been resolved.";
    }

    async sendViolationAlert(violation) {
        try {
            if (!violation?.userId) {
                return null;
            }

            const priority = this.mapSeverityToPriority(violation.severity);
            const message = this.buildViolationMessage(violation);

            return await prisma.attendanceAlert.create({
                data: {
                    userId: violation.userId,
                    alertType: VIOLATION_ALERT_TYPE,
                    priority,
                    message,
                    data: {
                        violationId: violation.id,
                        sessionId: violation.sessionId,
                        geofenceId: violation.geofenceId,
                        metadata: violation.metadata,
                        severity: violation.severity
                    }
                }
            });
        } catch (error) {
            console.error("Error sending violation alert:", error);
            return null;
        }
    }

    async sendViolationResolvedAlert(violation) {
        try {
            if (!violation?.userId) {
                return null;
            }

            const message = this.buildResolutionMessage(violation);

            await prisma.attendanceAlert.create({
                data: {
                    userId: violation.userId,
                    alertType: VIOLATION_RESOLVED_ALERT_TYPE,
                    priority: "LOW",
                    message,
                    data: {
                        violationId: violation.id,
                        resolvedAt: violation.resolvedAt,
                        resolutionType: violation.resolutionType,
                        resolutionNote: violation.resolutionNote
                    }
                }
            });

            await prisma.attendanceAlert.updateMany({
                where: {
                    userId: violation.userId,
                    alertType: VIOLATION_ALERT_TYPE,
                    data: {
                        path: ["violationId"],
                        equals: violation.id
                    },
                    isRead: false
                },
                data: {
                    isRead: true,
                    readAt: new Date()
                }
            });

            return true;
        } catch (error) {
            console.error("Error sending violation resolved alert:", error);
            return false;
        }
    }
}

export default NotificationService;
