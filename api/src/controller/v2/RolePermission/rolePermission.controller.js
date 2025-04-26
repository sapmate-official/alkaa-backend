import prisma from "../../../db/connectDb.js";
export const getRolePermissions = async (req, res) => {
    try {
        const rolePermissions = await prisma.rolePermission.findMany();
        res.status(200).json(rolePermissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch role permissions' });
    }
};

export const getRolePermissionById = async (req, res) => {
    const { id } = req.params;
    try {
        const rolePermission = await prisma.rolePermission.findUnique({
            where: { id },
        });
        if (!rolePermission) {
            return res.status(404).json({ error: 'Role permission not found' });
        }
        res.status(200).json(rolePermission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch role permission' });
    }
};

export const createRolePermission = async (req, res) => {
    const { roleId, permissionId } = req.body;
    try {
        const newRolePermission = await prisma.rolePermission.create({
            data: { roleId, permissionId },
        });
        res.status(201).json(newRolePermission);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: 'Failed to create role permission' });
    }
};

export const updateRolePermission = async (req, res) => {
    const { id } = req.params;
    const { roleId, permissionId } = req.body;
    try {
        const updatedRolePermission = await prisma.rolePermission.update({
            where: { id },
            data: { roleId, permissionId },
        });
        res.status(200).json(updatedRolePermission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update role permission' });
    }
};

export const deleteRolePermission = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.rolePermission.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete role permission' });
    }
};