import prisma from "../db/connectDb.js";

const roleCheckManager = (req, res, next) => {
    const user = req.user;
    if(user.role !== "MANAGER"){
        return res.status(403).json({ error: "You are not authorized" });
    }else if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    next();
}

const roleCheckEmployee= (req, res, next) => {
    const user = req.user;
    if(user.role !== "EMPLOYEE"){
        return res.status(403).json({ error: "You are not authorized" });
    }else if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    next();
}

const checkUserRoles = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Get the user with their roles and multi-department assignments
        const userWithRoles = await prisma.user.findUnique({
            where: { id: user.id },
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
                // NEW: Include multi-department data
                userDepartments: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    }
                }
            }
        });

        if (!userWithRoles) {
            return res.status(404).json({ error: "User not found" });
        }

        // Add roles to the request object for easy access
        req.userRoles = userWithRoles.roles.map(ur => ur.role.name);
        
        // NEW: Add department information
        req.userDepartments = userWithRoles.userDepartments;
        req.primaryDepartment = userWithRoles.userDepartments?.find(ud => ud.isPrimary)?.department;
        req.allUserDepartments = userWithRoles.userDepartments?.map(ud => ud.department) || [];
        
        // Add permissions for easy checking
        req.userPermissions = userWithRoles.roles.flatMap(userRole => 
            userRole.role.permissions.map(rp => rp.permission.key)
        );
        
        // Check if the user is an org admin based on role permissions
        const isOrgAdmin = req.userPermissions.includes('view_salary_slip_of_all') ||
                           req.userPermissions.includes('org_admin_access');
        
        // Check if the user is a manager by seeing if they have subordinates
        const isManager = await prisma.user.findFirst({
            where: { 
                managerId: user.id 
            }
        });

        // NEW: Check if user is a department head
        const isDepartmentHead = await prisma.department.findFirst({
            where: {
                headId: user.id,
                orgId: user.orgId
            }
        });

        req.isOrgAdmin = isOrgAdmin;
        req.isManager = !!isManager;
        req.isDepartmentHead = !!isDepartmentHead;
        
        // NEW: Helper function for permission checking
        req.hasPermission = (permissionKey) => {
            return req.userPermissions.includes(permissionKey);
        };

        // NEW: Helper function for department access checking
        req.canAccessDepartment = (departmentId) => {
            return req.hasPermission('assign_user_to_all_department') ||
                   (req.hasPermission('assign_user_to_own_lead_department') && isDepartmentHead?.id === departmentId) ||
                   req.allUserDepartments.some(dept => dept.id === departmentId);
        };
        
        next();
    } catch (error) {
        console.error("Error in checkUserRoles middleware:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export { roleCheckManager, roleCheckEmployee, checkUserRoles }