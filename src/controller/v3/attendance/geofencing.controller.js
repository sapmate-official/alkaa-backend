import GeofencingService from "../../../services/attendance/GeofencingService.js";
import prisma from "../../../db/connectDb.js";

const geofencingService = new GeofencingService();

/**
 * Create a new geofence for organization
 */
export const createGeofence = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { 
            name, 
            type, 
            latitude, 
            longitude, 
            radius, 
            address,
            isActive = true,
            description 
        } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Validate required fields
        if (!name || !type || !latitude || !longitude) {
            return res.status(400).json({
                error: "Missing required fields",
                message: "name, type, latitude, and longitude are required"
            });
        }

        // Validate geofence type
        const validTypes = ['OFFICE', 'BRANCH', 'WAREHOUSE', 'SITE', 'REMOTE_LOCATION'];
        if (!validTypes.includes(type.toUpperCase())) {
            return res.status(400).json({
                error: "Invalid geofence type",
                message: `Type must be one of: ${validTypes.join(', ')}`
            });
        }

        // Validate coordinates
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({
                error: "Invalid coordinates",
                message: "Latitude must be between -90 and 90, longitude between -180 and 180"
            });
        }

        const geofence = await prisma.organizationGeofence.create({
            data: {
                orgId,
                name,
                type: type.toUpperCase(),
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                radius: radius || 100, // Default 100m radius
                address,
                description,
                isActive: Boolean(isActive),
                createdBy: req.user.id
            }
        });

        res.status(201).json({
            success: true,
            data: geofence,
            message: "Geofence created successfully"
        });
    } catch (error) {
        console.error('Error creating geofence:', error);
        res.status(500).json({
            error: "Internal server error",
            message: "Failed to create geofence"
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
                createdByUser: {
                    select: { firstName: true, lastName: true }
                },
                _count: {
                    select: {
                        validationLogs: {
                            where: {
                                createdAt: {
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
            data: geofences.map(geo => ({
                ...geo,
                recentValidations: geo._count.validationLogs
            }))
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
        const updateData = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        // Validate coordinates if provided
        if (updateData.latitude && (updateData.latitude < -90 || updateData.latitude > 90)) {
            return res.status(400).json({
                error: "Invalid latitude",
                message: "Latitude must be between -90 and 90"
            });
        }

        if (updateData.longitude && (updateData.longitude < -180 || updateData.longitude > 180)) {
            return res.status(400).json({
                error: "Invalid longitude", 
                message: "Longitude must be between -180 and 180"
            });
        }

        const geofence = await prisma.organizationGeofence.update({
            where: {
                id: geofenceId,
                orgId
            },
            data: {
                ...updateData,
                updatedAt: new Date()
            }
        });

        res.status(200).json({
            success: true,
            data: geofence,
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
        const { latitude, longitude, userId } = req.body;

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({
                error: "Missing location data",
                message: "latitude and longitude are required"
            });
        }

        const targetUserId = userId || req.user.id;
        const location = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };

        const validationResult = await geofencingService.validateLocation(targetUserId, location);

        res.status(200).json({
            success: true,
            data: validationResult
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
            user: { orgId }
        };

        if (userId) where.userId = userId;
        if (geofenceId) where.geofenceId = geofenceId;
        if (isValid !== undefined) where.isValid = Boolean(isValid === 'true');
        if (fromDate || toDate) {
            where.createdAt = {};
            if (fromDate) where.createdAt.gte = new Date(fromDate);
            if (toDate) where.createdAt.lte = new Date(toDate);
        }

        const [validations, total] = await Promise.all([
            prisma.locationValidationLog.findMany({
                where,
                include: {
                    user: {
                        select: { firstName: true, lastName: true, employeeId: true }
                    },
                    geofence: {
                        select: { name: true, type: true }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
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
                user: { orgId },
                createdAt: { gte: fromDate }
            },
            include: {
                user: {
                    select: { id: true, firstName: true, lastName: true }
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
                const employeeName = `${validation.user.firstName} ${validation.user.lastName}`;
                if (!analytics.byEmployee[employeeName]) {
                    analytics.byEmployee[employeeName] = { total: 0, violations: 0 };
                }
                analytics.byEmployee[employeeName].total++;
                if (!validation.isValid) {
                    analytics.byEmployee[employeeName].violations++;
                }

                // Group by hour
                const hour = validation.createdAt.getHours();
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
                const date = validation.createdAt.toISOString().split('T')[0];
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
        const { latitude, longitude, radius = 5000 } = req.query; // Default 5km radius

        if (req.user.orgId !== orgId) {
            return res.status(403).json({
                error: "Access denied"
            });
        }

        if (!latitude || !longitude) {
            return res.status(400).json({
                error: "Missing location data",
                message: "latitude and longitude are required"
            });
        }

        const location = { 
            latitude: parseFloat(latitude), 
            longitude: parseFloat(longitude) 
        };

        const geofences = await prisma.organizationGeofence.findMany({
            where: {
                orgId,
                isActive: true
            }
        });

        // Find nearby geofences
        const nearbyGeofences = geofences
            .map(geofence => {
                const distance = geofencingService.calculateDistance(
                    location,
                    { latitude: geofence.latitude, longitude: geofence.longitude }
                );
                
                return {
                    ...geofence,
                    distance: Math.round(distance),
                    isWithin: distance <= geofence.radius
                };
            })
            .filter(geo => geo.distance <= parseInt(radius))
            .sort((a, b) => a.distance - b.distance);

        res.status(200).json({
            success: true,
            data: {
                location,
                searchRadius: parseInt(radius),
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

        // Validate each geofence
        const validatedGeofences = geofences.map((geo, index) => {
            if (!geo.name || !geo.type || !geo.latitude || !geo.longitude) {
                throw new Error(`Invalid geofence at index ${index}: missing required fields`);
            }
            return {
                orgId,
                name: geo.name,
                type: geo.type.toUpperCase(),
                latitude: parseFloat(geo.latitude),
                longitude: parseFloat(geo.longitude),
                radius: geo.radius || 100,
                address: geo.address,
                description: geo.description,
                isActive: geo.isActive !== false,
                createdBy: req.user.id
            };
        });

        const results = await prisma.organizationGeofence.createMany({
            data: validatedGeofences,
            skipDuplicates: true
        });

        res.status(201).json({
            success: true,
            data: {
                imported: results.count,
                total: geofences.length
            },
            message: `${results.count} geofences imported successfully`
        });
    } catch (error) {
        console.error('Error bulk importing geofences:', error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message || "Failed to import geofences"
        });
    }
};
