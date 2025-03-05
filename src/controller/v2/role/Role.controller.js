import prisma from "../../../db/connectDb.js";

// Get all roles for an organization
export const getRole = async (req, res) => {
    try {
        const { orgId } = req.params;

        if (!orgId) {
            return res.status(400).json({ message: "Organization ID is required" });
        }

        const roles = await prisma.role.findMany({
            where: { orgId },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        return res.status(200).json(roles);
    } catch (error) {
        console.error("Error fetching roles:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Get role by ID
export const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;
        const { orgId } = req.body;

        if (!id || !orgId) {
            return res.status(400).json({ message: "Role ID and Organization ID are required" });
        }

        const role = await prisma.role.findFirst({
            where: {
                id,
                orgId,
            },
            include: {
                permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        if (!role) {
            return res.status(404).json({ message: "Role not found" });
        }

        return res.status(200).json(role);
    } catch (error) {
        console.error("Error fetching role:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Create new role
export const createRole = async (req, res) => {
    try {
        const { orgId, name, description, permissions = [], isDefault = false } = req.body;

        if (!orgId || !name) {
            return res.status(400).json({ message: "Organization ID and role name are required" });
        }

        // Check if role with same name exists
        const existingRole = await prisma.role.findFirst({
            where: { orgId, name },
        });

        if (existingRole) {
            return res.status(400).json({ message: "Role with this name already exists" });
        }

        // Create role with permissions
        const role = await prisma.role.create({
            data: {
                orgId,
                name,
                description,
                isDefault,
                permissions: {
                    create: permissions.map(permission => ({
                        permission: {
                            connect: { id: permission.permissionId }
                        }
                    }))
                }
            },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return res.status(201).json(role);
    } catch (error) {
        console.error("Error creating role:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Update role
export const updateRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { name, description, permissions = [], isDefault } = req.body;

        if (!roleId) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { id: roleId },
        });

        if (!existingRole) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Delete existing permissions
        await prisma.rolePermission.deleteMany({
            where: { roleId: roleId },
        });

        // Update role with new permissions
        const updatedRole = await prisma.role.update({
            where: { id: roleId },
            data: {
                name: name || existingRole.name,
                description: description || existingRole.description,
                isDefault: isDefault || existingRole.isDefault,
                permissions: {
                    create: permissions.map(permission => ({
                        permission: {
                            connect: { id: permission.permissionId }
                        }
                    })
                    )
                }
                
            },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return res.status(200).json(updatedRole);
    } catch (error) {
        console.error("Error updating role:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Delete role
export const deleteRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const id = roleId;

        if (!id ) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { id },
        });

        if (!existingRole) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Delete role permissions first
        await prisma.rolePermission.deleteMany({
            where: { roleId: id },
        });

        // Delete role
        await prisma.role.delete({
            where: { id },
        });

        return res.status(200).json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};