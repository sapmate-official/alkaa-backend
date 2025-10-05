import prisma from "../../db/connectDb.js";
import GeofencingService from "./GeofencingService.js";
import NotificationService from "../NotificationService.js";

class ContinuousTrackingService {
    constructor() {
        this.geofencingService = new GeofencingService();
        this.notificationService = new NotificationService();
    }

    /**
     * Start a continuous tracking session when employee checks in
     */
    async startTrackingSession({ userId, orgId, attendanceId, location, workMode, geofences }) {
        try {
            // End any existing active sessions for this user
            await prisma.trackingSession.updateMany({
                where: {
                    userId,
                    isActive: true
                },
                data: {
                    isActive: false,
                    endTime: new Date(),
                    endReason: 'AUTO_ENDED'
                }
            });

            // Create new tracking session
            const session = await prisma.trackingSession.create({
                data: {
                    userId,
                    orgId,
                    attendanceId,
                    workMode,
                    startLocation: location,
                    currentLocation: location,
                    isActive: true,
                    startTime: new Date(),
                    settings: {
                        trackingInterval: 600000, // 10 minutes in ms
                        geofenceCheckInterval: 600000, // 10 minutes
                        violationNotificationEnabled: true,
                        breakTimeExemption: true
                    }
                }
            });

            // Store initial location update
            await this.createLocationUpdate({
                sessionId: session.id,
                location,
                isCompliant: true,
                validationNotes: 'Initial check-in location'
            });

            // If work mode is OFFICE, validate initial location against geofences
            if (workMode === 'OFFICE') {
                const validationResult = await this.validateLocationAgainstGeofences({
                    location,
                    geofences,
                    orgId
                });

                if (!validationResult.isCompliant) {
                    // Create initial violation if check-in is outside geofence
                    await this.createGeofenceViolation({
                        sessionId: session.id,
                        userId,
                        location,
                        violationType: 'CHECK_IN_OUTSIDE_GEOFENCE',
                        severity: 'MEDIUM',
                        geofenceId: validationResult.nearestGeofence?.id
                    });
                }
            }

            return {
                ...session,
                initialCompliance: workMode === 'OFFICE' ? await this.validateLocationAgainstGeofences({ location, geofences, orgId }) : { isCompliant: true }
            };
        } catch (error) {
            console.error('Error starting tracking session:', error);
            throw error;
        }
    }

    /**
     * Process location update from mobile app (called every 10 minutes)
     */
    async processLocationUpdate({ session, location, isBreakActive, breakId, timestamp }) {
        try {
            const { id: sessionId, userId, orgId, workMode } = session;
            
            // Update session's current location
            await prisma.trackingSession.update({
                where: { id: sessionId },
                data: {
                    currentLocation: location,
                    lastLocationUpdate: timestamp
                }
            });

            // Determine if location validation should be skipped
            const shouldSkipValidation = await this.shouldSkipLocationValidation({
                userId,
                orgId,
                isBreakActive,
                breakId,
                workMode,
                timestamp
            });

            let validationResult = { isCompliant: true, reason: 'VALIDATION_SKIPPED' };
            let violationCreated = null;

            // Only validate location if not skipped
            if (!shouldSkipValidation && workMode === 'OFFICE') {
                // Get active geofences
                const geofences = await prisma.organizationGeofence.findMany({
                    where: {
                        orgId,
                        isActive: true
                    }
                });

                validationResult = await this.validateLocationAgainstGeofences({
                    location,
                    geofences,
                    orgId
                });

                // Handle geofence violation
                if (!validationResult.isCompliant) {
                    violationCreated = await this.handleGeofenceViolation({
                        sessionId,
                        userId,
                        location,
                        validationResult,
                        isBreakActive,
                        timestamp
                    });
                } else {
                    // Check if there are any unresolved violations to auto-resolve
                    await this.autoResolveViolations({
                        sessionId,
                        userId,
                        location,
                        timestamp
                    });
                }
            }

            // Store location update record
            const locationUpdate = await this.createLocationUpdate({
                sessionId,
                location,
                isCompliant: validationResult.isCompliant,
                validationNotes: validationResult.reason || validationResult.message,
                isBreakActive,
                breakId,
                validationSkipped: shouldSkipValidation
            });

            return {
                locationUpdate,
                validation: validationResult,
                violation: violationCreated,
                skippedValidation: shouldSkipValidation
            };
        } catch (error) {
            console.error('Error processing location update:', error);
            throw error;
        }
    }

    /**
     * Determine if location validation should be skipped
     */
    async shouldSkipLocationValidation({ userId, orgId, isBreakActive, breakId, workMode, timestamp }) {
        try {
            // Skip validation for non-office work modes
            if (workMode !== 'OFFICE') {
                return true;
            }

            // Skip validation during approved break time
            if (isBreakActive && breakId) {
                const breakRecord = await prisma.breakRecord.findUnique({
                    where: { id: breakId },
                    include: {
                        user: {
                            include: {
                                organization: {
                                    include: {
                                        OrganizationSettings: true
                                    }
                                }
                            }
                        }
                    }
                });

                if (breakRecord && !breakRecord.endTime) {
                    // Check break policies to see if geofence compliance is required during breaks
                    const breakPolicies = breakRecord.user.organization.OrganizationSettings?.[0]?.breakPolicies;
                    const requireGeofenceComplianceDuringBreaks = breakPolicies?.requireGeofenceComplianceDuringBreaks || false;
                    
                    if (!requireGeofenceComplianceDuringBreaks) {
                        return true;
                    }
                }
            }

            // Skip validation during specified non-work hours
            const hour = timestamp.getHours();
            const isWeekend = timestamp.getDay() === 0 || timestamp.getDay() === 6;
            
            // Get organization work hours
            const orgSettings = await prisma.organizationSettings.findFirst({
                where: { orgId }
            });

            const workHours = orgSettings?.workHours || { start: 9, end: 18, weekendsOff: true };
            
            if (isWeekend && workHours.weekendsOff) {
                return true;
            }

            if (hour < workHours.start || hour >= workHours.end) {
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error checking validation skip conditions:', error);
            return false; // Default to not skipping validation
        }
    }

    /**
     * Validate location against organization geofences
     */
    async validateLocationAgainstGeofences({ location, geofences, orgId }) {
        try {
            if (!geofences || geofences.length === 0) {
                return {
                    isCompliant: false,
                    reason: 'NO_GEOFENCES_CONFIGURED',
                    message: 'No geofences configured for organization'
                };
            }

            const latitude = Number(location.latitude ?? location.lat);
            const longitude = Number(location.longitude ?? location.lng);

            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return {
                    isCompliant: false,
                    nearestGeofence: null,
                    distanceToNearest: Infinity,
                    reason: 'INVALID_LOCATION',
                    message: 'Invalid coordinates provided for location validation.'
                };
            }

            let matchedGeofence = null;

            for (const geofence of geofences) {
                const validation = this.geofencingService.isWithinGeofence(latitude, longitude, geofence);
                if (validation.valid) {
                    matchedGeofence = {
                        geofence,
                        validation
                    };
                    break;
                }
            }

            const nearestGeofence = await this.geofencingService.findNearestGeofence(latitude, longitude, geofences);
            const nearestDistance = Number.isFinite(nearestGeofence?.distance)
                ? Math.max(nearestGeofence.distance, 0)
                : Infinity;
            const roundedDistance = Number.isFinite(nearestDistance) ? Math.round(nearestDistance) : Infinity;

            if (matchedGeofence) {
                return {
                    isCompliant: true,
                    nearestGeofence: matchedGeofence.geofence,
                    distanceToNearest: 0,
                    reason: 'WITHIN_GEOFENCE',
                    message: `Location is within ${matchedGeofence.geofence.name}`,
                    deviation: matchedGeofence.validation.distance,
                    details: matchedGeofence.validation.details || null
                };
            }

            return {
                isCompliant: false,
                nearestGeofence: nearestGeofence || null,
                distanceToNearest: roundedDistance,
                reason: 'OUTSIDE_GEOFENCE',
                message: nearestGeofence
                    ? `Location is approximately ${roundedDistance}m outside ${nearestGeofence.name}`
                    : 'Location is outside all defined geofences',
                deviation: nearestDistance,
                details: nearestGeofence?.metrics || nearestGeofence?.geometry || null
            };
        } catch (error) {
            console.error('Error validating location against geofences:', error);
            throw error;
        }
    }

    /**
     * Handle geofence violation
     */
    async handleGeofenceViolation({ sessionId, userId, location, validationResult, isBreakActive, timestamp }) {
        try {
            // Check if there's already an active violation for this session
            const existingViolation = await prisma.geofenceViolation.findFirst({
                where: {
                    sessionId,
                    resolvedAt: null
                }
            });

            if (existingViolation) {
                // Update existing violation with new location
                return await prisma.geofenceViolation.update({
                    where: { id: existingViolation.id },
                    data: {
                        currentLocation: location,
                        lastViolationTime: timestamp,
                        violationCount: existingViolation.violationCount + 1
                    }
                });
            }

            // Create new violation
            const violation = await prisma.geofenceViolation.create({
                data: {
                    userId,
                    sessionId,
                    geofenceId: validationResult.nearestGeofence?.id,
                    violationType: isBreakActive ? 'OUTSIDE_DURING_BREAK' : 'OUTSIDE_DURING_WORK',
                    severity: this.calculateViolationSeverity(validationResult.distanceToNearest, isBreakActive),
                    startLocation: location,
                    currentLocation: location,
                    startTime: timestamp,
                    lastViolationTime: timestamp,
                    violationCount: 1,
                    isBreakRelated: isBreakActive,
                    metadata: {
                        distanceFromGeofence: validationResult.distanceToNearest,
                        nearestGeofenceName: validationResult.nearestGeofence?.name,
                        validationMessage: validationResult.message
                    }
                }
            });

            // Send notification to user and management
            await this.sendViolationNotification(violation);

            return violation;
        } catch (error) {
            console.error('Error handling geofence violation:', error);
            throw error;
        }
    }

    /**
     * Calculate violation severity based on distance and context
     */
    calculateViolationSeverity(distance, isBreakActive) {
        if (isBreakActive) {
            // More lenient during breaks
            if (distance <= 500) return 'LOW';
            if (distance <= 1000) return 'MEDIUM';
            return 'HIGH';
        } else {
            // Stricter during work hours
            if (distance <= 200) return 'LOW';
            if (distance <= 500) return 'MEDIUM';
            return 'HIGH';
        }
    }

    /**
     * Auto-resolve violations when user comes back into geofence
     */
    async autoResolveViolations({ sessionId, userId, location, timestamp }) {
        try {
            const activeViolations = await prisma.geofenceViolation.findMany({
                where: {
                    sessionId,
                    resolvedAt: null
                }
            });

            for (const violation of activeViolations) {
                await prisma.geofenceViolation.update({
                    where: { id: violation.id },
                    data: {
                        resolvedAt: timestamp,
                        resolutionLocation: location,
                        resolutionType: 'AUTO_RESOLVED',
                        resolutionNote: 'Employee returned to approved geofence area'
                    }
                });

                // Send resolution notification
                await this.sendViolationResolvedNotification(violation);
            }

            return activeViolations.length;
        } catch (error) {
            console.error('Error auto-resolving violations:', error);
            throw error;
        }
    }

    /**
     * Manually resolve violation
     */
    async resolveViolation({ violationId, location, resolutionNote, resolvedBy }) {
        try {
            const violation = await prisma.geofenceViolation.update({
                where: { id: violationId },
                data: {
                    resolvedAt: new Date(),
                    resolutionLocation: location,
                    resolutionType: 'MANUAL',
                    resolutionNote,
                    resolvedBy
                }
            });

            await this.sendViolationResolvedNotification(violation);

            return violation;
        } catch (error) {
            console.error('Error resolving violation:', error);
            throw error;
        }
    }

    /**
     * Update work mode (for outstation work)
     */
    async updateWorkMode({ sessionId, workMode, outstation, updatedBy }) {
        try {
            const updateData = {
                workMode,
                updatedBy,
                updatedAt: new Date()
            };

            if (workMode === 'OUTSTATION' && outstation) {
                updateData.outstationData = {
                    location: outstation.location,
                    description: outstation.description,
                    approvedBy: outstation.approvedBy,
                    validFrom: new Date(),
                    validUntil: outstation.validUntil,
                    autoApproved: !outstation.approvedBy
                };
            }

            const session = await prisma.trackingSession.update({
                where: { id: sessionId },
                data: updateData
            });

            // If switching to outstation mode, auto-resolve any active violations
            if (workMode === 'OUTSTATION') {
                await prisma.geofenceViolation.updateMany({
                    where: {
                        sessionId,
                        resolvedAt: null
                    },
                    data: {
                        resolvedAt: new Date(),
                        resolutionType: 'OUTSTATION_MODE',
                        resolutionNote: 'Employee switched to outstation work mode',
                        resolvedBy: updatedBy
                    }
                });
            }

            return session;
        } catch (error) {
            console.error('Error updating work mode:', error);
            throw error;
        }
    }

    /**
     * End tracking session
     */
    async endTrackingSession({ sessionId, location, endReason, endedBy }) {
        try {
            // Update session
            const session = await prisma.trackingSession.update({
                where: { id: sessionId },
                data: {
                    isActive: false,
                    endTime: new Date(),
                    endLocation: location,
                    endReason,
                    endedBy
                }
            });

            // Auto-resolve any remaining violations
            await prisma.geofenceViolation.updateMany({
                where: {
                    sessionId,
                    resolvedAt: null
                },
                data: {
                    resolvedAt: new Date(),
                    resolutionType: 'SESSION_ENDED',
                    resolutionNote: 'Tracking session ended (check-out)',
                    resolvedBy: endedBy
                }
            });

            return session;
        } catch (error) {
            console.error('Error ending tracking session:', error);
            throw error;
        }
    }

    /**
     * Create location update record
     */
    async createLocationUpdate({ sessionId, location, isCompliant, validationNotes, isBreakActive, breakId, validationSkipped }) {
        try {
            return await prisma.locationUpdate.create({
                data: {
                    sessionId,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    accuracy: location.accuracy,
                    address: location.address,
                    timestamp: new Date(),
                    isCompliant,
                    validationNotes,
                    isBreakActive,
                    breakId,
                    validationSkipped: validationSkipped || false
                }
            });
        } catch (error) {
            console.error('Error creating location update:', error);
            throw error;
        }
    }

    /**
     * Send violation notification
     */
    async sendViolationNotification(violation) {
        try {
            // Implementation depends on your notification service
            console.log('Sending violation notification for:', violation.id);
            // await this.notificationService.sendViolationAlert(violation);
        } catch (error) {
            console.error('Error sending violation notification:', error);
        }
    }

    /**
     * Send violation resolved notification
     */
    async sendViolationResolvedNotification(violation) {
        try {
            console.log('Sending violation resolved notification for:', violation.id);
            // await this.notificationService.sendViolationResolvedAlert(violation);
        } catch (error) {
            console.error('Error sending violation resolved notification:', error);
        }
    }

    /**
     * Get tracking analytics
     */
    async getTrackingAnalytics({ orgId, fromDate, userId, department }) {
        try {
            const where = {
                orgId,
                startTime: { gte: fromDate }
            };

            if (userId) where.userId = userId;
            if (department) where.user = { departmentId: department };

            const sessions = await prisma.trackingSession.findMany({
                where,
                include: {
                    user: {
                        select: { firstName: true, lastName: true, departmentId: true }
                    },
                    violations: true,
                    locationUpdates: true,
                    attendance: {
                        select: { checkInTime: true, checkOutTime: true }
                    }
                }
            });

            // Calculate analytics
            const analytics = {
                totalSessions: sessions.length,
                totalViolations: 0,
                averageComplianceRate: 0,
                sessionsByWorkMode: {},
                violationsByType: {},
                complianceByDepartment: {},
                dailyTrends: {}
            };

            sessions.forEach(session => {
                // Count violations
                analytics.totalViolations += session.violations.length;

                // Work mode distribution
                if (!analytics.sessionsByWorkMode[session.workMode]) {
                    analytics.sessionsByWorkMode[session.workMode] = 0;
                }
                analytics.sessionsByWorkMode[session.workMode]++;

                // Violation types
                session.violations.forEach(violation => {
                    if (!analytics.violationsByType[violation.violationType]) {
                        analytics.violationsByType[violation.violationType] = 0;
                    }
                    analytics.violationsByType[violation.violationType]++;
                });

                // Daily trends
                const date = session.startTime.toISOString().split('T')[0];
                if (!analytics.dailyTrends[date]) {
                    analytics.dailyTrends[date] = { sessions: 0, violations: 0 };
                }
                analytics.dailyTrends[date].sessions++;
                analytics.dailyTrends[date].violations += session.violations.length;
            });

            // Calculate compliance rate
            const totalLocationUpdates = sessions.reduce((sum, s) => sum + s.locationUpdates.length, 0);
            const compliantUpdates = sessions.reduce((sum, s) => 
                sum + s.locationUpdates.filter(u => u.isCompliant || u.validationSkipped).length, 0
            );

            if (totalLocationUpdates > 0) {
                analytics.averageComplianceRate = Math.round((compliantUpdates / totalLocationUpdates) * 100);
            }

            return analytics;
        } catch (error) {
            console.error('Error getting tracking analytics:', error);
            throw error;
        }
    }
}

export default ContinuousTrackingService;