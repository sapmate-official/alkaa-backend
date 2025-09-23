import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';

// Get all salary templates
export const getSalaryTemplates = async (req, res) => {
    try {
        const { orgId } = req.user;
        
        const templates = await prisma.salaryTemplate.findMany({
            where: { 
                orgId: orgId 
            },
            include: {
                organization: true,
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
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

        const { orgId, id: userId } = req.user;
        const { name, description, isDefault, rules } = req.body;

        // If this template is set as default, unset other defaults
        if (isDefault) {
            await prisma.salaryTemplate.updateMany({
                where: { 
                    orgId: orgId,
                    isDefault: true 
                },
                data: { isDefault: false }
            });
        }

        const template = await prisma.salaryTemplate.create({
            data: {
                name,
                description,
                isDefault: isDefault || false,
                isActive: true,
                rules,
                orgId,
                createdById: userId
            },
            include: {
                organization: true,
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
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
        const existingTemplate = await prisma.salaryTemplate.findFirst({
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
            await prisma.salaryTemplate.updateMany({
                where: { 
                    orgId: orgId,
                    isDefault: true,
                    id: { not: templateId }
                },
                data: { isDefault: false }
            });
        }

        const updatedTemplate = await prisma.salaryTemplate.update({
            where: { id: templateId },
            data: {
                name,
                description,
                isDefault: isDefault !== undefined ? isDefault : existingTemplate.isDefault,
                isActive: isActive !== undefined ? isActive : existingTemplate.isActive,
                rules: rules || existingTemplate.rules
            },
            include: {
                organization: true,
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
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
        const existingTemplate = await prisma.salaryTemplate.findFirst({
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

        // Check if template is assigned to any employees
        const assignedEmployees = await prisma.user.count({
            where: {
                salaryTemplateId: templateId,
                orgId: orgId
            }
        });

        if (assignedEmployees > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete template. It is assigned to ${assignedEmployees} employee(s)`
            });
        }

        await prisma.salaryTemplate.delete({
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

// Get calculation rules
export const getCalculationRules = async (req, res) => {
    try {
        const { orgId } = req.user;
        
        const rules = await prisma.calculationRule.findMany({
            where: { 
                orgId: orgId 
            },
            orderBy: { createdAt: 'desc' }
        });

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

// Create calculation rule
export const createCalculationRule = async (req, res) => {
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
        const { name, formula, type, isActive } = req.body;

        const rule = await prisma.calculationRule.create({
            data: {
                name,
                formula,
                type,
                isActive: isActive !== undefined ? isActive : true,
                orgId
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Calculation rule created successfully',
            data: rule
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

// Assign template to employees
export const assignTemplate = async (req, res) => {
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
        const { templateId, employeeIds, departmentIds } = req.body;

        // Verify template exists and belongs to organization
        const template = await prisma.salaryTemplate.findFirst({
            where: {
                id: templateId,
                orgId: orgId
            }
        });

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Salary template not found'
            });
        }

        const updatePromises = [];

        // Assign to specific employees
        if (employeeIds && employeeIds.length > 0) {
            updatePromises.push(
                prisma.user.updateMany({
                    where: {
                        id: { in: employeeIds },
                        orgId: orgId
                    },
                    data: {
                        salaryTemplateId: templateId
                    }
                })
            );
        }

        // Assign to all employees in departments
        if (departmentIds && departmentIds.length > 0) {
            updatePromises.push(
                prisma.user.updateMany({
                    where: {
                        departmentId: { in: departmentIds },
                        orgId: orgId
                    },
                    data: {
                        salaryTemplateId: templateId
                    }
                })
            );
        }

        const results = await Promise.all(updatePromises);
        const totalAssigned = results.reduce((sum, result) => sum + result.count, 0);

        return res.status(200).json({
            success: true,
            message: `Template assigned to ${totalAssigned} employee(s) successfully`,
            data: {
                templateId,
                assignedCount: totalAssigned
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
