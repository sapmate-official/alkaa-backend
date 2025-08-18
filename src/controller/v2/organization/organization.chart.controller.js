import prisma from '../../../db/connectDb.js';

// Get organization chart hierarchy
export const getOrganizationChart = async (req, res) => {
    try {
        const { orgId } = req.params;

        // Fetch organization with full hierarchy data
        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                departments: {
                    include: {
                        departmentHead: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                employeeId: true,
                                departmentId: true,
                                managerId: true
                            }
                        },
                        parentDepartment: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        subDepartments: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        // NEW: Include users via UserDepartment for multi-department support
                        userDepartments: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        email: true,
                                        employeeId: true,
                                        departmentId: true,
                                        managerId: true,
                                        manager: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true
                                            }
                                        },
                                        subordinates: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true
                                            }
                                        }
                                    }
                                }
                            },
                            where: {
                                isPrimary: true // Only show users where this is their primary department
                            }
                        },
                        // Legacy: Keep direct users relationship for backward compatibility
                        users: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                employeeId: true,
                                departmentId: true,
                                managerId: true,
                                manager: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true
                                    }
                                },
                                subordinates: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true
                                    }
                                }
                            }
                        }
                    }
                },
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        departmentId: true,
                        managerId: true,
                        department: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        // NEW: Include multi-department assignments
                        userDepartments: {
                            include: {
                                department: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        },
                        manager: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        subordinates: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        }
                    }
                }
            }
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }        // Build hierarchical structure
        const chartStructure = buildHierarchicalStructure(organization);
        
        console.log('Built chart structure:', JSON.stringify(chartStructure, null, 2));

        res.status(200).json({
            organization: {
                id: organization.id,
                name: organization.name
            },
            chart: chartStructure
        });

    } catch (error) {
        console.error('Error fetching organization chart:', error);
        res.status(500).json({ error: error.message });
    }
};

// Helper function to build hierarchical structure
function buildHierarchicalStructure(organization) {
    const { departments, users } = organization;
    
    // Create a map for quick lookup
    const departmentMap = new Map();
    const userMap = new Map();
    
    // Process departments
    departments.forEach(dept => {
        // NEW: Combine legacy users and userDepartments users, prioritizing primary assignments
        const primaryUsers = dept.userDepartments?.map(ud => ({
            ...ud.user,
            isPrimaryDepartment: true
        })) || [];
        
        // Add legacy users that aren't already included via userDepartments
        const legacyUsers = dept.users?.filter(user => 
            !primaryUsers.some(pu => pu.id === user.id)
        ).map(user => ({
            ...user,
            isPrimaryDepartment: user.departmentId === dept.id
        })) || [];

        const allDeptUsers = [...primaryUsers, ...legacyUsers];

        departmentMap.set(dept.id, {
            id: dept.id,
            name: dept.name,
            type: 'department',
            description: dept.description,
            location: dept.location,
            budget: dept.budget,
            parentId: dept.parentId,
            headId: dept.headId,
            head: dept.departmentHead,
            users: allDeptUsers,
            children: []
        });
    });
      // Process users
    users.forEach(user => {
        // NEW: Enhanced user data with multi-department info
        const userDepartments = user.userDepartments || [];
        const primaryDepartment = userDepartments.find(ud => ud.isPrimary)?.department || user.department;
        
        userMap.set(user.id, {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            type: 'user',
            departmentId: user.departmentId,
            department: user.department,
            // NEW: Multi-department data
            userDepartments: userDepartments,
            primaryDepartment: primaryDepartment,
            allDepartments: userDepartments.map(ud => ud.department).filter(Boolean),
            isMultiDepartment: userDepartments.length > 1,
            managerId: user.managerId,
            manager: user.manager,
            subordinates: user.subordinates,
            isHead: departments.some(dept => dept.headId === user.id),
            isManager: user.subordinates && user.subordinates.length > 0,
            children: []
        });
    });
    
    // Debug: Log users with manager relationships
    const usersWithManagers = users.filter(u => u.managerId);
    console.log('Users with managers:', usersWithManagers.map(u => ({
        name: `${u.firstName} ${u.lastName}`,
        managerId: u.managerId,
        managerName: u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : 'Unknown'
    })));
    
    // Build department hierarchy
    const rootDepartments = [];
    departments.forEach(dept => {
        const deptNode = departmentMap.get(dept.id);
        if (dept.parentId && departmentMap.has(dept.parentId)) {
            const parent = departmentMap.get(dept.parentId);
            parent.children.push(deptNode);
        } else {
            rootDepartments.push(deptNode);
        }
    });
      // Assign users to departments and build manager hierarchy
    users.forEach(user => {
        const userNode = userMap.get(user.id);
        if (user.departmentId && departmentMap.has(user.departmentId)) {
            const department = departmentMap.get(user.departmentId);
            
            // If user has a manager in the same department, they'll be placed under the manager
            // Otherwise, they go directly under the department
            if (user.managerId && userMap.has(user.managerId)) {
                const manager = userMap.get(user.managerId);
                // Only create manager-subordinate relationship if they're in the same department
                if (manager.departmentId === user.departmentId) {
                    manager.children.push(userNode);
                    return; // Skip adding to department directly
                }
            }
            
            // Add directly to department (heads, managers without managers, or cross-department reports)
            if (user.id === department.headId) {
                department.children.unshift(userNode);
            } else {
                department.children.push(userNode);
            }
        } else {
            // Users without departments - handle manager hierarchy at org level
            if (user.managerId && userMap.has(user.managerId)) {
                const manager = userMap.get(user.managerId);
                manager.children.push(userNode);
            } else {
                rootDepartments.push(userNode);
            }
        }
    });
    
    // Sort children in each node
    const sortNodes = (nodes) => {
        nodes.forEach(node => {
            if (node.children && node.children.length > 0) {
                node.children.sort((a, b) => {
                    // Departments first
                    if (a.type === 'department' && b.type === 'user') return -1;
                    if (a.type === 'user' && b.type === 'department') return 1;
                    
                    // Among users, heads first
                    if (a.type === 'user' && b.type === 'user') {
                        if (a.isHead && !b.isHead) return -1;
                        if (!a.isHead && b.isHead) return 1;
                        if (a.isManager && !b.isManager) return -1;
                        if (!a.isManager && b.isManager) return 1;
                    }
                    
                    // Sort by name
                    const nameA = a.name || `${a.firstName} ${a.lastName}`;
                    const nameB = b.name || `${b.firstName} ${b.lastName}`;
                    return nameA.localeCompare(nameB);
                });
                
                sortNodes(node.children);
            }
        });
    };
    
    sortNodes(rootDepartments);
    
    return rootDepartments;
}

// Get organization chart hierarchy focused on manager-subordinate relationships
export const getManagerSubordinateChart = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { userId } = req.query; // Optional: center on specific user

        // Fetch organization with user data
        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                users: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        employeeId: true,
                        departmentId: true,
                        managerId: true,
                        department: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        manager: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        subordinates: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        roles: {
                            include: {
                                role: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                        headId: true
                    }
                },
                Organization_admin: {
                    select: {
                        adminId: true
                    }
                }
            }
        });

        if (!organization) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Check if the requesting user is an organization admin
        const isOrgAdmin = organization.Organization_admin.some(admin => admin.adminId === userId);

        // Build manager-subordinate focused structure based on user role
        const managerChart = buildManagerSubordinateStructure(organization, userId, isOrgAdmin);
        
        res.status(200).json({
            organization: {
                id: organization.id,
                name: organization.name
            },
            chart: managerChart,
            focusUserId: userId,
            isOrgAdmin: isOrgAdmin
        });

    } catch (error) {
        console.error('Error fetching manager-subordinate chart:', error);
        res.status(500).json({ error: error.message });
    }
};

// Helper function to build manager-subordinate structure
function buildManagerSubordinateStructure(organization, focusUserId = null, isOrgAdmin = false) {
    const { users, departments } = organization;
    
    // Create user map for quick lookup
    const userMap = new Map();
    users.forEach(user => {
        userMap.set(user.id, {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            type: 'user',
            departmentId: user.departmentId,
            departmentName: user.department?.name,
            managerId: user.managerId,
            manager: user.manager,
            subordinates: user.subordinates || [],
            isHead: departments.some(dept => dept.headId === user.id),
            isManager: user.subordinates && user.subordinates.length > 0,
            roles: user.roles || [],
            children: []
        });
    });

    // Build manager-subordinate relationships
    users.forEach(user => {
        if (user.managerId && userMap.has(user.managerId)) {
            const manager = userMap.get(user.managerId);
            const subordinate = userMap.get(user.id);
            manager.children.push(subordinate);
        }
    });

    // If user is organization admin, return full hierarchy
    if (isOrgAdmin) {
        const rootUsers = users
            .filter(user => !user.managerId)
            .map(user => userMap.get(user.id));

        // Sort root users by hierarchy importance
        rootUsers.sort((a, b) => {
            if (a.isHead && !b.isHead) return -1;
            if (!a.isHead && b.isHead) return 1;
            if (a.isManager && !b.isManager) return -1;
            if (!a.isManager && b.isManager) return 1;
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        });

        return rootUsers;
    }

    // For regular users, implement restricted view
    if (focusUserId && userMap.has(focusUserId)) {
        const focusUser = userMap.get(focusUserId);
        
        // Function to get all subordinates recursively
        const getAllSubordinates = (userId, visited = new Set()) => {
            if (visited.has(userId)) return [];
            visited.add(userId);
            
            const user = userMap.get(userId);
            if (!user) return [];
            
            const result = [user];
            user.children.forEach(child => {
                result.push(...getAllSubordinates(child.id, visited));
            });
            
            return result;
        };

        // Function to get siblings (other direct reports of the same manager)
        const getSiblings = (userId) => {
            const user = userMap.get(userId);
            if (!user || !user.managerId) return [];
            
            const manager = userMap.get(user.managerId);
            if (!manager) return [];
            
            return manager.children.filter(child => child.id !== userId);
        };

        // Build the hierarchy for focus user
        const visibleUsers = new Set();
        
        // 1. Add focus user and all their subordinates
        const subordinateHierarchy = getAllSubordinates(focusUserId);
        subordinateHierarchy.forEach(user => visibleUsers.add(user.id));

        // 2. Add manager and siblings if they exist
        if (focusUser.managerId) {
            const manager = userMap.get(focusUser.managerId);
            if (manager) {
                visibleUsers.add(manager.id);
                
                // Add siblings
                const siblings = getSiblings(focusUserId);
                siblings.forEach(sibling => visibleUsers.add(sibling.id));
                
                // Add manager's manager (grandparent) if exists
                if (manager.managerId) {
                    const grandManager = userMap.get(manager.managerId);
                    if (grandManager) {
                        visibleUsers.add(grandManager.id);
                    }
                }
            }
        }

        // Rebuild the hierarchy with only visible users
        const filteredUserMap = new Map();
        visibleUsers.forEach(userId => {
            const user = userMap.get(userId);
            if (user) {
                filteredUserMap.set(userId, {
                    ...user,
                    children: []
                });
            }
        });

        // Rebuild relationships for visible users only
        filteredUserMap.forEach((user, userId) => {
            if (user.managerId && filteredUserMap.has(user.managerId)) {
                const manager = filteredUserMap.get(user.managerId);
                const subordinate = filteredUserMap.get(userId);
                manager.children.push(subordinate);
            }
        });

        // Find the root of this filtered hierarchy
        const filteredRootUsers = Array.from(filteredUserMap.values())
            .filter(user => !user.managerId || !filteredUserMap.has(user.managerId));

        // If focus user has a manager, start from the highest visible manager
        if (focusUser.managerId && filteredUserMap.has(focusUser.managerId)) {
            const manager = filteredUserMap.get(focusUser.managerId);
            if (manager.managerId && filteredUserMap.has(manager.managerId)) {
                const grandManager = filteredUserMap.get(manager.managerId);
                return [grandManager];
            } else {
                return [manager];
            }
        } else {
            // If no manager, start from focus user
            return [filteredUserMap.get(focusUserId)];
        }
    }

    // Fallback: return empty if no valid user
    return [];
}
