import prisma from "../../../db/connectDb.js";

export const getHolidays = async (req, res) => {
    try {
        const { orgId } = req.params;
        
        if (!orgId) {
            return res.status(400).json({ error: "Organization ID is required" });
        }
        
        // Validate if orgId is a valid format
        if (typeof orgId !== 'string' || orgId.trim() === '') {
            return res.status(400).json({ error: "Invalid organization ID format" });
        }
        
        // Check if organization exists
        const organization = await prisma.organization.findUnique({
            where: { id: orgId }
        });
        
        if (!organization) {
            return res.status(404).json({ error: "Organization not found" });
        }
        
        const holidays = await prisma.holiday.findMany({
            where: { orgId },
            include: { holidayType: true }
        });
        
        res.status(200).json(holidays);
    } catch (error) {
        console.error("Error fetching holidays:", error);
        res.status(500).json({ error: "Failed to fetch holidays",  error });
    }
};

export const getHolidayById = async (req, res) => {
    const { id } = req.params;
    
    try {
        // Validate if id exists and is valid
        if (!id) {
            return res.status(400).json({ error: "Holiday ID is required" });
        }
        
        if (typeof id !== 'string' || id.trim() === '') {
            return res.status(400).json({ error: "Invalid holiday ID format" });
        }
        
        const holiday = await prisma.holiday.findUnique({ 
            where: { id },
            include: { holidayType: true }
        });
        
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }
        
        res.status(200).json(holiday);
    } catch (error) {
        console.error("Error fetching holiday:", error);
        res.status(500).json({ error: "Failed to fetch holiday",error});
    }
};

export const createHoliday = async (req, res) => {
    const { orgId, name, date, description, isOptional, type } = req.body;
    
    try {
        const newHoliday = await prisma.holiday.create({
            data: { 
                orgId, 
                name, 
                date: new Date(date),
                description, 
                isOptional,
                type
            },
            include: { holidayType: true }
        });
        
        res.status(201).json(newHoliday);
    } catch (error) {
        console.error("Error creating holiday:", error);
        res.status(500).json({ error: "Failed to create holiday",  error});
    }
};

export const updateHoliday = async (req, res) => {
    const { id } = req.params;
    const { name, date, description, isOptional, type } = req.body;
    
    try {
        const updatedHoliday = await prisma.holiday.update({
            where: { id },
            data: { 
                name, 
                date: date ? new Date(date) : undefined, 
                description, 
                isOptional,
                type 
            },
            include: { holidayType: true }
        });
        
        res.status(200).json(updatedHoliday);
    } catch (error) {
        console.error("Error updating holiday:", error);
        res.status(500).json({ error: "Failed to update holiday",  error});
    }
};

export const deleteHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.holiday.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        console.error("Error deleting holiday:", error);
        res.status(500).json({ error: "Failed to delete holiday",  error});
    }
};
