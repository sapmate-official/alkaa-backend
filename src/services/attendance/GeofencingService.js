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
     * Convert value into floating point number with fallback
     * @param {any} value - Input value (number|string|Decimal)
     * @param {number} fallback - Fallback when value is invalid
     * @returns {number}
     */
    toNumber(value, fallback = 0) {
        if (value === null || value === undefined) {
            return fallback;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string') {
            const parsed = parseFloat(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        }

        if (typeof value === 'object') {
            if (typeof value.toNumber === 'function') {
                try {
                    const decimalValue = value.toNumber();
                    return Number.isFinite(decimalValue) ? decimalValue : fallback;
                } catch (error) {
                    return fallback;
                }
            }

            if ('value' in value) {
                return this.toNumber(value.value, fallback);
            }
        }

        return fallback;
    }

    /**
     * Normalize a coordinate-like input to { latitude, longitude }
     * @param {any} point - Coordinate input
     * @returns {{ latitude: number, longitude: number }}
     */
    toLatLng(point) {
        if (Array.isArray(point) && point.length >= 2) {
            const [lat, lng] = point;
            return {
                latitude: this.toNumber(lat, 0),
                longitude: this.toNumber(lng, 0)
            };
        }

        if (point && typeof point === 'object') {
            const latitude = point.latitude ?? point.lat;
            const longitude = point.longitude ?? point.lng;

            if (latitude !== undefined && longitude !== undefined) {
                return {
                    latitude: this.toNumber(latitude, 0),
                    longitude: this.toNumber(longitude, 0)
                };
            }
        }

        throw new Error('Invalid coordinate value provided');
    }

    /**
     * Normalize polygon points to array of [lat, lng]
     * @param {any[]} points - Raw points array
     * @returns {Array<[number, number]>}
     */
    normalizePolygonPoints(points = []) {
        if (!Array.isArray(points)) {
            return [];
        }

        return points
            .map((point) => {
                try {
                    const { latitude, longitude } = this.toLatLng(point);
                    return [latitude, longitude];
                } catch (error) {
                    return null;
                }
            })
            .filter(Boolean);
    }

    /**
     * Prepare consistent geofence coordinates JSON for persistence
     * @param {Object} coordinates - Request coordinates
     * @param {'CIRCLE'|'POLYGON'} shape - Geofence shape
     * @param {number|null} radius - Radius for circle geofence
     * @param {number} allowedDeviation - Allowed deviation buffer in meters
     * @returns {Object}
     */
    serializeCoordinates(coordinates = {}, shape = 'CIRCLE', radius = null, allowedDeviation = 0) {
        if (shape === 'CIRCLE') {
            const centerInput = coordinates.center ?? coordinates;
            const { latitude, longitude } = this.toLatLng(centerInput);

            return {
                shape: 'CIRCLE',
                center: { latitude, longitude },
                radius,
                allowedDeviation,
                address: coordinates.address ?? null,
                metadata: coordinates.metadata ?? null
            };
        }

        const rawPoints = coordinates.points ?? coordinates.vertices ?? [];
        const points = this.normalizePolygonPoints(rawPoints);

        return {
            shape: 'POLYGON',
            points,
            allowedDeviation,
            address: coordinates.address ?? null,
            metadata: coordinates.metadata ?? null
        };
    }

    /**
     * Extract normalized geometry information from geofence record
     * @param {Object} geofence - Geofence record
     * @returns {{shape: string, radius: number|null, allowedDeviation: number, effectiveRadius: number|null, center?: {latitude: number, longitude: number}, points: Array<[number, number]>}}
     */
    getGeofenceGeometry(geofence) {
        const coordinates = geofence?.coordinates || {};
        const rawShape = coordinates.shape || coordinates.type || geofence?.shape || null;
        const hasRadius = geofence?.radius !== null && geofence?.radius !== undefined;
        const inferredShape = hasRadius ? 'CIRCLE' : 'POLYGON';
        const shape = (rawShape || inferredShape).toString().toUpperCase();

        const allowedDeviation = this.toNumber(
            geofence?.allowedDeviation ?? coordinates.allowedDeviation,
            this.geofenceTypes?.[geofence?.type]?.allowedDeviation ?? 50
        );

        if (shape === 'CIRCLE') {
            const centerInput = coordinates.center ?? coordinates;
            const center = this.toLatLng(centerInput);
            const radius = this.toNumber(
                geofence?.radius ?? coordinates.radius,
                0
            );
            const effectiveRadius = radius + allowedDeviation;

            return {
                shape: 'CIRCLE',
                radius,
                allowedDeviation,
                effectiveRadius,
                center
            };
        }

        const rawPoints = coordinates.points ?? coordinates.vertices ?? [];
        const points = this.normalizePolygonPoints(rawPoints);

        return {
            shape: 'POLYGON',
            radius: null,
            allowedDeviation,
            effectiveRadius: null,
            points
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
                        message: `Location validated against ${geofence.name}`,
                        details: validationResult.details || null
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
                deviation: nearestGeofence?.distance ?? null,
                message: nearestGeofence ? 
                    `Location is ${Math.round(nearestGeofence.distance)}m away from ${nearestGeofence.name}` :
                    'Location is outside all defined geofences',
                requiresApproval: true,
                details: nearestGeofence?.metrics || nearestGeofence?.geometry || null
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
                shape,
                coordinates,
                radius,
                strictMode = false,
                allowedDeviation = 50,
                isActive = false // Default to disabled
            } = geofenceData;

            const normalizedShape = (shape || coordinates?.shape || (radius ? 'CIRCLE' : 'POLYGON')).toString().toUpperCase();
            const allowedDeviationValue = this.toNumber(
                allowedDeviation ?? coordinates?.allowedDeviation,
                this.geofenceTypes?.[type]?.allowedDeviation ?? 50
            );
            const normalizedRadius = normalizedShape === 'CIRCLE'
                ? this.toNumber(radius ?? coordinates?.radius, 0)
                : null;

            // Validate coordinates
            if (!this.validateCoordinates(coordinates, normalizedShape)) {
                throw new Error('Invalid coordinates for geofence shape');
            }

            const serializedCoordinates = this.serializeCoordinates(
                coordinates,
                normalizedShape,
                normalizedRadius,
                allowedDeviationValue
            );

            return await prisma.organizationGeofence.create({
                data: {
                    orgId,
                    name,
                    type,
                    coordinates: serializedCoordinates,
                    radius: normalizedRadius,
                    strictMode,
                    allowedDeviation: allowedDeviationValue,
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
            const existing = await prisma.organizationGeofence.findUnique({
                where: { id: geofenceId }
            });

            if (!existing) {
                throw new Error('Geofence not found');
            }

            const coordinatesInput = updateData.coordinates ?? existing.coordinates ?? {};
            const shapeInput = updateData.shape || coordinatesInput.shape || existing.coordinates?.shape;
            const defaultShape = existing.radius !== null && existing.radius !== undefined ? 'CIRCLE' : 'POLYGON';
            const normalizedShape = (shapeInput || defaultShape).toString().toUpperCase();

            const allowedDeviationValue = updateData.allowedDeviation !== undefined
                ? this.toNumber(updateData.allowedDeviation, existing.allowedDeviation)
                : this.toNumber(existing.allowedDeviation);

            const normalizedRadius = normalizedShape === 'CIRCLE'
                ? this.toNumber(
                    updateData.radius ?? coordinatesInput.radius ?? existing.radius,
                    existing.radius ?? 0
                )
                : null;

            if (!this.validateCoordinates(coordinatesInput, normalizedShape)) {
                throw new Error('Invalid coordinates for geofence shape');
            }

            const serializedCoordinates = this.serializeCoordinates(
                coordinatesInput,
                normalizedShape,
                normalizedRadius,
                allowedDeviationValue
            );

            return await prisma.organizationGeofence.update({
                where: { id: geofenceId },
                data: {
                    name: updateData.name ?? existing.name,
                    type: updateData.type ?? existing.type,
                    coordinates: serializedCoordinates,
                    radius: normalizedRadius,
                    strictMode: updateData.strictMode ?? existing.strictMode,
                    allowedDeviation: allowedDeviationValue,
                    isActive: updateData.isActive ?? existing.isActive,
                    description: updateData.description ?? existing.description,
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
            const geometry = this.getGeofenceGeometry(geofence);

            if (geometry.shape === 'CIRCLE') {
                return this.isWithinCircularGeofence(lat, lng, geofence, geometry);
            }

            return this.isWithinPolygonGeofence(lat, lng, geofence, geometry);
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
    isWithinCircularGeofence(lat, lng, geofence, geometry = this.getGeofenceGeometry(geofence)) {
        const currentPoint = { latitude: this.toNumber(lat, 0), longitude: this.toNumber(lng, 0) };
        const centerPoint = geometry.center;
        const distanceToCenter = this.calculateDistance(currentPoint, centerPoint);
        const allowedRadius = geometry.effectiveRadius;
        const deviation = Math.max(distanceToCenter - allowedRadius, 0);

        return {
            valid: deviation <= 0,
            distance: deviation,
            details: {
                shape: 'CIRCLE',
                distanceToCenter,
                radius: geometry.radius,
                allowedDeviation: geometry.allowedDeviation,
                allowedRadius
            }
        };
    }

    /**
     * Check if point is within polygon geofence
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {Object} geofence - Polygon geofence
     * @returns {Object} Validation result
     */
    isWithinPolygonGeofence(lat, lng, geofence, geometry = this.getGeofenceGeometry(geofence)) {
        const point = [this.toNumber(lat, 0), this.toNumber(lng, 0)];
        const polygonPoints = geometry.points || [];
        const insidePolygon = this.pointInPolygon(point, polygonPoints);

        if (insidePolygon) {
            return {
                valid: true,
                distance: 0,
                details: {
                    shape: 'POLYGON',
                    insidePolygon: true,
                    distanceToEdge: 0,
                    allowedDeviation: geometry.allowedDeviation
                }
            };
        }

        const distanceToEdge = this.distanceToPolygon(point, polygonPoints);
        const deviation = Math.max(distanceToEdge - geometry.allowedDeviation, 0);

        return {
            valid: deviation <= 0,
            distance: deviation,
            details: {
                shape: 'POLYGON',
                insidePolygon: false,
                distanceToEdge,
                allowedDeviation: geometry.allowedDeviation
            }
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
    calculateDistance(pointA, pointB) {
        const { latitude: lat1, longitude: lng1 } = this.toLatLng(pointA);
        const { latitude: lat2, longitude: lng2 } = this.toLatLng(pointB);

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
        if (!Array.isArray(polygon) || polygon.length < 3) {
            return false;
        }

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
        if (!Array.isArray(polygon) || polygon.length < 2) {
            return Infinity;
        }

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

        return this.calculateDistance([px, py], [xx, yy]);
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

        const currentPoint = { latitude: this.toNumber(lat, 0), longitude: this.toNumber(lng, 0) };

        for (const geofence of geofences) {
            const geometry = this.getGeofenceGeometry(geofence);
            let deviation = Infinity;
            let metrics = {};

            if (geometry.shape === 'CIRCLE') {
                const distanceToCenter = this.calculateDistance(currentPoint, geometry.center);
                deviation = Math.max(distanceToCenter - geometry.effectiveRadius, 0);
                metrics = {
                    distanceToCenter,
                    effectiveRadius: geometry.effectiveRadius,
                    allowedDeviation: geometry.allowedDeviation
                };
            } else if (geometry.points && geometry.points.length >= 3) {
                const polygonDistance = this.distanceToPolygon(
                    [currentPoint.latitude, currentPoint.longitude],
                    geometry.points
                );
                deviation = Math.max(polygonDistance - geometry.allowedDeviation, 0);
                metrics = {
                    polygonDistance,
                    allowedDeviation: geometry.allowedDeviation
                };
            }

            if (deviation < minDistance) {
                minDistance = deviation;
                nearest = {
                    ...geofence,
                    distance: deviation,
                    geometry,
                    metrics
                };
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
                { latitude: this.toNumber(lat, 0), longitude: this.toNumber(lng, 0) },
                { latitude: this.toNumber(approvedLocation.lat, 0), longitude: this.toNumber(approvedLocation.lng, 0) }
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
    validateCoordinates(coordinates, shape = 'POLYGON') {
        if (!coordinates) return false;

        const normalizedShape = shape?.toString().toUpperCase();

        if (normalizedShape === 'RADIUS' || normalizedShape === 'CIRCLE') {
            try {
                this.toLatLng(coordinates.center ?? coordinates);
                return true;
            } catch (error) {
                return false;
            }
        }

        if (normalizedShape === 'POLYGON') {
            const points = coordinates.points ?? coordinates.vertices ?? [];
            const normalizedPoints = this.normalizePolygonPoints(points);
            return normalizedPoints.length >= 3;
        }

        return false;
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
