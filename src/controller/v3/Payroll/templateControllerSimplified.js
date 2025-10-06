import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';

// Get all salary templates (using existing PayrollTemplate model)
export const getSalaryTemplates = async (req, res) => {
    try {
        const { orgId } = req.user;
        
        const templates = await prisma.payrollTemplate.findMany({
            where: { 
                orgId: orgId 
            },
            include: {
                organization: true
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return res.status(200).json({
            success: true,
            message: 'Salary templates retrieved successfully',
            data: templates
        });
    } catch (error) {
        console.error('Error fetching salary templates:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch salary templates',
            error: error.message
        });
    }
};

// Create new salary template
export const createSalaryTemplate = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { orgId } = req.user;
        const { name, description, isDefault, rules } = req.body;

        // If this template is set as default, unset other defaults
        if (isDefault) {
            await prisma.payrollTemplate.updateMany({
                where: { 
                    orgId: orgId,
                    isDefault: true 
                },
                data: { isDefault: false }
            });
        }

        const template = await prisma.payrollTemplate.create({
            data: {
                name,
                description,
                isDefault: isDefault || false,
                isActive: true,
                rules,
                orgId
            },
            include: {
                organization: true
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Salary template created successfully',
            data: template
        });
    } catch (error) {
        console.error('Error creating salary template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create salary template',
            error: error.message
        });
    }
};

// Update salary template
export const updateSalaryTemplate = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation errors',
                errors: errors.array()
            });
        }

        const { templateId } = req.params;
        const { orgId } = req.user;
        const { name, description, isDefault, isActive, rules } = req.body;

        // Check if template exists and belongs to organization
        const existingTemplate = await prisma.payrollTemplate.findFirst({
            where: {
                id: templateId,
                orgId: orgId
            }
        });

        if (!existingTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Salary template not found'
            });
        }

        // If this template is set as default, unset other defaults
        if (isDefault && !existingTemplate.isDefault) {
            await prisma.payrollTemplate.updateMany({
                where: { 
                    orgId: orgId,
                    isDefault: true,
                    id: { not: templateId }
                },
                data: { isDefault: false }
            });
        }

        const updatedTemplate = await prisma.payrollTemplate.update({
            where: { id: templateId },
            data: {
                name: name || existingTemplate.name,
                description: description !== undefined ? description : existingTemplate.description,
                isDefault: isDefault !== undefined ? isDefault : existingTemplate.isDefault,
                isActive: isActive !== undefined ? isActive : existingTemplate.isActive,
                rules: rules || existingTemplate.rules
            },
            include: {
                organization: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Salary template updated successfully',
            data: updatedTemplate
        });
    } catch (error) {
        console.error('Error updating salary template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update salary template',
            error: error.message
        });
    }
};

// Delete salary template
export const deleteSalaryTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;
        const { orgId } = req.user;

        // Check if template exists and belongs to organization
        const existingTemplate = await prisma.payrollTemplate.findFirst({
            where: {
                id: templateId,
                orgId: orgId
            }
        });

        if (!existingTemplate) {
            return res.status(404).json({
                success: false,
                message: 'Salary template not found'
            });
        }

        // Prevent deletion of default template
        if (existingTemplate.isDefault) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete default salary template'
            });
        }

        await prisma.payrollTemplate.delete({
            where: { id: templateId }
        });

        return res.status(200).json({
            success: true,
            message: 'Salary template deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting salary template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete salary template',
            error: error.message
        });
    }
};

// Get calculation rules (simplified - return predefined rules)
export const getCalculationRules = async (req, res) => {
    try {
        // Return predefined calculation rules since we don't have a separate table
        const rules = [
            {
                id: '1',
                name: 'HRA Calculation',
                formula: 'basicSalary * 0.40',
                type: 'allowance',
                isActive: true
            },
            {
                id: '2',
                name: 'DA Calculation',
                formula: 'basicSalary * 0.10',
                type: 'allowance',
                isActive: true
            },
            {
                id: '3',
                name: 'PF Deduction',
                formula: 'basicSalary * 0.12',
                type: 'deduction',
                isActive: true
            },
            {
                id: '4',
                name: 'ESI Deduction',
                formula: 'grossSalary * 0.0075',
                type: 'deduction',
                isActive: true
            },
            {
                id: '5',
                name: 'Income Tax',
                formula: 'Based on tax slabs',
                type: 'tax',
                isActive: true
            }
        ];

        return res.status(200).json({
            success: true,
            message: 'Calculation rules retrieved successfully',
            data: rules
        });
    } catch (error) {
        console.error('Error fetching calculation rules:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch calculation rules',
            error: error.message
        });
    }
};

// Create calculation rule (placeholder)
export const createCalculationRule = async (req, res) => {
    try {
        return res.status(201).json({
            success: true,
            message: 'Calculation rule created successfully (placeholder)',
            data: { ...req.body, id: Date.now().toString() }
        });
    } catch (error) {
        console.error('Error creating calculation rule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create calculation rule',
            error: error.message
        });
    }
};

// Assign template to users (placeholder)
export const assignTemplate = async (req, res) => {
    try {
        const { templateId, employeeIds = [], departmentIds = [] } = req.body;
        
        // This would normally update user records, but for now return success
        return res.status(200).json({
            success: true,
            message: `Template assigned successfully (placeholder)`,
            data: {
                templateId,
                assignedCount: employeeIds.length + departmentIds.length
            }
        });
    } catch (error) {
        console.error('Error assigning template:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to assign template',
            error: error.message
        });
    }
};
