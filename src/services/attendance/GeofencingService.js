import prisma from "../../db/connectDb.js";

/**
 * Service for handling geofencing validation and location-based attendance
 * All geofencing features are disabled by default
 */
class GeofencingService {
    constructor() {
        this.validationMethods = ['POLYGON', 'RADIUS', 'COMBINED'];
        this.geofenceTypes = {
            MAIN_OFFICE: {
                priority: 1,
                strictMode: true,
                allowedDeviation: 50, // meters
                description: 'Primary office location'
            },
            BRANCH_OFFICE: {
                priority: 2,
                strictMode: false,
                allowedDeviation: 100,
                description: 'Branch office location'
            },
            CLIENT_SITE: {
                priority: 3,
                strictMode: false,
                temporaryAccess: true,
                requiresApproval: true,
                allowedDeviation: 150,
                description: 'Client site location'
            },
            REMOTE_ZONE: {
                priority: 4,
                strictMode: false,
                allowedDeviation: 500,
                requiresJustification: true,
                description: 'Approved remote work area'
            }
        };
    }

    /**
     * Validate location against organization geofences
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {string} organizationId - Organization ID
     * @param {string} userId - User ID
     * @param {string} actionType - Type of action (CHECK_IN, CHECK_OUT, etc.)
     * @returns {Object} Validation result
     */
    async validateLocation(lat, lng, organizationId, userId, actionType = 'CHECK_IN') {
        try {
            // Check if geofencing is enabled for organization
            const orgSettings = await prisma.organizationSettings.findFirst({
                where: { orgId: organizationId }
            });

            if (!orgSettings?.geofencingEnabled) {
                return {
                    valid: true,
                    reason: 'GEOFENCING_DISABLED',
                    geofence: null,
                    message: 'Geofencing is not enabled for this organization'
                };
            }

            const orgGeofences = await this.getOrganizationGeofences(organizationId);
            const userOverrides = await this.getUserLocationOverrides(userId);

            // Check against active geofences
            for (const geofence of orgGeofences) {
                if (!geofence.isActive) continue;

                const validationResult = this.isWithinGeofence(lat, lng, geofence);
                if (validationResult.valid) {
                    await this.logLocationValidation(null, lat, lng, geofence.id, true, 0, actionType);
                    return {
                        valid: true,
                        geofence: geofence,
                        deviation: validationResult.distance,
                        message: `Location validated against ${geofence.name}`
                    };
                }
            }

            // Check for remote work permissions
            if (userOverrides.remoteWorkEnabled) {
                const remoteValidation = await this.validateRemoteLocation(lat, lng, userOverrides);
                if (remoteValidation.valid) {
                    await this.logLocationValidation(null, lat, lng, null, true, 0, actionType);
                    return remoteValidation;
                }
            }

            // Find nearest geofence for better error message
            const nearestGeofence = await this.findNearestGeofence(lat, lng, orgGeofences);
            
            // Log violation
            await this.logGeofenceViolation(userId, null, lat, lng, nearestGeofence, actionType);
            await this.logLocationValidation(null, lat, lng, nearestGeofence?.id, false, 
                nearestGeofence?.distance || 0, actionType);

            return {
                valid: false,
                reason: 'OUTSIDE_GEOFENCE',
                nearestGeofence: nearestGeofence,
                message: nearestGeofence ? 
                    `Location is ${Math.round(nearestGeofence.distance)}m away from ${nearestGeofence.name}` :
                    'Location is outside all defined geofences',
                requiresApproval: true
            };

        } catch (error) {
            console.error('Error validating location:', error);
            return {
                valid: false,
                reason: 'VALIDATION_ERROR',
                message: 'Error occurred during location validation',
                error: error.message
            };
        }
    }

    /**
     * Get organization geofences
     * @param {string} organizationId - Organization ID
     * @returns {Array} List of geofences
     */
    async getOrganizationGeofences(organizationId) {
        try {
            return await prisma.organizationGeofence.findMany({
                where: { 
                    orgId: organizationId,
                    isActive: true // Only get active geofences
                },
                orderBy: [
                    { type: 'asc' }, // Main office first
                    { createdAt: 'desc' }
                ]
            });
        } catch (error) {
            console.error('Error fetching organization geofences:', error);
            return [];
        }
    }

    /**
     * Create geofence for organization
     * @param {string} orgId - Organization ID
     * @param {Object} geofenceData - Geofence configuration
     * @returns {Object} Created geofence
     */
    async createGeofence(orgId, geofenceData) {
        try {
            const {
                name,
                type,
                coordinates,
                radius,
                strictMode = false,
                allowedDeviation = 50,
                isActive = false // Default to disabled
            } = geofenceData;

            // Validate coordinates
            if (!this.validateCoordinates(coordinates, type)) {
                throw new Error('Invalid coordinates for geofence type');
            }

            return await prisma.organizationGeofence.create({
                data: {
                    orgId,
                    name,
                    type,
                    coordinates,
                    radius: radius ? parseFloat(radius) : null,
                    strictMode,
                    allowedDeviation: parseFloat(allowedDeviation),
                    isActive
                }
            });
        } catch (error) {
            console.error('Error creating geofence:', error);
            throw error;
        }
    }

    /**
     * Update geofence
     * @param {string} geofenceId - Geofence ID
     * @param {Object} updateData - Update data
     * @returns {Object} Updated geofence
     */
    async updateGeofence(geofenceId, updateData) {
        try {
            return await prisma.organizationGeofence.update({
                where: { id: geofenceId },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            console.error('Error updating geofence:', error);
            throw error;
        }
    }

    /**
     * Check if coordinates are within geofence
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} geofence - Geofence object
     * @returns {Object} Validation result with distance
     */
    isWithinGeofence(lat, lng, geofence) {
        try {
            if (geofence.radius) {
                // Circular geofence
                return this.isWithinCircularGeofence(lat, lng, geofence);
            } else {
                // Polygon geofence
                return this.isWithinPolygonGeofence(lat, lng, geofence);
            }
        } catch (error) {
            console.error('Error checking geofence:', error);
            return { valid: false, distance: Infinity };
        }
    }

    /**
     * Check if point is within circular geofence
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} geofence - Circular geofence
     * @returns {Object} Validation result
     */
    isWithinCircularGeofence(lat, lng, geofence) {
        const center = geofence.coordinates;
        const distance = this.calculateDistance(lat, lng, center.lat, center.lng);
        const effectiveRadius = geofence.radius + geofence.allowedDeviation;

        return {
            valid: distance <= effectiveRadius,
            distance: distance,
            allowedRadius: effectiveRadius
        };
    }

    /**
     * Check if point is within polygon geofence
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} geofence - Polygon geofence
     * @returns {Object} Validation result
     */
    isWithinPolygonGeofence(lat, lng, geofence) {
        const polygon = geofence.coordinates.points || [];
        const isInside = this.pointInPolygon([lat, lng], polygon);
        
        if (isInside) {
            return { valid: true, distance: 0 };
        }

        // Calculate distance to polygon edge
        const distanceToEdge = this.distanceToPolygon([lat, lng], polygon);
        const isWithinTolerance = distanceToEdge <= geofence.allowedDeviation;

        return {
            valid: isWithinTolerance,
            distance: distanceToEdge
        };
    }

    /**
     * Calculate distance between two points using Haversine formula
     * @param {number} lat1 - Latitude 1
     * @param {number} lng1 - Longitude 1
     * @param {number} lat2 - Latitude 2
     * @param {number} lng2 - Longitude 2
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }

    /**
     * Check if point is inside polygon using ray casting
     * @param {Array} point - [lat, lng]
     * @param {Array} polygon - Array of [lat, lng] points
     * @returns {boolean} True if inside polygon
     */
    pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Calculate distance from point to polygon
     * @param {Array} point - [lat, lng]
     * @param {Array} polygon - Array of [lat, lng] points
     * @returns {number} Distance in meters
     */
    distanceToPolygon(point, polygon) {
        let minDistance = Infinity;

        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const distance = this.distanceToLineSegment(point, polygon[i], polygon[j]);
            minDistance = Math.min(minDistance, distance);
        }

        return minDistance;
    }

    /**
     * Calculate distance from point to line segment
     * @param {Array} point - [lat, lng]
     * @param {Array} lineStart - [lat, lng]
     * @param {Array} lineEnd - [lat, lng]
     * @returns {number} Distance in meters
     */
    distanceToLineSegment(point, lineStart, lineEnd) {
        const [px, py] = point;
        const [x1, y1] = lineStart;
        const [x2, y2] = lineEnd;

        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        return this.calculateDistance(px, py, xx, yy);
    }

    /**
     * Find nearest geofence to given coordinates
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Array} geofences - List of geofences
     * @returns {Object|null} Nearest geofence with distance
     */
    async findNearestGeofence(lat, lng, geofences) {
        let nearest = null;
        let minDistance = Infinity;

        for (const geofence of geofences) {
            let distance;

            if (geofence.radius) {
                // Circular geofence
                const center = geofence.coordinates;
                distance = this.calculateDistance(lat, lng, center.lat, center.lng);
            } else {
                // Polygon geofence
                const polygon = geofence.coordinates.points || [];
                distance = this.distanceToPolygon([lat, lng], polygon);
            }

            if (distance < minDistance) {
                minDistance = distance;
                nearest = { ...geofence, distance };
            }
        }

        return nearest;
    }

    /**
     * Get user location overrides (remote work permissions, etc.)
     * @param {string} userId - User ID
     * @returns {Object} User location permissions
     */
    async getUserLocationOverrides(userId) {
        try {
            // This could be extended to fetch from a UserLocationPermissions table
            // For now, return default permissions
            return {
                remoteWorkEnabled: false,
                approvedLocations: [],
                temporaryPermissions: []
            };
        } catch (error) {
            console.error('Error fetching user location overrides:', error);
            return { remoteWorkEnabled: false };
        }
    }

    /**
     * Validate remote work location
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} userOverrides - User permission overrides
     * @returns {Object} Validation result
     */
    async validateRemoteLocation(lat, lng, userOverrides) {
        if (!userOverrides.remoteWorkEnabled) {
            return {
                valid: false,
                reason: 'REMOTE_WORK_NOT_ENABLED',
                message: 'Remote work is not enabled for this user'
            };
        }

        // Check approved remote locations
        for (const approvedLocation of userOverrides.approvedLocations || []) {
            const distance = this.calculateDistance(
                lat, lng, 
                approvedLocation.lat, 
                approvedLocation.lng
            );

            if (distance <= approvedLocation.radius) {
                return {
                    valid: true,
                    reason: 'APPROVED_REMOTE_LOCATION',
                    location: approvedLocation,
                    message: `Validated against approved remote location: ${approvedLocation.name}`
                };
            }
        }

        return {
            valid: true, // Allow remote work with justification
            reason: 'REMOTE_WORK_REQUIRES_JUSTIFICATION',
            message: 'Remote work from this location requires justification',
            requiresJustification: true
        };
    }

    /**
     * Log location validation attempt
     * @param {string|null} attendanceId - Attendance record ID
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {string|null} geofenceId - Geofence ID
     * @param {boolean} isValid - Whether validation passed
     * @param {number} deviation - Distance from geofence
     * @param {string} validationType - Type of validation
     */
    async logLocationValidation(attendanceId, lat, lng, geofenceId, isValid, deviation, validationType) {
        try {
            if (attendanceId) {
                await prisma.locationValidationLog.create({
                    data: {
                        attendanceId,
                        latitude: lat,
                        longitude: lng,
                        geofenceId,
                        isValid,
                        deviation: deviation || 0,
                        validationType
                    }
                });
            }
        } catch (error) {
            console.error('Error logging location validation:', error);
        }
    }

    /**
     * Log geofence violation
     * @param {string} userId - User ID
     * @param {string|null} attendanceId - Attendance record ID
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object|null} nearestGeofence - Nearest geofence info
     * @param {string} action - Action type
     */
    async logGeofenceViolation(userId, attendanceId, lat, lng, nearestGeofence, action) {
        try {
            await prisma.geofenceViolation.create({
                data: {
                    userId,
                    attendanceId,
                    latitude: lat,
                    longitude: lng,
                    distance: nearestGeofence?.distance || 0,
                    geofenceId: nearestGeofence?.id,
                    action
                }
            });
        } catch (error) {
            console.error('Error logging geofence violation:', error);
        }
    }

    /**
     * Validate coordinates format
     * @param {Object} coordinates - Coordinates object
     * @param {string} type - Geofence type
     * @returns {boolean} True if valid
     */
    validateCoordinates(coordinates, type) {
        if (!coordinates) return false;

        if (type === 'RADIUS') {
            return coordinates.lat && coordinates.lng && 
                   typeof coordinates.lat === 'number' && 
                   typeof coordinates.lng === 'number';
        } else {
            return coordinates.points && 
                   Array.isArray(coordinates.points) && 
                   coordinates.points.length >= 3;
        }
    }

    /**
     * Get geofence violations for user
     * @param {string} userId - User ID
     * @param {number} days - Number of days to look back
     * @returns {Array} List of violations
     */
    async getGeofenceViolations(userId, days = 30) {
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - days);

            return await prisma.geofenceViolation.findMany({
                where: {
                    userId,
                    timestamp: {
                        gte: fromDate
                    }
                },
                include: {
                    geofence: true,
                    attendance: true
                },
                orderBy: {
                    timestamp: 'desc'
                }
            });
        } catch (error) {
            console.error('Error fetching geofence violations:', error);
            return [];
        }
    }
}

export default GeofencingService;
