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

// Update calculation rule
export const updateCalculationRule = async (req, res) => {
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
        const { ruleId } = req.params;
        const { name, formula, type, isActive } = req.body;

        const existingRule = await prisma.calculationRule.findFirst({
            where: {
                id: ruleId,
                orgId
            }
        });

        if (!existingRule) {
            return res.status(404).json({
                success: false,
                message: 'Calculation rule not found'
            });
        }

        const data = {};
        if (name !== undefined) data.name = name;
        if (formula !== undefined) data.formula = formula;
        if (type !== undefined) data.type = type;
        if (typeof isActive === 'boolean') data.isActive = isActive;

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields provided for update'
            });
        }

        const updatedRule = await prisma.calculationRule.update({
            where: { id: ruleId },
            data
        });

        return res.status(200).json({
            success: true,
            message: 'Calculation rule updated successfully',
            data: updatedRule
        });
    } catch (error) {
        console.error('Error updating calculation rule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update calculation rule',
            error: error.message
        });
    }
};

// Delete calculation rule
export const deleteCalculationRule = async (req, res) => {
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
        const { ruleId } = req.params;

        const existingRule = await prisma.calculationRule.findFirst({
            where: {
                id: ruleId,
                orgId
            }
        });

        if (!existingRule) {
            return res.status(404).json({
                success: false,
                message: 'Calculation rule not found'
            });
        }

        await prisma.calculationRule.delete({
            where: { id: ruleId }
        });

        return res.status(200).json({
            success: true,
            message: 'Calculation rule deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting calculation rule:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete calculation rule',
            error: error.message
        });
    }
};

// Get template assignment summary
export const getTemplateAssignments = async (req, res) => {
    try {
        const { orgId } = req.user;

        const templates = await prisma.salaryTemplate.findMany({
            where: { orgId },
            select: {
                id: true,
                name: true,
                description: true,
                isDefault: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        users: true
                    }
                }
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        const departmentBreakdown = await prisma.user.groupBy({
            by: ['salaryTemplateId', 'departmentId'],
            where: {
                orgId,
                salaryTemplateId: { not: null },
                departmentId: { not: null }
            },
            _count: {
                _all: true
            }
        });

        const departmentIds = [...new Set(departmentBreakdown.map(item => item.departmentId))];

        const departments = departmentIds.length
            ? await prisma.department.findMany({
                where: { id: { in: departmentIds } },
                select: {
                    id: true,
                    name: true
                }
            })
            : [];

        const departmentMap = new Map(departments.map(dep => [dep.id, dep.name]));

        const departmentsByTemplate = departmentBreakdown.reduce((acc, item) => {
            if (!acc[item.salaryTemplateId]) {
                acc[item.salaryTemplateId] = [];
            }

            acc[item.salaryTemplateId].push({
                departmentId: item.departmentId,
                departmentName: departmentMap.get(item.departmentId) || 'Unknown Department',
                employeeCount: item._count._all
            });

            return acc;
        }, {});

        const data = templates.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            isDefault: template.isDefault,
            isActive: template.isActive,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt,
            assignedEmployees: template._count.users,
            departments: departmentsByTemplate[template.id] || []
        }));

        return res.status(200).json({
            success: true,
            message: 'Template assignment summary retrieved successfully',
            data
        });
    } catch (error) {
        console.error('Error fetching template assignments:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch template assignments',
            error: error.message
        });
    }
};

// Get available assignment targets (employees and departments)
export const getAssignmentTargets = async (req, res) => {
    try {
        const { orgId } = req.user;

        const [employees, departments] = await Promise.all([
            prisma.user.findMany({
                where: { orgId },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    salaryTemplateId: true,
                    department: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: [
                    { firstName: 'asc' },
                    { lastName: 'asc' }
                ]
            }),
            prisma.department.findMany({
                where: {
                    orgId,
                    status: true
                },
                select: {
                    id: true,
                    name: true
                },
                orderBy: { name: 'asc' }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: 'Assignment targets retrieved successfully',
            data: {
                employees,
                departments
            }
        });
    } catch (error) {
        console.error('Error fetching assignment targets:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch assignment targets',
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
