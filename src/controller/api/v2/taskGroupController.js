const { PrismaClient } = require('@prisma/client');
const { generateId } = require('../../../util/generate');
const { logActivity } = require('../../../util/activityLogger');

const prisma = new PrismaClient();

const taskGroupController = {
    async createGroup(req, res) {
        try {
            const { name, description, memberIds } = req.body;
            const createdById = req.user.id;

            const group = await prisma.taskGroup.create({
                data: {
                    id: generateId(),
                    name,
                    description,
                    createdById,
                    organizationId: req.user.organizationId,
                }
            });

            if (memberIds && memberIds.length > 0) {
                const memberData = memberIds.map(userId => ({
                    id: generateId(),
                    groupId: group.id,
                    userId,
                }));

                await prisma.taskGroupMember.createMany({
                    data: memberData
                });
            }

            await logActivity(createdById, req.user.organizationId, 'TASK_GROUP_CREATED', 
                `Created task group: ${name}`, { groupId: group.id });

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
            const organizationId = req.user.organizationId;

            const groups = await prisma.taskGroup.findMany({
                where: { organizationId },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    members: {
                        include: {
                            user: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    _count: {
                        select: { members: true }
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
            const organizationId = req.user.organizationId;

            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    organizationId 
                },
                include: {
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true, email: true }
                    },
                    members: {
                        include: {
                            user: {
                                select: { id: true, firstName: true, lastName: true, email: true }
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

            await logActivity(userId, req.user.organizationId, 'TASK_GROUP_UPDATED', 
                `Updated task group: ${name}`, { groupId: id });

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

            await prisma.taskGroupMember.deleteMany({
                where: { groupId: id }
            });

            await prisma.taskGroup.delete({
                where: { id }
            });

            await logActivity(userId, req.user.organizationId, 'TASK_GROUP_DELETED', 
                `Deleted task group: ${group.name}`, { groupId: id });

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
            const { memberIds } = req.body;
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

            const existingMembers = await prisma.taskGroupMember.findMany({
                where: { groupId: id },
                select: { userId: true }
            });

            const existingUserIds = existingMembers.map(m => m.userId);
            const newMemberIds = memberIds.filter(uid => !existingUserIds.includes(uid));

            if (newMemberIds.length > 0) {
                const memberData = newMemberIds.map(userId => ({
                    id: generateId(),
                    groupId: id,
                    userId,
                }));

                await prisma.taskGroupMember.createMany({
                    data: memberData
                });
            }

            await logActivity(userId, req.user.organizationId, 'TASK_GROUP_MEMBERS_ADDED', 
                `Added members to task group: ${group.name}`, { groupId: id, memberCount: newMemberIds.length });

            res.json({
                success: true,
                message: 'Members added successfully',
                data: { addedCount: newMemberIds.length }
            });
        } catch (error) {
            console.error('Add group members error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to add members',
                error: error.message
            });
        }
    },

    async removeMembers(req, res) {
        try {
            const { id } = req.params;
            const { memberIds } = req.body;
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

            const deletedCount = await prisma.taskGroupMember.deleteMany({
                where: { 
                    groupId: id,
                    userId: { in: memberIds }
                }
            });

            await logActivity(userId, req.user.organizationId, 'TASK_GROUP_MEMBERS_REMOVED', 
                `Removed members from task group: ${group.name}`, { groupId: id, removedCount: deletedCount.count });

            res.json({
                success: true,
                message: 'Members removed successfully',
                data: { removedCount: deletedCount.count }
            });
        } catch (error) {
            console.error('Remove group members error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to remove members',
                error: error.message
            });
        }
    }
};

module.exports = taskGroupController;
