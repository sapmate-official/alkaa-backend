import prisma from '../../../db/connectDb.js';
import { body, param, validationResult } from 'express-validator';

// Get all departments
export const getDepartment = async (req, res) => {
    try {
        const {orgId} = req.params;
        const departments = await prisma.department.findMany({
            where: {orgId},
            include: {
                organization: true,
                departmentHead: true,
                parentDepartment: true,
                subDepartments: true,
                users: true, // Legacy direct users
                // NEW: Include multi-department assignments
                userDepartments: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                employeeId: true,
                                status: true
                            }
                        }
                    }
                }
            }
        });

        // NEW: Enhance response with multi-department statistics
        const enhancedDepartments = departments.map(dept => {
            const totalUsers = new Set([
                ...dept.users.map(u => u.id), // Legacy users
                ...dept.userDepartments.map(ud => ud.user.id) // Multi-department users
            ]).size;

            const primaryUsers = dept.userDepartments.filter(ud => ud.isPrimary).length;
            const secondaryUsers = dept.userDepartments.filter(ud => !ud.isPrimary).length;

            return {
                ...dept,
                // Legacy count for backward compatibility
                userCount: dept.users.length,
                // NEW: Multi-department statistics
                statistics: {
                    totalUniqueUsers: totalUsers,
                    primaryAssignments: primaryUsers,
                    secondaryAssignments: secondaryUsers,
                    legacyUsers: dept.users.length,
                    totalAssignments: dept.userDepartments.length
                },
                // NEW: User breakdown by assignment type
                userBreakdown: {
                    primaryUsers: dept.userDepartments.filter(ud => ud.isPrimary).map(ud => ({
                        ...ud.user,
                        assignedAt: ud.assignedAt,
                        role: ud.role
                    })),
                    secondaryUsers: dept.userDepartments.filter(ud => !ud.isPrimary).map(ud => ({
                        ...ud.user,
                        assignedAt: ud.assignedAt,
                        role: ud.role
                    })),
                    legacyUsers: dept.users.map(user => ({
                        ...user,
                        assignmentType: 'legacy'
                    }))
                }
            };
        });
        
        res.status(200).json(enhancedDepartments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get department by ID
export const getDepartmentById = [
    param('id').isString().withMessage('ID must be a string'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        try {
            const department = await prisma.department.findUnique({
                where: { id },
                include: {
                    organization: true,
                    departmentHead: true,
                    parentDepartment: true,
                    subDepartments: true,
                    users: true, // Legacy direct users
                    // NEW: Include multi-department assignments with detailed user info
                    userDepartments: {
                        include: {
                            user: {
                                include: {
                                    roles: {
                                        include: {
                                            role: {
                                                select: {
                                                    id: true,
                                                    name: true,
                                                    description: true
                                                }
                                            }
                                        }
                                    },
                                    // Include other departments for this user
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
                            }
                        }
                    }
                }
            });
            if (!department) {
                return res.status(404).json({ error: "Department not found" });
            }

            // NEW: Enhance response with detailed multi-department analysis
            const enhancedDepartment = {
                ...department,
                // Legacy user count for backward compatibility
                userCount: department.users.length,
                // NEW: Enhanced statistics
                statistics: {
                    totalUniqueUsers: new Set([
                        ...department.users.map(u => u.id),
                        ...department.userDepartments.map(ud => ud.user.id)
                    ]).size,
                    primaryAssignments: department.userDepartments.filter(ud => ud.isPrimary).length,
                    secondaryAssignments: department.userDepartments.filter(ud => !ud.isPrimary).length,
                    totalAssignments: department.userDepartments.length,
                    multiDepartmentUsers: department.userDepartments.filter(ud => 
                        ud.user.userDepartments.length > 1
                    ).length
                },
                // NEW: Detailed user analysis
                userAnalysis: {
                    primaryUsers: department.userDepartments.filter(ud => ud.isPrimary).map(ud => ({
                        id: ud.user.id,
                        name: `${ud.user.firstName} ${ud.user.lastName}`,
                        email: ud.user.email,
                        employeeId: ud.user.employeeId,
                        assignedAt: ud.assignedAt,
                        role: ud.role,
                        isMultiDepartment: ud.user.userDepartments.length > 1,
                        otherDepartments: ud.user.userDepartments
                            .filter(uud => uud.departmentId !== id)
                            .map(uud => ({
                                id: uud.department.id,
                                name: uud.department.name,
                                isPrimary: uud.isPrimary
                            })),
                        systemRoles: ud.user.roles.map(ur => ur.role)
                    })),
                    secondaryUsers: department.userDepartments.filter(ud => !ud.isPrimary).map(ud => ({
                        id: ud.user.id,
                        name: `${ud.user.firstName} ${ud.user.lastName}`,
                        email: ud.user.email,
                        employeeId: ud.user.employeeId,
                        assignedAt: ud.assignedAt,
                        role: ud.role,
                        primaryDepartment: ud.user.userDepartments.find(uud => uud.isPrimary)?.department || null,
                        otherDepartments: ud.user.userDepartments
                            .filter(uud => uud.departmentId !== id)
                            .map(uud => ({
                                id: uud.department.id,
                                name: uud.department.name,
                                isPrimary: uud.isPrimary
                            })),
                        systemRoles: ud.user.roles.map(ur => ur.role)
                    }))
                }
            };

            res.status(200).json(enhancedDepartment);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
];

// Create a new department
export const createDepartment = [
    body('orgId').isString().withMessage('Organization ID must be a string'),
    body('name').isString().withMessage('Name must be a string'),
    body('description').optional().isString(),
    body('code').optional().isString(),
    body('headId').optional({nullable:true}).isString(),
    body('parentId').optional({ nullable: true }).isString(),
    body('location').optional().isString(),
    body('budget').optional().isFloat(),
    body('status').optional().isBoolean(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log(errors);
            
            return res.status(400).json({ errors: errors.array() });
        }

        const { 
            orgId, 
            name, 
            description, 
            code,
            headId,
            parentId,
            location,
            budget,
            status
        } = req.body;

        try {
            const newDepartment = await prisma.department.create({
                data: {
                    orgId,
                    name,
                    description,
                    code,
                    headId,
                    parentId,
                    location,
                    budget,
                    status: status ?? true
                },
                include: {
                    organization: true,
                    departmentHead: true,
                    parentDepartment: true
                }
            });
            res.status(201).json(newDepartment);
        } catch (error) {
            console.log(error);
            
            res.status(500).json({ error: error.message });
        }
    }
];

// Update a department
export const updateDepartment = [
    param('id').isString().withMessage('ID must be a string'),
    body('name').optional().isString(),
    body('description').optional().isString(),
    body('code').optional().isString(),
    body('headId').optional().isString(),
    body('parentId').optional().isString(),
    body('location').optional().isString(),
    body('budget').optional().isFloat(),
    body('status').optional().isBoolean(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const updateData = req.body;

        try {
            const updatedDepartment = await prisma.department.update({
                where: { id },
                data: updateData,
                include: {
                    organization: true,
                    departmentHead: true,
                    parentDepartment: true,
                    subDepartments: true,
                    users: true
                }
            });
            res.status(200).json(updatedDepartment);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
];

// Delete a department
export const deleteDepartment = [
    param('id').isString().withMessage('ID must be a string'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        try {
            await prisma.department.delete({
                where: { id }
            });
            res.status(204).send();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
];

// Update department head
export const updateDepartmentHead = async (req, res) => {
    const { id, userId } = req.params;
    
    try {
        // Check if both department and user exist
        const department = await prisma.department.findUnique({
            where: { id }
        });
        
        if (!department) {
            return res.status(404).json({ error: 'Department not found' });
        }
        
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update the department with the new head
        const updatedDepartment = await prisma.department.update({
            where: { id },
            data: { headId: userId },
            include: {
                organization: true,
                departmentHead: true,
                parentDepartment: true,
                subDepartments: true,
                users: true
            }
        });
        
        res.status(200).json(updatedDepartment);
    } catch (error) {
        console.error('Error updating department head:', error);
        res.status(500).json({ error: error.message });
    }
};