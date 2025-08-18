import prisma from "../../../../db/connectDb.js";

// List all employees
const listOfEmployees = async (req, res) => {
    try {
        console.log(req.params);
        
        const { orgId } = req.params;
        const { departmentId, includeAllDepartments } = req.query; // NEW: Filter by specific department
        
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID is required' });
        }

        // NEW: Build where clause for department filtering
        let whereClause = { orgId };
        
        if (departmentId && !includeAllDepartments) {
            // Filter by specific department - check both legacy departmentId and UserDepartment records
            whereClause = {
                ...whereClause,
                OR: [
                    { departmentId: departmentId }, // Legacy single department
                    {
                        userDepartments: {
                            some: {
                                departmentId: departmentId
                            }
                        }
                    }
                ]
            };
        }
        
        const employees = await prisma.user.findMany({
            where: whereClause,
            include: {
                department: true, // Legacy department
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
                    },
                    orderBy: {
                        isPrimary: 'desc' // Primary department first
                    }
                },
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
            }
        });

        // NEW: Enhance employee data with multi-department info
        const enhancedEmployees = employees.map(employee => ({
            ...employee,
            // Legacy support: keep single department
            department: employee.department,
            departmentId: employee.departmentId,
            // NEW: Multi-department data
            departments: employee.userDepartments?.map(ud => ({
                id: ud.department.id,
                name: ud.department.name,
                code: ud.department.code,
                isPrimary: ud.isPrimary,
                assignedAt: ud.assignedAt,
                role: ud.role || null
            })) || [],
            primaryDepartment: employee.userDepartments?.find(ud => ud.isPrimary)?.department || employee.department
        }));

        console.log(`Found ${enhancedEmployees.length} employees`);
        res.json(enhancedEmployees);
    } catch (error) {
        console.error('Error listing employees:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get employee by ID
const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;
        const employee = await prisma.user.findUnique({
            where: { id },
            include: {
                department: true, // Legacy department
                // NEW: Include multi-department data
                userDepartments: {
                    include: {
                        department: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                description: true
                            }
                        }
                    },
                    orderBy: {
                        isPrimary: 'desc' // Primary department first
                    }
                },
                roles: {
                    include: {
                        role: true
                    }
                },
                bankDetails: true,
                salaryParameter: true,
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                subordinates: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        departmentId: true,
                        department: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // NEW: Enhance response with multi-department info
        const enhancedEmployee = {
            ...employee,
            // Legacy support: keep single department
            department: employee.department,
            departmentId: employee.departmentId,
            // NEW: Multi-department data
            departments: employee.userDepartments?.map(ud => ({
                id: ud.department.id,
                name: ud.department.name,
                code: ud.department.code,
                description: ud.department.description,
                isPrimary: ud.isPrimary,
                assignedAt: ud.assignedAt,
                assignedBy: ud.assignedBy,
                role: ud.role || null
            })) || [],
            primaryDepartment: employee.userDepartments?.find(ud => ud.isPrimary)?.department || employee.department
        };

        res.json(enhancedEmployee);
    } catch (error) {
        console.error('Error getting employee by ID:', error);
        res.status(500).json({ error: error.message });
    }
};

export {
    listOfEmployees,
    getEmployeeById
};
