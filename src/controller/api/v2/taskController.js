const { PrismaClient } = require('@prisma/client');
const { generateId } = require('../../../util/generate');
const { logActivity } = require('../../../util/activityLogger');

const prisma = new PrismaClient();

const taskController = {
    async createTask(req, res) {
        try {
            const { title, description, priority, dueDate, assignedToIds, groupIds } = req.body;
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
                    organizationId: req.user.organizationId,
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

            if (groupIds && groupIds.length > 0) {
                for (const groupId of groupIds) {
                    const groupMembers = await prisma.taskGroup.findUnique({
                        where: { id: groupId },
                        include: { members: true }
                    });
                    
                    if (groupMembers) {
                        for (const member of groupMembers.members) {
                            assignments.push({
                                id: generateId(),
                                taskId: task.id,
                                assignedToId: member.userId,
                                assignedById: createdById,
                                groupId: groupId,
                            });
                        }
                    }
                }
            }

            if (assignments.length > 0) {
                await prisma.taskAssignment.createMany({
                    data: assignments
                });
            }

            await logActivity(req.user.id, req.user.organizationId, 'TASK_CREATED', 
                `Created task: ${title}`, { taskId: task.id });

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
            const organizationId = req.user.organizationId;

            const where = {
                organizationId,
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
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            group: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            createdBy: {
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
                        { organizationId: req.user.organizationId }
                    ]
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            group: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            createdBy: {
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
                data: updateData
            });

            await logActivity(userId, req.user.organizationId, 'TASK_UPDATED', 
                `Updated task: ${updatedTask.title}`, { taskId: id });

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

            await logActivity(userId, req.user.organizationId, 'TASK_DELETED', 
                `Deleted task: ${task.title}`, { taskId: id });

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

            if (userId !== requesterId && !req.user.isManager) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            const tasks = await prisma.task.findMany({
                where: {
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
                    assignments: {
                        where: { assignedToId: userId },
                        include: {
                            group: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            createdBy: {
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
                    assignments: {
                        include: {
                            assignedTo: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            group: {
                                select: { id: true, name: true }
                            }
                        }
                    },
                    updates: {
                        include: {
                            createdBy: {
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
            const { message, status } = req.body;
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
                    message,
                    status,
                    createdById: userId
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true }
                    }
                }
            });

            if (status && status !== task.status) {
                await prisma.task.update({
                    where: { id: taskId },
                    data: { status }
                });
            }

            await logActivity(userId, req.user.organizationId, 'TASK_UPDATE_ADDED', 
                `Added update to task: ${task.title}`, { taskId, updateId: update.id });

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
    }
};

module.exports = taskController;
