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
    },

    async addMembers(req, res) {
        try {
            const { id } = req.params;
            const { userIds } = req.body;
            const userId = req.user.id;
            const orgId = req.user.orgId;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'userIds array is required'
                });
            }

            // Verify the task group exists and user has access
            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    orgId 
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found'
                });
            }

            // Verify all users exist and belong to the same organization
            const users = await prisma.user.findMany({
                where: {
                    id: { in: userIds },
                    orgId
                },
                select: { id: true, firstName: true, lastName: true, email: true }
            });

            if (users.length !== userIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Some users not found or do not belong to the organization'
                });
            }

            // Add members to the group by creating tasks assigned to them
            // For now, we'll log this as an activity since the schema doesn't have a direct group membership
            await logActivity({
                orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK_GROUP',
                entityId: id,
                description: `Added ${users.length} members to task group: ${group.name}`,
                metadata: { 
                    groupId: id, 
                    addedMembers: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))
                }
            });

            res.json({
                success: true,
                message: 'Members added to task group successfully',
                data: {
                    groupId: id,
                    addedMembers: users
                }
            });
        } catch (error) {
            console.error('Add members to task group error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add members to task group',
                error: error.message
            });
        }
    },

    async removeMembers(req, res) {
        try {
            const { id } = req.params;
            const { userIds } = req.body;
            const userId = req.user.id;
            const orgId = req.user.orgId;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'userIds array is required'
                });
            }

            // Verify the task group exists and user has access
            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    orgId 
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found'
                });
            }

            // Get user details for logging
            const users = await prisma.user.findMany({
                where: {
                    id: { in: userIds },
                    orgId
                },
                select: { id: true, firstName: true, lastName: true, email: true }
            });

            // Remove task assignments for these users from tasks in this group
            await prisma.taskAssignment.deleteMany({
                where: {
                    assignedToId: { in: userIds },
                    task: {
                        groupId: id
                    }
                }
            });

            await logActivity({
                orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK_GROUP',
                entityId: id,
                description: `Removed ${users.length} members from task group: ${group.name}`,
                metadata: { 
                    groupId: id, 
                    removedMembers: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }))
                }
            });

            res.json({
                success: true,
                message: 'Members removed from task group successfully',
                data: {
                    groupId: id,
                    removedMembers: users
                }
            });
        } catch (error) {
            console.error('Remove members from task group error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove members from task group',
                error: error.message
            });
        }
    }
};
