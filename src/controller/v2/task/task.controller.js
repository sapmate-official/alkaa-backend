import prisma from "../../../db/connectDb.js";
import { generateId } from "../../../util/generate.js";
import { logActivity } from "../../../util/activityLogger.js";

export const taskController = {
    async createTask(req, res) {
        try {
            const { title, description, priority, dueDate, assignedToIds, groupId } = req.body;
            const createdById = req.user.id;

            const task = await prisma.task.create({
                data: {
                    id: generateId(),
                    title,
                    description,
                    priority: priority || 'MEDIUM',
                    dueDate: dueDate ? new Date(dueDate) : null,
                    status: 'PENDING',
                    createdById,
                    orgId: req.user.orgId,
                    groupId: groupId || null,
                }
            });

            const assignments = [];
            
            if (assignedToIds && assignedToIds.length > 0) {
                for (const userId of assignedToIds) {
                    assignments.push({
                        id: generateId(),
                        taskId: task.id,
                        assignedToId: userId,
                        assignedById: createdById,
                    });
                }
            }

            if (assignments.length > 0) {
                await prisma.taskAssignment.createMany({
                    data: assignments
                });
            }

            await logActivity({
                orgId: req.user.orgId,
                actorId: req.user.id,
                action: 'CREATE',
                entity: 'TASK',
                entityId: task.id,
                description: `Created task: ${title}`,
                metadata: { taskId: task.id }
            });

            res.status(201).json({
                success: true,
                message: 'Task created successfully',
                data: task
            });
        } catch (error) {
            console.error('Create task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create task',
                error: error.message
            });
        }
    },

    async getAllTasks(req, res) {
        try {
            const { page = 1, limit = 10, status, priority, assignedTo } = req.query;
            const userId = req.user.id;
            const orgId = req.user.orgId;

            const where = {
                orgId,
                ...(status && { status }),
                ...(priority && { priority }),
            };

            if (assignedTo === 'me') {
                where.assignments = {
                    some: {
                        assignedToId: userId
                    }
                };
            }

            const tasks = await prisma.task.findMany({
                where,
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    group: {
                        select: { id: true, name: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            updatedBy: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: parseInt(limit)
            });

            const total = await prisma.task.count({ where });

            res.json({
                success: true,
                data: tasks,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Get tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch tasks',
                error: error.message
            });
        }
    },

    async getTaskById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const task = await prisma.task.findFirst({
                where: {
                    id,
                    OR: [
                        { createdById: userId },
                        { assignments: { some: { assignedToId: userId } } },
                        { orgId: req.user.orgId }
                    ]
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    group: {
                        select: { id: true, name: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            updatedBy: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found'
                });
            }

            res.json({
                success: true,
                data: task
            });
        } catch (error) {
            console.error('Get task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch task',
                error: error.message
            });
        }
    },

    async updateTask(req, res) {
        try {
            const { id } = req.params;
            const { title, description, priority, dueDate, status } = req.body;
            const userId = req.user.id;

            const existingTask = await prisma.task.findFirst({
                where: {
                    id,
                    OR: [
                        { createdById: userId },
                        { assignments: { some: { assignedToId: userId } } }
                    ]
                }
            });

            if (!existingTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            const updateData = {};
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (priority !== undefined) updateData.priority = priority;
            if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
            if (status !== undefined) updateData.status = status;

            const updatedTask = await prisma.task.update({
                where: { id },
                data: updateData,
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    group: {
                        select: { id: true, name: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            updatedBy: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK',
                entityId: id,
                description: `Updated task: ${updatedTask.title}`,
                metadata: { taskId: id }
            });

            res.json({
                success: true,
                message: 'Task updated successfully',
                data: updatedTask
            });
        } catch (error) {
            console.error('Update task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update task',
                error: error.message
            });
        }
    },

    async patchTask(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            // Check if user has permission to update this task
            const existingTask = await prisma.task.findFirst({
                where: {
                    id,
                    OR: [
                        { createdById: userId },
                        { assignments: { some: { assignedToId: userId } } }
                    ]
                }
            });

            if (!existingTask) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            // Only update fields that are provided in the request
            const updateData = {};
            const { title, description, priority, dueDate, status } = req.body;
            
            if (title !== undefined) updateData.title = title;
            if (description !== undefined) updateData.description = description;
            if (priority !== undefined) updateData.priority = priority;
            if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
            if (status !== undefined) updateData.status = status;

            // If no fields to update, return current task
            if (Object.keys(updateData).length === 0) {
                return res.json({
                    success: true,
                    message: 'No changes provided',
                    data: existingTask
                });
            }

            const updatedTask = await prisma.task.update({
                where: { id },
                data: updateData,
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    group: {
                        select: { id: true, name: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            updatedBy: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK',
                entityId: id,
                description: `Updated task: ${updatedTask.title}`,
                metadata: { 
                    taskId: id,
                    fieldsUpdated: Object.keys(updateData)
                }
            });

            res.json({
                success: true,
                message: 'Task updated successfully',
                data: updatedTask
            });
        } catch (error) {
            console.error('Patch task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update task',
                error: error.message
            });
        }
    },

    async deleteTask(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const task = await prisma.task.findFirst({
                where: {
                    id,
                    createdById: userId
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            await prisma.taskAssignment.deleteMany({
                where: { taskId: id }
            });

            await prisma.taskUpdate.deleteMany({
                where: { taskId: id }
            });

            await prisma.task.delete({
                where: { id }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: userId,
                action: 'DELETE',
                entity: 'TASK',
                entityId: id,
                description: `Deleted task: ${task.title}`,
                metadata: { taskId: id }
            });

            res.json({
                success: true,
                message: 'Task deleted successfully'
            });
        } catch (error) {
            console.error('Delete task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete task',
                error: error.message
            });
        }
    },

    async getTasksByUser(req, res) {
        try {
            const { userId } = req.params;
            const requesterId = req.user.id;

            if (userId !== requesterId && !req.isManager) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            const tasks = await prisma.task.findMany({
                where: {
                    orgId: req.user.orgId,
                    assignments: {
                        some: {
                            assignedToId: userId
                        }
                    }
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    group: {
                        select: { id: true, name: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            updatedBy: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: tasks
            });
        } catch (error) {
            console.error('Get user tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch user tasks',
                error: error.message
            });
        }
    },

    async getTasksByManager(req, res) {
        try {
            const { managerId } = req.params;
            const requesterId = req.user.id;

            if (managerId !== requesterId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            const tasks = await prisma.task.findMany({
                where: {
                    createdById: managerId
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    group: {
                        select: { id: true, name: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            assignedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            updatedBy: {
                                select: { id: true, firstName: true, lastName: true }
                            }
                        },
                        orderBy: { createdAt: 'desc' }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: tasks
            });
        } catch (error) {
            console.error('Get manager tasks error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch manager tasks',
                error: error.message
            });
        }
    },

    async addTaskUpdate(req, res) {
        try {
            const { taskId } = req.params;
            const { updateType, message, progress } = req.body;
            const userId = req.user.id;

            const task = await prisma.task.findFirst({
                where: {
                    id: taskId,
                    OR: [
                        { createdById: userId },
                        { assignments: { some: { assignedToId: userId } } }
                    ]
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            const update = await prisma.taskUpdate.create({
                data: {
                    id: generateId(),
                    taskId,
                    updatedById: userId,
                    updateType: updateType || 'COMMENT',
                    message,
                    progress: progress || null
                },
                include: {
                    updatedBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK_UPDATE',
                entityId: update.id,
                description: `Added update to task: ${task.title}`,
                metadata: { taskId, updateId: update.id }
            });

            res.status(201).json({
                success: true,
                message: 'Task update added successfully',
                data: update
            });
        } catch (error) {
            console.error('Add task update error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add task update',
                error: error.message
            });
        }
    },

    async assignTask(req, res) {
        try {
            const { taskId } = req.params;
            const { userIds } = req.body;
            const assignedById = req.user.id;

            // Check if task exists and user has permission
            const task = await prisma.task.findFirst({
                where: {
                    id: taskId,
                    OR: [
                        { createdById: assignedById },
                        { orgId: req.user.orgId } // Allow if user is from same organization
                    ]
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            // Create assignments for each user
            const assignments = [];
            for (const userId of userIds) {
                // Check if assignment already exists
                const existingAssignment = await prisma.taskAssignment.findFirst({
                    where: {
                        taskId,
                        assignedToId: userId
                    }
                });

                if (!existingAssignment) {
                    assignments.push({
                        id: generateId(),
                        taskId,
                        assignedToId: userId,
                        assignedById,
                        status: 'ASSIGNED'
                    });
                }
            }

            if (assignments.length > 0) {
                await prisma.taskAssignment.createMany({
                    data: assignments
                });
            }

            // Get the created assignments with user details
            const createdAssignments = await prisma.taskAssignment.findMany({
                where: {
                    taskId,
                    assignedToId: { in: userIds }
                },
                include: {
                    assignedTo: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    assignedBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    }
                }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: assignedById,
                action: 'ASSIGN',
                entity: 'TASK',
                entityId: taskId,
                description: `Assigned task: ${task.title} to ${userIds.length} user(s)`,
                metadata: { taskId, userIds }
            });

            res.status(201).json({
                success: true,
                message: 'Task assigned successfully',
                data: createdAssignments
            });
        } catch (error) {
            console.error('Assign task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to assign task',
                error: error.message
            });
        }
    },

    async unassignTask(req, res) {
        try {
            const { taskId } = req.params;
            const { userId } = req.body;
            const requesterId = req.user.id;

            // Check if task exists and user has permission
            const task = await prisma.task.findFirst({
                where: {
                    id: taskId,
                    OR: [
                        { createdById: requesterId },
                        { orgId: req.user.orgId }
                    ]
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            // Check if assignment exists
            const assignment = await prisma.taskAssignment.findFirst({
                where: {
                    taskId,
                    assignedToId: userId
                }
            });

            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            // Delete the assignment
            await prisma.taskAssignment.delete({
                where: {
                    id: assignment.id
                }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: requesterId,
                action: 'UNASSIGN',
                entity: 'TASK',
                entityId: taskId,
                description: `Unassigned task: ${task.title} from user`,
                metadata: { taskId, userId }
            });

            res.json({
                success: true,
                message: 'Task unassigned successfully'
            });
        } catch (error) {
            console.error('Unassign task error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to unassign task',
                error: error.message
            });
        }
    },

    async getTaskAssignments(req, res) {
        try {
            const { taskId } = req.params;
            const requesterId = req.user.id;

            // Check if task exists and user has permission
            const task = await prisma.task.findFirst({
                where: {
                    id: taskId,
                    OR: [
                        { createdById: requesterId },
                        { assignments: { some: { assignedToId: requesterId } } },
                        { orgId: req.user.orgId }
                    ]
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            const assignments = await prisma.taskAssignment.findMany({
                where: { taskId },
                include: {
                    assignedTo: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    assignedBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    }
                }
            });

            res.json({
                success: true,
                data: assignments
            });
        } catch (error) {
            console.error('Get task assignments error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch task assignments',
                error: error.message
            });
        }
    },

    async getTaskUpdates(req, res) {
        try {
            const { taskId } = req.params;
            const requesterId = req.user.id;

            // Check if task exists and user has permission
            const task = await prisma.task.findFirst({
                where: {
                    id: taskId,
                    OR: [
                        { createdById: requesterId },
                        { assignments: { some: { assignedToId: requesterId } } },
                        { orgId: req.user.orgId }
                    ]
                }
            });

            if (!task) {
                return res.status(404).json({
                    success: false,
                    message: 'Task not found or access denied'
                });
            }

            const updates = await prisma.taskUpdate.findMany({
                where: { taskId },
                include: {
                    updatedBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: updates
            });
        } catch (error) {
            console.error('Get task updates error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch task updates',
                error: error.message
            });
        }
    }
};
