import prisma from "../../../db/connectDb.js";
export const getHolidays = async (req, res) => {
    try {
        const holidays = await prisma.holiday.findMany();
        res.status(200).json(holidays);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch holidays" });
    }
};

export const getHolidayById = async (req, res) => {
    const { id } = req.params;
    try {
        const holiday = await prisma.holiday.findUnique({ where: { id } });
        if (!holiday) {
            return res.status(404).json({ error: "Holiday not found" });
        }
        res.status(200).json(holiday);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch holiday" });
    }
};

export const createHoliday = async (req, res) => {
    const { orgId, name, date, description, isOptional } = req.body;
    try {
        const newHoliday = await prisma.holiday.create({
            data: { orgId, name, date, description, isOptional },
        });
        res.status(201).json(newHoliday);
    } catch (error) {
        res.status(500).json({ error: "Failed to create holiday" });
    }
};

export const updateHoliday = async (req, res) => {
    const { id } = req.params;
    const { name, date, description, isOptional } = req.body;
    try {
        const updatedHoliday = await prisma.holiday.update({
            where: { id },
            data: { name, date, description, isOptional },
        });
        res.status(200).json(updatedHoliday);
    } catch (error) {
        res.status(500).json({ error: "Failed to update holiday" });
    }
};

export const deleteHoliday = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.holiday.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Failed to delete holiday" });
    }
};