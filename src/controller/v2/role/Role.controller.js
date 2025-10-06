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
         console.log(req.body);
         
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
        const { name, description, permissions, isDefault, updateType = 'replace' } = req.body;

        if (!roleId) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        if (!existingRole) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Update the role basic information
        const updatedRole = await prisma.role.update({
            where: { id: roleId },
            data: {
                name: name !== undefined ? name : existingRole.name,
                description: description !== undefined ? description : existingRole.description,
                isDefault: isDefault !== undefined ? isDefault : existingRole.isDefault,
            }
        });

        // Handle permissions update only if permissions array is provided
        if (permissions !== undefined && Array.isArray(permissions)) {
            // Extract permission IDs and validate them
            let permissionIds = [];
            
            if (permissions.length > 0) {
                if (typeof permissions[0] === 'object' && permissions[0].permissionId) {
                    permissionIds = permissions.map(p => p.permissionId);
                } else if (typeof permissions[0] === 'string') {
                    permissionIds = permissions;
                } else {
                    return res.status(400).json({ message: "Invalid permissions format. Expected array of permission IDs or objects with permissionId." });
                }
            }

            // Remove duplicates
            permissionIds = [...new Set(permissionIds)];

            // Validate that all permission IDs exist
            if (permissionIds.length > 0) {
                const validPermissions = await prisma.permission.findMany({
                    where: { id: { in: permissionIds } },
                    select: { id: true }
                });

                const validPermissionIds = validPermissions.map(p => p.id);
                const invalidPermissionIds = permissionIds.filter(id => !validPermissionIds.includes(id));

                if (invalidPermissionIds.length > 0) {
                    return res.status(400).json({ 
                        message: "Invalid permission IDs provided", 
                        invalidIds: invalidPermissionIds 
                    });
                }
            }

            // Handle different update types
            if (updateType === 'add') {
                // Add new permissions (keep existing ones)
                const existingPermissionIds = existingRole.permissions.map(rp => rp.permission.id);
                const newPermissionIds = permissionIds.filter(id => !existingPermissionIds.includes(id));
                
                for (const permissionId of newPermissionIds) {
                    await prisma.rolePermission.create({
                        data: {
                            roleId: roleId,
                            permissionId: permissionId
                        }
                    });
                }
            } else if (updateType === 'remove') {
                // Remove specified permissions
                await prisma.rolePermission.deleteMany({
                    where: {
                        roleId: roleId,
                        permissionId: { in: permissionIds }
                    }
                });
            } else {
                // Default: replace all permissions
                // Delete all current permissions
                await prisma.rolePermission.deleteMany({
                    where: { roleId: roleId }
                });

                // Add new permissions
                for (const permissionId of permissionIds) {
                    await prisma.rolePermission.create({
                        data: {
                            roleId: roleId,
                            permissionId: permissionId
                        }
                    });
                }
            }
        }

        // Get the updated role with its permissions
        const finalRole = await prisma.role.findFirst({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return res.status(200).json(finalRole);
    } catch (error) {
        console.error("Error updating role:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Delete role
export const deleteRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const id = roleId;

        if (!id) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { id },
        });

        if (!existingRole) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Check if any users are using this role
        const usersWithRole = await prisma.userRole.findMany({
            where: { roleId: id },
        });

        // If users have this role, we need to handle it
        if (usersWithRole.length > 0) {
            // Option 1: Delete all user role assignments first
            await prisma.userRole.deleteMany({
                where: { roleId: id },
            });
            
            // Log that we're removing the role from users
            console.log(`Removed role ${id} from ${usersWithRole.length} users`);
        }

        // Delete role permissions
        await prisma.rolePermission.deleteMany({
            where: { roleId: id },
        });

        // Finally delete the role
        await prisma.role.delete({
            where: { id },
        });

        return res.status(200).json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Add permissions to role (without replacing existing ones)
export const addPermissionsToRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissions = [] } = req.body;

        if (!roleId) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return res.status(400).json({ message: "Permissions array is required" });
        }

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        if (!existingRole) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Extract permission IDs
        let permissionIds = [];
        if (typeof permissions[0] === 'object' && permissions[0].permissionId) {
            permissionIds = permissions.map(p => p.permissionId);
        } else if (typeof permissions[0] === 'string') {
            permissionIds = permissions;
        } else {
            return res.status(400).json({ message: "Invalid permissions format" });
        }

        // Remove duplicates
        permissionIds = [...new Set(permissionIds)];

        // Validate permission IDs exist
        const validPermissions = await prisma.permission.findMany({
            where: { id: { in: permissionIds } },
            select: { id: true }
        });

        const validPermissionIds = validPermissions.map(p => p.id);
        const invalidPermissionIds = permissionIds.filter(id => !validPermissionIds.includes(id));

        if (invalidPermissionIds.length > 0) {
            return res.status(400).json({ 
                message: "Invalid permission IDs provided", 
                invalidIds: invalidPermissionIds 
            });
        }

        // Get existing permission IDs for this role
        const existingPermissionIds = existingRole.permissions.map(rp => rp.permission.id);
        
        // Filter out permissions that already exist
        const newPermissionIds = validPermissionIds.filter(id => !existingPermissionIds.includes(id));

        if (newPermissionIds.length === 0) {
            return res.status(200).json({ 
                message: "All permissions already assigned to role",
                role: existingRole 
            });
        }

        // Add new permissions
        for (const permissionId of newPermissionIds) {
            await prisma.rolePermission.create({
                data: {
                    roleId: roleId,
                    permissionId: permissionId
                }
            });
        }

        // Get updated role
        const updatedRole = await prisma.role.findFirst({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return res.status(200).json({
            message: `Added ${newPermissionIds.length} new permissions to role`,
            role: updatedRole
        });
    } catch (error) {
        console.error("Error adding permissions to role:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Remove permissions from role
export const removePermissionsFromRole = async (req, res) => {
    try {
        const { roleId } = req.params;
        const { permissions = [] } = req.body;

        if (!roleId) {
            return res.status(400).json({ message: "Role ID is required" });
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return res.status(400).json({ message: "Permissions array is required" });
        }

        // Check if role exists
        const existingRole = await prisma.role.findFirst({
            where: { id: roleId }
        });

        if (!existingRole) {
            return res.status(404).json({ message: "Role not found" });
        }

        // Extract permission IDs
        let permissionIds = [];
        if (typeof permissions[0] === 'object' && permissions[0].permissionId) {
            permissionIds = permissions.map(p => p.permissionId);
        } else if (typeof permissions[0] === 'string') {
            permissionIds = permissions;
        } else {
            return res.status(400).json({ message: "Invalid permissions format" });
        }

        // Remove permissions from role
        const deleteResult = await prisma.rolePermission.deleteMany({
            where: {
                roleId: roleId,
                permissionId: { in: permissionIds }
            }
        });

        // Get updated role
        const updatedRole = await prisma.role.findFirst({
            where: { id: roleId },
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                }
            }
        });

        return res.status(200).json({
            message: `Removed ${deleteResult.count} permissions from role`,
            role: updatedRole
        });
    } catch (error) {
        console.error("Error removing permissions from role:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
}