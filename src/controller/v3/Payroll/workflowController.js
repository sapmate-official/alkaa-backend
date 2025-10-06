import prisma from '../../../db/connectDb.js';
import { validationResult } from 'express-validator';

// Get workflow status for organization
export const getWorkflowStatus = async (req, res) => {
    try {
        const { orgId } = req.user;
        const { month, year } = req.query;

        // Use current month/year if not provided
        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        // Get active payroll cycle for the period
        const activeCycle = await prisma.payrollCycle.findFirst({
            where: {
                orgId: orgId,
                month: targetMonth,
                year: targetYear
            },
            orderBy: { createdAt: 'desc' }
        });

        // Get workflow steps for this period
        const workflowSteps = await prisma.workflowStep.findMany({
            where: {
                orgId: orgId,
                month: targetMonth,
                year: targetYear
            },
            orderBy: { order: 'asc' }
        });

        // Calculate overall progress
        const totalSteps = workflowSteps.length;
        const completedSteps = workflowSteps.filter(step => step.status === 'completed').length;
        const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

        // Determine current phase
        let currentPhase = 'setup';
        if (activeCycle) {
            switch (activeCycle.status) {
                case 'DRAFT':
                case 'PENDING':
                    currentPhase = 'setup';
                    break;
                case 'IN_PROGRESS':
                    currentPhase = 'cycle';
                    break;
                case 'REVIEW':
                    currentPhase = 'review';
                    break;
                case 'COMPLETED':
                    currentPhase = 'reporting';
                    break;
                default:
                    currentPhase = 'setup';
            }
        }

        // Categorize steps
        const activeSteps = workflowSteps.filter(step => 
            step.status === 'in-progress' || step.status === 'pending'
        );
        const completedStepsData = workflowSteps.filter(step => step.status === 'completed');
        const blockedSteps = workflowSteps.filter(step => step.status === 'blocked');

        const workflowStatus = {
            currentPhase,
            overallProgress,
            activeCycle: activeCycle || null,
            activeSteps,
            completedSteps: completedStepsData,
            blockedSteps,
            month: targetMonth,
            year: targetYear
        };

        return res.status(200).json({
            success: true,
            message: 'Workflow status retrieved successfully',
            data: workflowStatus
        });
    } catch (error) {
        console.error('Error fetching workflow status:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch workflow status',
            error: error.message
        });
    }
};

// Get all workflow steps
export const getWorkflowSteps = async (req, res) => {
    try {
        const { orgId } = req.user;
        const { month, year, phase, status } = req.query;

        const whereClause = { orgId };

        if (month && year) {
            whereClause.month = parseInt(month);
            whereClause.year = parseInt(year);
        }

        if (phase) {
            whereClause.phase = phase;
        }

        if (status) {
            whereClause.status = status;
        }

        const steps = await prisma.workflowStep.findMany({
            where: whereClause,
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true
                    }
                },
                completedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true
                    }
                }
            },
            orderBy: [
                { phase: 'asc' },
                { order: 'asc' }
            ]
        });

        return res.status(200).json({
            success: true,
            message: 'Workflow steps retrieved successfully',
            data: steps
        });
    } catch (error) {
        console.error('Error fetching workflow steps:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch workflow steps',
            error: error.message
        });
    }
};

// Update workflow step
export const updateWorkflowStep = async (req, res) => {
    try {
        const { stepId } = req.params;
        const { id: userId, orgId } = req.user;
        const { status, comments, completedAt } = req.body;

        // Verify step exists and belongs to organization
        const step = await prisma.workflowStep.findFirst({
            where: {
                id: stepId,
                orgId: orgId
            }
        });

        if (!step) {
            return res.status(404).json({
                success: false,
                message: 'Workflow step not found'
            });
        }

        // Prepare update data
        const updateData = {};

        if (status) {
            updateData.status = status;
            
            if (status === 'completed') {
                updateData.completedAt = completedAt ? new Date(completedAt) : new Date();
                updateData.completedById = userId;
            }
        }

        if (comments) {
            updateData.comments = comments;
        }

        const updatedStep = await prisma.workflowStep.update({
            where: { id: stepId },
            data: updateData,
            include: {
                assignedTo: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true
                    }
                },
                completedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        employeeId: true
                    }
                }
            }
        });

        // If step is completed, check if we can auto-start dependent steps
        if (status === 'completed' && step.dependencies) {
            await checkAndStartDependentSteps(stepId, orgId);
        }

        return res.status(200).json({
            success: true,
            message: 'Workflow step updated successfully',
            data: updatedStep
        });
    } catch (error) {
        console.error('Error updating workflow step:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update workflow step',
            error: error.message
        });
    }
};

// Get workflow progress for organization
export const getWorkflowProgress = async (req, res) => {
    try {
        const { orgId } = req.user;
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
        const targetYear = year ? parseInt(year) : currentDate.getFullYear();

        // Get step counts by phase and status
        const stepStats = await prisma.workflowStep.groupBy({
            by: ['phase', 'status'],
            where: {
                orgId: orgId,
                month: targetMonth,
                year: targetYear
            },
            _count: {
                id: true
            }
        });

        // Get payroll cycle statistics
        const cycleStats = await prisma.payrollCycle.findFirst({
            where: {
                orgId: orgId,
                month: targetMonth,
                year: targetYear
            },
            select: {
                status: true,
                startDate: true,
                endDate: true,
                totalEmployees: true,
                processedCount: true,
                approvedCount: true,
                rejectedCount: true
            }
        });

        // Get employee counts
        const employeeStats = await prisma.user.groupBy({
            by: ['status'],
            where: {
                orgId: orgId
            },
            _count: {
                id: true
            }
        });

        const progress = {
            month: targetMonth,
            year: targetYear,
            stepStatistics: stepStats,
            cycleStatistics: cycleStats,
            employeeStatistics: employeeStats,
            lastUpdated: new Date()
        };

        return res.status(200).json({
            success: true,
            message: 'Workflow progress retrieved successfully',
            data: progress
        });
    } catch (error) {
        console.error('Error fetching workflow progress:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch workflow progress',
            error: error.message
        });
    }
};

// Initialize workflow for a new payroll cycle
export const initializeWorkflow = async (req, res) => {
    try {
        const { orgId, id: userId } = req.user;
        const { month, year, cycleId } = req.body;

        // Verify payroll cycle exists
        if (cycleId) {
            const cycle = await prisma.payrollCycle.findFirst({
                where: {
                    id: cycleId,
                    orgId: orgId
                }
            });

            if (!cycle) {
                return res.status(404).json({
                    success: false,
                    message: 'Payroll cycle not found'
                });
            }
        }

        // Check if workflow already exists for this period
        const existingWorkflow = await prisma.workflowStep.findFirst({
            where: {
                orgId: orgId,
                month: month,
                year: year
            }
        });

        if (existingWorkflow) {
            return res.status(400).json({
                success: false,
                message: 'Workflow already exists for this period'
            });
        }

        // Create default workflow steps
        const defaultSteps = [
            {
                title: 'Setup Salary Templates',
                description: 'Configure salary calculation templates and rules',
                phase: 'setup',
                order: 1,
                assignedTo: 'admin',
                estimatedHours: 2
            },
            {
                title: 'Employee Data Verification',
                description: 'Verify employee bank details and personal information',
                phase: 'setup',
                order: 2,
                assignedTo: 'employee',
                estimatedHours: 1
            },
            {
                title: 'Attendance Data Import',
                description: 'Import and validate attendance data for salary calculation',
                phase: 'cycle',
                order: 3,
                assignedTo: 'system',
                estimatedHours: 1,
                dependencies: ['1', '2']
            },
            {
                title: 'Salary Calculation',
                description: 'Execute salary calculation based on templates and attendance',
                phase: 'cycle',
                order: 4,
                assignedTo: 'system',
                estimatedHours: 2,
                dependencies: ['3']
            },
            {
                title: 'Manager Review',
                description: 'Manager review and approval of team salary calculations',
                phase: 'review',
                order: 5,
                assignedTo: 'manager',
                estimatedHours: 4,
                dependencies: ['4']
            },
            {
                title: 'Final Approval',
                description: 'Admin final approval and payment processing',
                phase: 'review',
                order: 6,
                assignedTo: 'admin',
                estimatedHours: 1,
                dependencies: ['5']
            },
            {
                title: 'Payment Processing',
                description: 'Process salary payments to employee bank accounts',
                phase: 'reporting',
                order: 7,
                assignedTo: 'system',
                estimatedHours: 2,
                dependencies: ['6']
            },
            {
                title: 'Payslip Generation',
                description: 'Generate and distribute payslips to employees',
                phase: 'reporting',
                order: 8,
                assignedTo: 'system',
                estimatedHours: 1,
                dependencies: ['7']
            }
        ];

        // Create workflow steps
        const createdSteps = await Promise.all(
            defaultSteps.map(async (stepData, index) => {
                return await prisma.workflowStep.create({
                    data: {
                        ...stepData,
                        id: (index + 1).toString(),
                        status: index === 0 ? 'pending' : 'blocked', // First step is pending, others blocked
                        month: month,
                        year: year,
                        orgId: orgId,
                        cycleId: cycleId || null,
                        createdById: userId
                    }
                });
            })
        );

        return res.status(201).json({
            success: true,
            message: 'Workflow initialized successfully',
            data: {
                steps: createdSteps,
                totalSteps: createdSteps.length
            }
        });
    } catch (error) {
        console.error('Error initializing workflow:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to initialize workflow',
            error: error.message
        });
    }
};

// Helper function to check and start dependent steps
async function checkAndStartDependentSteps(completedStepId, orgId) {
    try {
        // Find steps that depend on the completed step
        const dependentSteps = await prisma.workflowStep.findMany({
            where: {
                orgId: orgId,
                dependencies: {
                    has: completedStepId
                },
                status: 'blocked'
            }
        });

        for (const step of dependentSteps) {
            // Check if all dependencies are completed
            const dependencies = step.dependencies || [];
            const completedDependencies = await prisma.workflowStep.count({
                where: {
                    id: { in: dependencies },
                    orgId: orgId,
                    status: 'completed'
                }
            });

            // If all dependencies are completed, mark step as pending
            if (completedDependencies === dependencies.length) {
                await prisma.workflowStep.update({
                    where: { id: step.id },
                    data: { status: 'pending' }
                });
            }
        }
    } catch (error) {
        console.error('Error checking dependent steps:', error);
    }
}
