import prisma from '../../../db/connectDb.js';

// Create a new holiday type
export const createHolidayType = async (req, res) => {
    const { name, policy } = req.body;
    const orgId = req.params.orgId || req.query.orgId || req.body.orgId;

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        const holidayType = await prisma.holidayType.create({
            data: {
                name,
                policy,
                organization: {
                    connect: { id: orgId }
                }
            }
        });

        return res.status(201).json({
            success: true,
            data: holidayType
        });
    } catch (error) {
        console.error('Error creating holiday type:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Holiday type with this name already exists' });
        }
        return res.status(500).json({ error: error.message });
    }
};

// Update an existing holiday type
export const updateHolidayType = async (req, res) => {
    const { id } = req.params;
    const { name, policy } = req.body;

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        // First check if the holiday type belongs to the organization
        const existingHolidayType = await prisma.holidayType.findFirst({
            where: {
                id
            }
        });

        if (!existingHolidayType) {
            return res.status(404).json({ error: 'Holiday type not found or does not belong to this organization' });
        }

        const updatedHolidayType = await prisma.holidayType.update({
            where: { id },
            data: {
                name,
                policy,
                updatedAt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            data: updatedHolidayType
        });
    } catch (error) {
        console.error('Error updating holiday type:', error);
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Holiday type with this name already exists' });
        }
        return res.status(500).json({ error: error.message });
    }
};

// Get a single holiday type by ID
export const getHolidayType = async (req, res) => {
    const { id } = req.params;


    try {
        const holidayType = await prisma.holidayType.findFirst({
            where: {
                id
            }
        });

        if (!holidayType) {
            return res.status(404).json({ error: 'Holiday type not found or does not belong to this organization' });
        }

        return res.status(200).json({
            success: true,
            data: holidayType
        });
    } catch (error) {
        console.error('Error getting holiday type:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Get all holiday types for an organization
export const getAllHolidayTypes = async (req, res) => {
    const orgId = req.params.orgId || req.query.orgId;

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    try {
        const holidayTypes = await prisma.holidayType.findMany({
            where: {
                orgId
            },
            orderBy: {
                name: 'asc'
            }
        });

        return res.status(200).json({
            success: true,
            count: holidayTypes.length,
            data: holidayTypes
        });
    } catch (error) {
        console.error('Error getting all holiday types:', error);
        return res.status(500).json({ error: error.message });
    }
};

// Delete a holiday type
export const deleteHolidayType = async (req, res) => {
    const { id } = req.params;


    try {
        // First check if the holiday type belongs to the organization
        const holidayType = await prisma.holidayType.findFirst({
            where: {
                id
            },
            include: {
                Holiday: true
            }
        });

        if (!holidayType) {
            return res.status(404).json({ error: 'Holiday type not found or does not belong to this organization' });
        }

        // Check if there are holidays using this type
        if (holidayType.Holiday.length > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete holiday type as it is being used by one or more holidays' 
            });
        }

        await prisma.holidayType.delete({
            where: { id }
        });

        return res.status(200).json({
            success: true,
            message: 'Holiday type deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting holiday type:', error);
        return res.status(500).json({ error: error.message });
    }
};