import prisma from "../../../db/connectDb.js";
export const getPermissions = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany();
        res.status(200).json(permissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
};

export const getPermissionById = async (req, res) => {
    const { id } = req.params;
    try {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            return res.status(404).json({ error: 'Permission not found' });
        }
        res.status(200).json(permission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permission' });
    }
};

export const createPermission = async (req, res) => {
    const { name, description, module, action } = req.body;
    try {
        const newPermission = await prisma.permission.create({
            data: {  name, description, module, action },
        });
        res.status(201).json(newPermission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create permission' });
    }
};

export const updatePermission = async (req, res) => {
    const { id } = req.params;
    const { name, description, module, action } = req.body;
    try {
        const updatedPermission = await prisma.permission.update({
            where: { id },
            data: { name, description, module, action },
        });
        res.status(200).json(updatedPermission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update permission' });
    }
};

export const deletePermission = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.permission.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete permission' });
    }
};