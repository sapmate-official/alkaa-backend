import prisma from "../../../db/connectDb.js";
import { generateId } from "../../../util/generate.js";
import { logActivity } from "../../../util/activityLogger.js";

export const taskGroupController = {
    async createGroup(req, res) {
        try {
            const { name, description } = req.body;
            const createdById = req.user.id;

            const group = await prisma.taskGroup.create({
                data: {
                    id: generateId(),
                    name,
                    description,
                    createdById,
                    orgId: req.user.orgId,
                }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: createdById,
                action: 'CREATE',
                entity: 'TASK_GROUP',
                entityId: group.id,
                description: `Created task group: ${name}`,
                metadata: { groupId: group.id }
            });

            res.status(201).json({
                success: true,
                message: 'Task group created successfully',
                data: group
            });
        } catch (error) {
            console.error('Create task group error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create task group',
                error: error.message
            });
        }
    },

    async getAllGroups(req, res) {
        try {
            const orgId = req.user.orgId;

            const groups = await prisma.taskGroup.findMany({
                where: { orgId },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    tasks: {
                        include: {
                            assignments: {
                                include: {
                                    assignedTo: {
                                        select: { id: true, firstName: true, lastName: true, email: true }
                                    }
                                }
                            }
                        }
                    },
                    _count: {
                        select: { tasks: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            res.json({
                success: true,
                data: groups
            });
        } catch (error) {
            console.error('Get task groups error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch task groups',
                error: error.message
            });
        }
    },

    async getGroupById(req, res) {
        try {
            const { id } = req.params;
            const orgId = req.user.orgId;

            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    orgId 
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    tasks: {
                        include: {
                            assignments: {
                                include: {
                                    assignedTo: {
                                        select: { id: true, firstName: true, lastName: true, email: true }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found'
                });
            }

            res.json({
                success: true,
                data: group
            });
        } catch (error) {
            console.error('Get task group error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch task group',
                error: error.message
            });
        }
    },

    async updateGroup(req, res) {
        try {
            const { id } = req.params;
            const { name, description } = req.body;
            const userId = req.user.id;

            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    createdById: userId 
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found or access denied'
                });
            }

            const updatedGroup = await prisma.taskGroup.update({
                where: { id },
                data: { name, description }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK_GROUP',
                entityId: id,
                description: `Updated task group: ${name}`,
                metadata: { groupId: id }
            });

            res.json({
                success: true,
                message: 'Task group updated successfully',
                data: updatedGroup
            });
        } catch (error) {
            console.error('Update task group error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update task group',
                error: error.message
            });
        }
    },

    async deleteGroup(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;

            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    createdById: userId 
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found or access denied'
                });
            }

            // Update tasks to remove group association
            await prisma.task.updateMany({
                where: { groupId: id },
                data: { groupId: null }
            });

            await prisma.taskGroup.delete({
                where: { id }
            });

            await logActivity({
                orgId: req.user.orgId,
                actorId: userId,
                action: 'DELETE',
                entity: 'TASK_GROUP',
                entityId: id,
                description: `Deleted task group: ${group.name}`,
                metadata: { groupId: id }
            });

            res.json({
                success: true,
                message: 'Task group deleted successfully'
            });
        } catch (error) {
            console.error('Delete task group error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete task group',
                error: error.message
            });
        }
    }
};
