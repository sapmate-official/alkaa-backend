import prisma from "../../../db/connectDb.js";

// Get all permission presets for an organization
export const getPresets = async (req, res) => {
    try {
        const { orgId } = req.params;

        if (!orgId) {
            return res.status(400).json({ message: "Organization ID is required" });
        }

        const presets = await prisma.permissionPreset.findMany({
            where: { orgId },
        });

        return res.status(200).json(presets);
    } catch (error) {
        console.error("Error fetching presets:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Get preset by ID
export const getPresetById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Preset ID is required" });
        }

        const preset = await prisma.permissionPreset.findUnique({
            where: { id },
        });

        if (!preset) {
            return res.status(404).json({ message: "Preset not found" });
        }

        return res.status(200).json(preset);
    } catch (error) {
        console.error("Error fetching preset:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Create new preset
export const createPreset = async (req, res) => {
    try {
        const { orgId, name, description, permissions = [] } = req.body;

        if (!orgId || !name) {
            return res.status(400).json({ message: "Organization ID and preset name are required" });
        }

        // Check if preset with same name exists
        const existingPreset = await prisma.permissionPreset.findFirst({
            where: { orgId, name },
        });

        if (existingPreset) {
            return res.status(400).json({ message: "Preset with this name already exists" });
        }

        // Create preset
        const preset = await prisma.permissionPreset.create({
            data: {
                orgId,
                name,
                description,
                permissions: permissions,
            },
        });

        return res.status(201).json(preset);
    } catch (error) {
        console.error("Error creating preset:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Update preset
export const updatePreset = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions } = req.body;

        if (!id) {
            return res.status(400).json({ message: "Preset ID is required" });
        }

        // Check if preset exists
        const existingPreset = await prisma.permissionPreset.findUnique({
            where: { id },
        });

        if (!existingPreset) {
            return res.status(404).json({ message: "Preset not found" });
        }

        // Update preset
        const updatedPreset = await prisma.permissionPreset.update({
            where: { id },
            data: {
                name: name !== undefined ? name : existingPreset.name,
                description: description !== undefined ? description : existingPreset.description,
                permissions: permissions !== undefined ? permissions : existingPreset.permissions,
            },
        });

        return res.status(200).json(updatedPreset);
    } catch (error) {
        console.error("Error updating preset:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Delete preset
export const deletePreset = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ message: "Preset ID is required" });
        }

        // Check if preset exists
        const existingPreset = await prisma.permissionPreset.findUnique({
            where: { id },
        });

        if (!existingPreset) {
            return res.status(404).json({ message: "Preset not found" });
        }

        // Delete preset
        await prisma.permissionPreset.delete({
            where: { id },
        });

        return res.status(200).json({ message: "Preset deleted successfully" });
    } catch (error) {
        console.error("Error deleting preset:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};