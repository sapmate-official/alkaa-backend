import GeofencingService from "../../../services/attendance/GeofencingService.js";
import prisma from "../../../db/connectDb.js";

const geofencingService = new GeofencingService();

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
};

const toBoolean = (value, fallback = false) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
    }
    if (value === 1) return true;
    if (value === 0) return false;
    return fallback;
};

const normalizePolygonPointsFromRequest = (points = []) => {
    if (!Array.isArray(points)) {
        return [];
    }

    return points
        .map((point) => {
            if (Array.isArray(point) && point.length >= 2) {
                const [lat, lng] = point;
                const latitude = toNumber(lat);
                const longitude = toNumber(lng);
                if (latitude === undefined || longitude === undefined) {
                    return null;
                }
                return { latitude, longitude };
            }

            if (point && typeof point === 'object') {
                const latitude = toNumber(point.latitude ?? point.lat);
                const longitude = toNumber(point.longitude ?? point.lng);
                if (latitude === undefined || longitude === undefined) {
                    return null;
                }
                return { latitude, longitude };
            }

            return null;
        })
        .filter(Boolean);
};

const formatGeofenceResponse = (geofence) => {
    if (!geofence) {
        return geofence;
    }

    const geometry = geofencingService.getGeofenceGeometry(geofence);

    return {
        ...geofence,
        shape: geometry.shape,
        radius: geometry.shape === 'CIRCLE' ? geometry.radius : null,
        allowedDeviation: geometry.allowedDeviation,
        geometry
    };
};

/**
 * Create a new geofence for organization
 */
export const createGeofence = async (req, res) => {
    try {
        const { orgId } = req.params;
        const {
            name,
            type,
            shape,
            coordinates,
            points,
            polygonPoints,
            latitude,
            longitude,
            radius,
            allowedDeviation,
            strictMode,
            isActive = true,
            description,
            address
        } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (!name || !type) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "name and type are required"
            });
        }

        const normalizedType = type.toUpperCase();
        const validTypes = ['MAIN_OFFICE', 'BRANCH_OFFICE', 'CLIENT_SITE', 'REMOTE_ZONE'];
        if (!validTypes.includes(normalizedType)) {
            return res.status(400).json({
                error: "Invalid geofence type",
                message: `Type must be one of: ${validTypes.join(', ')}`
            });
        }

        const normalizedShape = (shape || coordinates?.shape || (latitude !== undefined || longitude !== undefined || radius !== undefined ? 'CIRCLE' : 'POLYGON'))
            .toString()
            .toUpperCase();

        const coordinatePayload = { ...(coordinates || {}) };

        if (normalizedShape === 'CIRCLE') {
            const latValue = toNumber(coordinatePayload?.center?.latitude ?? latitude);
            const lngValue = toNumber(coordinatePayload?.center?.longitude ?? longitude);

            if (latValue === undefined || lngValue === undefined) {
                return res.status(400).json({
                    error: "Missing coordinates",
                    message: "latitude and longitude are required for circular geofences"
                });
            }

            if (latValue < -90 || latValue > 90 || lngValue < -180 || lngValue > 180) {
                return res.status(400).json({
                    error: "Invalid coordinates",
                    message: "Latitude must be between -90 and 90, longitude between -180 and 180"
                });
            }

            coordinatePayload.center = {
                latitude: latValue,
                longitude: lngValue
            };
        } else {
            const manualPoints = normalizePolygonPointsFromRequest(
                coordinatePayload.points || points || polygonPoints
            );

            if (manualPoints.length < 3) {
                return res.status(400).json({
                    error: "Invalid polygon",
                    message: "Polygon geofence requires at least 3 coordinate points"
                });
            }

            coordinatePayload.points = manualPoints;
        }

        if (address && !coordinatePayload.address) {
            coordinatePayload.address = address;
        }

        const geofence = await geofencingService.createGeofence(orgId, {
            name,
            type: normalizedType,
            shape: normalizedShape,
            coordinates: coordinatePayload,
            radius: normalizedShape === 'CIRCLE' ? toNumber(radius) : undefined,
            allowedDeviation: toNumber(allowedDeviation),
            strictMode: toBoolean(strictMode, false),
            isActive: toBoolean(isActive, true),
            description
        });

        res.status(201).json({
            success: true,
            data: formatGeofenceResponse(geofence),
            message: "Geofence created successfully"
        });
    } catch (error) {
        console.error('Error creating geofence:', error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message || "Failed to create geofence"
        });
    }
};

/**
 * Get all geofences for organization
 */
export const getOrganizationGeofences = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { type, isActive } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const where = { orgId };
        if (type) where.type = type.toUpperCase();
        if (isActive !== undefined) where.isActive = Boolean(isActive === 'true');

        const geofences = await prisma.organizationGeofence.findMany({
            where,
            include: {
                _count: {
                    select: {
                        validationLogs: {
                            where: {
                                timestamp: {
                                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                                }
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({
            success: true,
            data: geofences.map((geo) => {
                const { _count, ...geofenceRecord } = geo;
                return {
                    ...formatGeofenceResponse(geofenceRecord),
                    recentValidations: _count.validationLogs
                };
            })
        });
    } catch (error) {
        console.error('Error getting geofences:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get geofences"
        });
    }
};

/**
 * Update geofence
 */
export const updateGeofence = async (req, res) => {
    try {
        const { orgId, geofenceId } = req.params;
        const {
            name,
            type,
            shape,
            coordinates,
            points,
            polygonPoints,
            latitude,
            longitude,
            radius,
            allowedDeviation,
            strictMode,
            isActive,
            description,
            address
        } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const existingGeofence = await prisma.organizationGeofence.findFirst({
            where: { id: geofenceId, orgId }
        });

        if (!existingGeofence) {
            return res.status(404).json({
                error: "Geofence not found",
                message: "The requested geofence does not exist"
            });
        }

        const updatePayload = {};

        if (name !== undefined) {
            updatePayload.name = name;
        }

        if (type) {
            updatePayload.type = type.toUpperCase();
        }

        if (shape) {
            updatePayload.shape = shape.toUpperCase();
        }

        if (allowedDeviation !== undefined) {
            updatePayload.allowedDeviation = toNumber(allowedDeviation);
        }

        if (strictMode !== undefined) {
            updatePayload.strictMode = toBoolean(strictMode, existingGeofence.strictMode);
        }

        if (isActive !== undefined) {
            updatePayload.isActive = toBoolean(isActive, existingGeofence.isActive);
        }

        if (radius !== undefined) {
            updatePayload.radius = toNumber(radius);
        }

        if (description !== undefined) {
            updatePayload.description = description;
        }

        let coordinatePayload = coordinates ? { ...coordinates } : undefined;

        if (latitude !== undefined || longitude !== undefined) {
            const latValue = toNumber(latitude);
            const lngValue = toNumber(longitude);

            if ((latValue !== undefined && (latValue < -90 || latValue > 90)) ||
                (lngValue !== undefined && (lngValue < -180 || lngValue > 180))) {
                return res.status(400).json({
                    error: "Invalid coordinates",
                    message: "Latitude must be between -90 and 90, longitude between -180 and 180"
                });
            }

            if (latValue !== undefined && lngValue !== undefined) {
                coordinatePayload = coordinatePayload || {};
                coordinatePayload.center = {
                    latitude: latValue,
                    longitude: lngValue
                };
            }
        }

        const polygonCandidate = points || polygonPoints;
        if (polygonCandidate) {
            const manualPoints = normalizePolygonPointsFromRequest(polygonCandidate);
            if (manualPoints.length < 3) {
                return res.status(400).json({
                    error: "Invalid polygon",
                    message: "Polygon geofence requires at least 3 coordinate points"
                });
            }
            coordinatePayload = coordinatePayload || {};
            coordinatePayload.points = manualPoints;
        }

        if (address !== undefined) {
            coordinatePayload = coordinatePayload || {};
            coordinatePayload.address = address;
        }

        if (coordinatePayload) {
            updatePayload.coordinates = coordinatePayload;
        }

        const geofence = await geofencingService.updateGeofence(geofenceId, updatePayload);

        res.status(200).json({
            success: true,
            data: formatGeofenceResponse(geofence),
            message: "Geofence updated successfully"
        });
    } catch (error) {
        console.error('Error updating geofence:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to update geofence"
        });
    }
};

/**
 * Delete geofence
 */
export const deleteGeofence = async (req, res) => {
    try {
        const { orgId, geofenceId } = req.params;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        await prisma.organizationGeofence.delete({
            where: {
                id: geofenceId,
                orgId
            }
        });

        res.status(200).json({
            success: true,
            message: "Geofence deleted successfully"
        });
    } catch (error) {
        console.error('Error deleting geofence:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to delete geofence"
        });
    }
};

/**
 * Validate location against geofences
 */
export const validateLocation = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { latitude, longitude, userId, actionType } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                error: "Missing location data",
                message: "latitude and longitude are required"
            });
        }

        const latValue = toNumber(latitude);
        const lngValue = toNumber(longitude);

        if (latValue === undefined || lngValue === undefined ||
            latValue < -90 || latValue > 90 || lngValue < -180 || lngValue > 180) {
            return res.status(400).json({
                error: "Invalid coordinates",
                message: "Valid latitude and longitude are required"
            });
        }

        const targetUserId = userId || req.user.id;

        const validationResult = await geofencingService.validateLocation(
            latValue,
            lngValue,
            orgId,
            targetUserId,
            actionType
        );

        res.status(200).json({
            success: true,
            data: {
                ...validationResult,
                geofence: validationResult.geofence ? formatGeofenceResponse(validationResult.geofence) : null,
                nearestGeofence: validationResult.nearestGeofence
                    ? formatGeofenceResponse(validationResult.nearestGeofence)
                    : null
            }
        });
    } catch (error) {
        console.error('Error validating location:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to validate location"
        });
    }
};

/**
 * Get location validation history
 */
export const getValidationHistory = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            userId, 
            geofenceId, 
            fromDate, 
            toDate, 
            isValid,
            limit = 50, 
            offset = 0 
        } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const where = {
            attendance: {
                user: { orgId }
            }
        };

        if (userId) where.attendance.userId = userId;
        if (geofenceId) where.geofenceId = geofenceId;
        if (isValid !== undefined) where.isValid = Boolean(isValid === 'true');
        if (fromDate || toDate) {
            where.timestamp = {};
            if (fromDate) where.timestamp.gte = new Date(fromDate);
            if (toDate) where.timestamp.lte = new Date(toDate);
        }

        const [validations, total] = await Promise.all([
            prisma.locationValidationLog.findMany({
                where,
                include: {
                    attendance: {
                        include: {
                            user: {
                                select: { firstName: true, lastName: true, employeeId: true }
                            }
                        }
                    },
                    geofence: {
                        select: { name: true, type: true }
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: parseInt(limit),
                skip: parseInt(offset)
            }),
            prisma.locationValidationLog.count({ where })
        ]);

        res.status(200).json({
            success: true,
            data: {
                validations,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: parseInt(offset) + parseInt(limit) < total
                }
            }
        });
    } catch (error) {
        console.error('Error getting validation history:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get validation history"
        });
    }
};

/**
 * Get geofencing analytics
 */
export const getGeofencingAnalytics = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { days = 30 } = req.query;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - parseInt(days));

        // Get validation logs for analytics
        const validations = await prisma.locationValidationLog.findMany({
            where: {
                attendance: {
                    user: { orgId }
                },
                timestamp: { gte: fromDate }
            },
            include: {
                attendance: {
                    include: {
                        user: {
                            select: { id: true, firstName: true, lastName: true }
                        }
                    }
                },
                geofence: {
                    select: { id: true, name: true, type: true }
                }
            }
        });

        // Calculate analytics
        const analytics = {
            totalValidations: validations.length,
            validValidations: validations.filter(v => v.isValid).length,
            invalidValidations: validations.filter(v => !v.isValid).length,
            complianceRate: 0,
            byGeofence: {},
            byEmployee: {},
            byHour: {},
            violationHotspots: {},
            trends: {}
        };

        if (validations.length > 0) {
            analytics.complianceRate = Math.round((analytics.validValidations / analytics.totalValidations) * 100);

            validations.forEach(validation => {
                // Group by geofence
                if (validation.geofence) {
                    const geofenceName = validation.geofence.name;
                    if (!analytics.byGeofence[geofenceName]) {
                        analytics.byGeofence[geofenceName] = { total: 0, valid: 0, invalid: 0 };
                    }
                    analytics.byGeofence[geofenceName].total++;
                    if (validation.isValid) {
                        analytics.byGeofence[geofenceName].valid++;
                    } else {
                        analytics.byGeofence[geofenceName].invalid++;
                    }
                }

                // Group by employee
                const employeeName = `${validation.attendance.user.firstName} ${validation.attendance.user.lastName}`;
                if (!analytics.byEmployee[employeeName]) {
                    analytics.byEmployee[employeeName] = { total: 0, violations: 0 };
                }
                analytics.byEmployee[employeeName].total++;
                if (!validation.isValid) {
                    analytics.byEmployee[employeeName].violations++;
                }

                // Group by hour
                const hour = validation.timestamp.getHours();
                if (!analytics.byHour[hour]) {
                    analytics.byHour[hour] = { total: 0, violations: 0 };
                }
                analytics.byHour[hour].total++;
                if (!validation.isValid) {
                    analytics.byHour[hour].violations++;
                }

                // Track violation hotspots (approximate locations)
                if (!validation.isValid) {
                    const locationKey = `${Math.round(validation.latitude * 100) / 100},${Math.round(validation.longitude * 100) / 100}`;
                    if (!analytics.violationHotspots[locationKey]) {
                        analytics.violationHotspots[locationKey] = 0;
                    }
                    analytics.violationHotspots[locationKey]++;
                }

                // Daily trends
                const date = validation.timestamp.toISOString().split('T')[0];
                if (!analytics.trends[date]) {
                    analytics.trends[date] = { total: 0, violations: 0 };
                }
                analytics.trends[date].total++;
                if (!validation.isValid) {
                    analytics.trends[date].violations++;
                }
            });
        }

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        console.error('Error getting geofencing analytics:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get geofencing analytics"
        });
    }
};

/**
 * Get nearby geofences for a location
 */
export const getNearbyGeofences = async (req, res) => {
    try {
    const { orgId } = req.params;
    const { latitude, longitude, radius: radiusParam = 5000 } = req.query; // Default 5km radius

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({
                error: "Missing location data",
                message: "latitude and longitude are required"
            });
        }

        const latValue = toNumber(latitude);
        const lngValue = toNumber(longitude);
        const searchRadius = toNumber(radiusParam) ?? 5000;

        if (latValue === undefined || lngValue === undefined ||
            latValue < -90 || latValue > 90 || lngValue < -180 || lngValue > 180) {
            return res.status(400).json({
                error: "Invalid coordinates",
                message: "Valid latitude and longitude are required"
            });
        }

        const location = {
            latitude: latValue,
            longitude: lngValue
        };

        const geofences = await prisma.organizationGeofence.findMany({
            where: {
                orgId,
                isActive: true
            }
        });

        // Find nearby geofences
        const nearbyGeofences = geofences
            .map((geofence) => {
                const geometry = geofencingService.getGeofenceGeometry(geofence);
                const validation = geofencingService.isWithinGeofence(latValue, lngValue, geofence);

                let distanceFromLocation = Infinity;
                let distanceToBoundary = Infinity;
                let deviation = Infinity;
                const metrics = { shape: geometry.shape };

                if (geometry.shape === 'CIRCLE' && geometry.center) {
                    const distanceToCenter = geofencingService.calculateDistance(location, geometry.center);
                    distanceFromLocation = distanceToCenter;
                    distanceToBoundary = Math.max(distanceToCenter - geometry.radius, 0);
                    deviation = Math.max(distanceToCenter - geometry.effectiveRadius, 0);
                    metrics.distanceToCenter = distanceToCenter;
                    metrics.radius = geometry.radius;
                    metrics.allowedRadius = geometry.effectiveRadius;
                    metrics.allowedDeviation = geometry.allowedDeviation;
                } else if (geometry.points && geometry.points.length >= 3) {
                    const distanceToPolygon = geofencingService.distanceToPolygon(
                        [latValue, lngValue],
                        geometry.points
                    );
                    distanceFromLocation = distanceToPolygon;
                    distanceToBoundary = distanceToPolygon;
                    deviation = Math.max(distanceToPolygon - geometry.allowedDeviation, 0);
                    metrics.distanceToEdge = distanceToPolygon;
                    metrics.allowedDeviation = geometry.allowedDeviation;
                }

                return {
                    geofence: formatGeofenceResponse(geofence),
                    distanceFromLocation: Number.isFinite(distanceFromLocation) ? Math.round(distanceFromLocation) : Infinity,
                    distanceToBoundary: Number.isFinite(distanceToBoundary) ? Math.round(distanceToBoundary) : Infinity,
                    deviation: Number.isFinite(deviation) ? Math.max(Math.round(deviation), 0) : Infinity,
                    isWithin: Boolean(validation.valid),
                    validationDetails: validation.details || null,
                    metrics
                };
            })
            .filter((entry) => Number.isFinite(entry.distanceFromLocation) && entry.distanceFromLocation <= searchRadius)
            .sort((a, b) => a.distanceFromLocation - b.distanceFromLocation);

        res.status(200).json({
            success: true,
            data: {
                location,
                searchRadius,
                nearby: nearbyGeofences,
                withinGeofences: nearbyGeofences.filter(geo => geo.isWithin)
            }
        });
    } catch (error) {
        console.error('Error getting nearby geofences:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to get nearby geofences"
        });
    }
};

/**
 * Bulk import geofences
 */
export const bulkImportGeofences = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { geofences } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (!Array.isArray(geofences)) {
            return res.status(400).json({
                error: "Invalid data format",
                message: "geofences must be an array"
            });
        }

        const createdGeofences = [];

        for (let index = 0; index < geofences.length; index++) {
            const geo = geofences[index];

            if (!geo || !geo.name || !geo.type) {
                throw new Error(`Invalid geofence at index ${index}: name and type are required`);
            }

            const normalizedType = geo.type.toUpperCase();
            const normalizedShape = (geo.shape || geo.coordinates?.shape || (geo.radius !== undefined || geo.latitude !== undefined ? 'CIRCLE' : 'POLYGON'))
                .toString()
                .toUpperCase();

            const coordinatePayload = { ...(geo.coordinates || {}) };

            if (normalizedShape === 'CIRCLE') {
                const latValue = toNumber(coordinatePayload?.center?.latitude ?? geo.latitude);
                const lngValue = toNumber(coordinatePayload?.center?.longitude ?? geo.longitude);

                if (latValue === undefined || lngValue === undefined) {
                    throw new Error(`Invalid geofence at index ${index}: latitude and longitude are required for circular geofence`);
                }

                if (latValue < -90 || latValue > 90 || lngValue < -180 || lngValue > 180) {
                    throw new Error(`Invalid geofence at index ${index}: latitude/longitude out of range`);
                }

                coordinatePayload.center = {
                    latitude: latValue,
                    longitude: lngValue
                };
            } else {
                const manualPoints = normalizePolygonPointsFromRequest(
                    coordinatePayload.points || geo.points || geo.polygonPoints
                );

                if (manualPoints.length < 3) {
                    throw new Error(`Invalid geofence at index ${index}: polygon requires at least 3 points`);
                }

                coordinatePayload.points = manualPoints;
            }

            if (!coordinatePayload.address && geo.address) {
                coordinatePayload.address = geo.address;
            }

            const created = await geofencingService.createGeofence(orgId, {
                name: geo.name,
                type: normalizedType,
                shape: normalizedShape,
                coordinates: coordinatePayload,
                radius: normalizedShape === 'CIRCLE' ? toNumber(geo.radius) : undefined,
                allowedDeviation: toNumber(geo.allowedDeviation),
                strictMode: toBoolean(geo.strictMode, false),
                isActive: toBoolean(geo.isActive, true),
                description: geo.description
            });

            createdGeofences.push(created);
        }

        res.status(201).json({
            success: true,
            data: {
                imported: createdGeofences.length,
                total: geofences.length,
                geofences: createdGeofences.map(formatGeofenceResponse)
            },
            message: `${createdGeofences.length} geofences imported successfully`
        });
    } catch (error) {
        console.error('Error bulk importing geofences:', error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message || "Failed to import geofences"
        });
    }
};
