import prisma from "../../../db/connectDb.js";

// Get user relationship with another user or organization
export const getUserRelationship = async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const currentUser = req.user;

        if (!currentUser) {
            return res.status(401).json({ error: "User not authenticated" });
        }

        // Get current user with roles and permissions
        const userWithRoles = await prisma.user.findUnique({
            where: { id: currentUser.id },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!userWithRoles) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if user is org admin using organization_admin table
        const orgAdminRecord = await prisma.organization_admin.findFirst({
            where: {
                adminId: currentUser.id,
                orgId: currentUser.orgId
            }
        });
        const isOrgAdmin = !!orgAdminRecord;

        let targetUser = null;
        let relationshipData = {
            userId: currentUser.id,
            userRoles: userWithRoles.roles.map(ur => ur.role.name),
            isOrgAdmin,
            orgId: currentUser.orgId
        };

        // If targetUserId is provided, check relationship with that user
        if (targetUserId) {
            targetUser = await prisma.user.findUnique({
                where: { id: targetUserId },
                include: {
                    roles: {
                        include: {
                            role: true
                        }
                    }
                }
            });

            if (!targetUser) {
                return res.status(404).json({ error: "Target user not found" });
            }

            // Check if users are in the same organization
            if (targetUser.orgId !== currentUser.orgId) {
                return res.status(403).json({ error: "Users are not in the same organization" });
            }

            // Check if current user is manager of target user
            const isDirectManager = targetUser.managerId === currentUser.id;

            // Check if current user is indirect manager (hierarchical)
            const isIndirectManager = await checkIndirectManagership(currentUser.id, targetUserId);

            // Check if current user has subordinates (is a manager in general)
            const hasSubordinates = await prisma.user.findFirst({
                where: { 
                    managerId: currentUser.id,
                    orgId: currentUser.orgId 
                }
            });

            // Check if target user is also an org admin
            const targetOrgAdminRecord = await prisma.organization_admin.findFirst({
                where: {
                    adminId: targetUserId,
                    orgId: currentUser.orgId
                }
            });
            const isTargetOrgAdmin = !!targetOrgAdminRecord;

            // Extract user permissions for efficient checking
            const userPermissions = userWithRoles.roles.flatMap(ur => 
                ur.role.permissions.map(rp => ({
                    key: rp.permission.key,
                    name: rp.permission.name
                }))
            );

            relationshipData = {
                ...relationshipData,
                targetUser: {
                    id: targetUser.id,
                    name: `${targetUser.firstName} ${targetUser.lastName}`,
                    email: targetUser.email,
                    roles: targetUser.roles.map(ur => ur.role.name),
                    isOrgAdmin: isTargetOrgAdmin
                },
                relationship: {
                    isDirectManager,
                    isIndirectManager,
                    isSelf: currentUser.id === targetUserId,
                    canViewProfile: canViewUserProfile(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin),
                    canEditProfile: canEditUserProfile(currentUser, targetUser, isDirectManager, isOrgAdmin),
                    canViewSalary: canViewUserSalary(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin),
                    canViewBankDetails: canViewUserBankDetails(currentUser, targetUser, isDirectManager, isOrgAdmin, userPermissions),
                    canViewPersonalInfo: canViewUserPersonalInfo(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin),
                    canViewEmploymentInfo: canViewUserEmploymentInfo(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin)
                },
                isManager: !!hasSubordinates
            };
        } else {
            // If no targetUserId, return general organization relationship info
            const hasSubordinates = await prisma.user.findFirst({
                where: { 
                    managerId: currentUser.id,
                    orgId: currentUser.orgId 
                }
            });

            // Get subordinate count
            const subordinateCount = await prisma.user.count({
                where: { 
                    managerId: currentUser.id,
                    orgId: currentUser.orgId 
                }
            });

            // Check if user is department head
            const isDepartmentHead = await prisma.department.findFirst({
                where: {
                    headId: currentUser.id,
                    orgId: currentUser.orgId
                }
            });

            // Get all organization admins for this org
            const allOrgAdmins = await prisma.organization_admin.findMany({
                where: {
                    orgId: currentUser.orgId
                },
                include: {
                    admin_user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });

            relationshipData = {
                ...relationshipData,
                organizationRole: {
                    isManager: !!hasSubordinates,
                    isDepartmentHead: !!isDepartmentHead,
                    subordinateCount,
                    departmentName: isDepartmentHead?.name || null,
                    organizationAdmins: allOrgAdmins.map(admin => ({
                        id: admin.admin_user.id,
                        name: `${admin.admin_user.firstName} ${admin.admin_user.lastName}`,
                        email: admin.admin_user.email
                    }))
                },
                permissions: userWithRoles.roles.flatMap(ur => 
                    ur.role.permissions.map(rp => ({
                        key: rp.permission.key,
                        name: rp.permission.name,
                        description: rp.permission.description
                    }))
                )
            };
        }

        res.status(200).json({
            success: true,
            data: relationshipData
        });

    } catch (error) {
        console.error('Error fetching user relationship:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Helper function to check indirect managership through hierarchy
async function checkIndirectManagership(managerId, targetUserId) {
    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { managerId: true }
        });

        if (!targetUser?.managerId) return false;
        if (targetUser.managerId === managerId) return true;

        // Recursively check up the hierarchy (with depth limit to prevent infinite loops)
        return await checkIndirectManagership(managerId, targetUser.managerId);
    } catch (error) {
        console.error('Error checking indirect managership:', error);
        return false;
    }
}

// Helper functions for permission checking
function canViewUserProfile(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin) {
    if (currentUser.id === targetUser.id) return true;
    if (isOrgAdmin) return true;
    if (isDirectManager || isIndirectManager) return true;
    return false;
}

function canEditUserProfile(currentUser, targetUser, isDirectManager, isOrgAdmin) {
    if (currentUser.id === targetUser.id) return true;
    if (isOrgAdmin) return true;
    if (isDirectManager) return true;
    return false;
}

function canViewUserSalary(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin) {
    if (currentUser.id === targetUser.id) return true;
    if (isOrgAdmin) return true;
    // Typically only direct managers or org admins can view salary
    if (isDirectManager) return true;
    return false;
}

function canViewUserBankDetails(currentUser, targetUser, isDirectManager, isOrgAdmin, userPermissions) {
    // Check if viewing own bank details with self permission
    if (currentUser.id === targetUser.id) {
        return userPermissions.some(p => 
            p.key === 'view_salary_slip_to_myself' || 
            p.key === 'generate_salary_to_myself' || 
            p.key === 'send_salary_to_myself'
        );
    }
    
    // Org admin can always view if they have permission
    if (isOrgAdmin) return true;
    
    // Direct manager can view subordinates' bank details if they have subordinate permissions
    if (isDirectManager) {
        return userPermissions.some(p => 
            p.key === 'view_salary_slip_of_subordinates' || 
            p.key === 'generate_salary_of_subordinates' || 
            p.key === 'send_salary_to_subordinates'
        );
    }
    
    // User with "all user" permissions can view anyone's bank details
    return userPermissions.some(p => 
        p.key === 'view_salary_slip_of_all' || 
        p.key === 'generate_salary_of_all' || 
        p.key === 'send_salary_to_all'
    );
}

function canViewUserPersonalInfo(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin) {
    if (currentUser.id === targetUser.id) return true;
    if (isOrgAdmin) return true;
    if (isDirectManager || isIndirectManager) return true;
    return false;
}

function canViewUserEmploymentInfo(currentUser, targetUser, isDirectManager, isIndirectManager, isOrgAdmin) {
    if (currentUser.id === targetUser.id) return true;
    if (isOrgAdmin) return true;
    if (isDirectManager || isIndirectManager) return true;
    return false;
}
