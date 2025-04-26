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
                users: true
            }
        });
        console.log(departments);
        
        res.status(200).json(departments);
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
                    users: true
                }
            });
            if (!department) {
                return res.status(404).json({ error: "Department not found" });
            }
            res.status(200).json(department);
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