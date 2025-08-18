import prisma from "../../../db/connectDb.js";

/**
 * Multi-Department Permission Helper Functions
 * These functions help check permissions for multi-department operations
 */

/**
 * Check if user has permission to assign users to departments
 * @param {string} userId - User ID making the request
 * @param {string[]} departmentIds - Array of department IDs user wants to assign to
 * @returns {Promise<{canAssign: boolean, allowedDepartments: string[], reason?: string}>}
 */
export const checkDepartmentAssignmentPermission = async (userId, departmentIds) => {
    try {
        // Get user with roles and permissions
        const userWithPermissions = await prisma.user.findUnique({
            where: { id: userId },
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
                },
                userDepartments: {
                    include: {
                        department: true
                    }
                }
            }
        });

        if (!userWithPermissions) {
            return { canAssign: false, allowedDepartments: [], reason: 'User not found' };
        }

        const permissions = userWithPermissions.roles.flatMap(userRole => 
            userRole.role.permissions.map(rp => rp.permission.key)
        );

        // Check for global assignment permission
        if (permissions.includes('assign_user_to_all_department')) {
            return { canAssign: true, allowedDepartments: departmentIds };
        }

        // Check for department-specific assignment permission
        if (permissions.includes('assign_user_to_own_lead_department')) {
            // Get departments where user is head
            const leadDepartments = await prisma.department.findMany({
                where: {
                    headId: userId,
                    orgId: userWithPermissions.orgId
                },
                select: { id: true }
            });

            const allowedDepartmentIds = leadDepartments.map(dept => dept.id);
            const validDepartments = departmentIds.filter(deptId => 
                allowedDepartmentIds.includes(deptId)
            );

            return {
                canAssign: validDepartments.length === departmentIds.length,
                allowedDepartments: validDepartments,
                reason: validDepartments.length < departmentIds.length ? 
                    'User can only assign to departments they lead' : undefined
            };
        }

        // Check for multi-department management permission (NEW)
        if (permissions.includes('manage_multi_department_assignments')) {
            // User can manage multi-department assignments for their departments
            const userDepartmentIds = userWithPermissions.userDepartments.map(ud => ud.departmentId);
            const validDepartments = departmentIds.filter(deptId => 
                userDepartmentIds.includes(deptId)
            );

            return {
                canAssign: validDepartments.length > 0,
                allowedDepartments: validDepartments,
                reason: validDepartments.length < departmentIds.length ? 
                    'User can only assign to their associated departments' : undefined
            };
        }

        return { 
            canAssign: false, 
            allowedDepartments: [], 
            reason: 'User lacks department assignment permissions' 
        };

    } catch (error) {
        console.error('Error checking department assignment permission:', error);
        return { 
            canAssign: false, 
            allowedDepartments: [], 
            reason: 'Permission check failed' 
        };
    }
};

/**
 * Check if user can view multi-department data
 * @param {string} userId - User ID making the request
 * @param {string} targetUserId - User ID whose data is being accessed
 * @returns {Promise<{canView: boolean, scope: string, reason?: string}>}
 */
export const checkMultiDepartmentViewPermission = async (userId, targetUserId) => {
    try {
        const userWithPermissions = await prisma.user.findUnique({
            where: { id: userId },
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
                },
                userDepartments: true
            }
        });

        if (!userWithPermissions) {
            return { canView: false, scope: 'none', reason: 'User not found' };
        }

        const permissions = userWithPermissions.roles.flatMap(userRole => 
            userRole.role.permissions.map(rp => rp.permission.key)
        );

        // Self-access
        if (userId === targetUserId) {
            return { canView: true, scope: 'self' };
        }

        // Organization-wide view permission
        if (permissions.includes('view_all_multi_department_data')) {
            return { canView: true, scope: 'organization' };
        }

        // Department-specific view permission
        if (permissions.includes('view_department_multi_assignments')) {
            // Check if target user is in any of requestor's departments
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId },
                include: {
                    userDepartments: true
                }
            });

            const requestorDepartments = userWithPermissions.userDepartments.map(ud => ud.departmentId);
            const targetDepartments = targetUser?.userDepartments?.map(ud => ud.departmentId) || 
                                     (targetUser?.departmentId ? [targetUser.departmentId] : []);

            const hasSharedDepartment = targetDepartments.some(deptId => 
                requestorDepartments.includes(deptId)
            );

            return {
                canView: hasSharedDepartment,
                scope: 'department',
                reason: hasSharedDepartment ? undefined : 'No shared departments'
            };
        }

        // Manager permission
        if (permissions.includes('view_subordinates_multi_departments')) {
            const targetUser = await prisma.user.findUnique({
                where: { id: targetUserId },
                select: { managerId: true }
            });

            return {
                canView: targetUser?.managerId === userId,
                scope: 'subordinates',
                reason: targetUser?.managerId !== userId ? 'Not a direct subordinate' : undefined
            };
        }

        return { 
            canView: false, 
            scope: 'none', 
            reason: 'Insufficient permissions for multi-department data' 
        };

    } catch (error) {
        console.error('Error checking multi-department view permission:', error);
        return { 
            canView: false, 
            scope: 'none', 
            reason: 'Permission check failed' 
        };
    }
};

/**
 * Filter departments based on user permissions
 * @param {string} userId - User ID making the request
 * @param {string[]} departmentIds - Array of department IDs to filter
 * @returns {Promise<{allowedDepartments: string[], deniedDepartments: string[]}>}
 */
export const filterDepartmentsByPermission = async (userId, departmentIds) => {
    try {
        const permissionCheck = await checkDepartmentAssignmentPermission(userId, departmentIds);
        
        return {
            allowedDepartments: permissionCheck.allowedDepartments,
            deniedDepartments: departmentIds.filter(deptId => 
                !permissionCheck.allowedDepartments.includes(deptId)
            )
        };
    } catch (error) {
        console.error('Error filtering departments:', error);
        return {
            allowedDepartments: [],
            deniedDepartments: departmentIds
        };
    }
};

/**
 * NEW: Permission seeds for multi-department functionality
 */
export const MULTI_DEPARTMENT_PERMISSIONS = [
    {
        key: 'manage_multi_department_assignments',
        name: 'Manage Multi-Department Assignments',
        description: 'Assign users to multiple departments and manage their department roles',
        module: 'Department',
        action: 'Multi-Assign'
    },
    {
        key: 'view_all_multi_department_data',
        name: 'View All Multi-Department Data',
        description: 'View multi-department assignments across the organization',
        module: 'Department',
        action: 'View All Multi'
    },
    {
        key: 'view_department_multi_assignments',
        name: 'View Department Multi-Assignments',
        description: 'View multi-department assignments within user\'s departments',
        module: 'Department',
        action: 'View Dept Multi'
    },
    {
        key: 'view_subordinates_multi_departments',
        name: 'View Subordinates Multi-Departments',
        description: 'View multi-department assignments of direct subordinates',
        module: 'Department',
        action: 'View Sub Multi'
    },
    {
        key: 'approve_cross_department_requests',
        name: 'Approve Cross-Department Requests',
        description: 'Approve requests from users in multiple departments',
        module: 'Department',
        action: 'Approve Cross'
    }
];
