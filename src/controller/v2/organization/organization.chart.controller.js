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
            users: dept.users,
            children: []
        });
    });
      // Process users
    users.forEach(user => {
        userMap.set(user.id, {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            employeeId: user.employeeId,
            type: 'user',
            departmentId: user.departmentId,
            department: user.department,
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
