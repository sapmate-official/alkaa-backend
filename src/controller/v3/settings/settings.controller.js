import prisma from "../../../db/connectDb.js";

const fetchSettings = async (req, res) => {
    try {
        const {orgId} = req.params;
        if(!orgId) {
            return res.status(400).json({message: "Organization ID is required"});
        }
        
        const settings = await prisma.organization.findUnique({
            where: {id: orgId},
            include: { OrganizationSettings: true }
        });
        console.log(settings);
        if (!settings) {
            return res.status(404).json({message: "Settings not found"});
        }
        return res.status(200).json(settings.OrganizationSettings);
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}

const updateSettings = async (req, res) => {
    try {
        const {orgId} = req.params;
        const {settings} = req.body;
        
        // First find the settings record
        const settingsRecord = await prisma.organizationSettings.findFirst({
            where: {orgId: orgId},
        });
        
        if (!settingsRecord) {
            return res.status(404).json({message: "Settings not found"});
        }
        
        // Then update using the id field
        const updated = await prisma.organizationSettings.update({
            where: {id: settingsRecord.id},
            data: {settings},
        });
        
        return res.status(200).json(updated);
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}

const resetSettings = async (req, res) => {
    try {
        const {orgId} = req.params
        const defaultSettings = {
            weekoff: [0, 6]
        }
        const existingSettings = await prisma.organizationSettings.findFirst({
            where: {orgId: orgId},
        });
        if(!existingSettings){
            await prisma.organizationSettings.create({
                data:{
                    orgId: orgId,
                    settings: defaultSettings
                }
            })
            return res.status(200).json({message: "Settings reset successfully"});
        }
        const reset = await prisma.organizationSettings.updateMany({
            where: {orgId: orgId},
            data: {
                settings: defaultSettings
            },
        });
        if (!reset) {
            return res.status(404).json({message: "Settings not found"});
        }
        return res.status(200).json({message: "Settings reset successfully"});
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: "Internal server error"});
    }
}

export {fetchSettings, updateSettings, resetSettings};