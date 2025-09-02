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

            // Automatically add the creator as an admin member
            await prisma.taskGroupMember.create({
                data: {
                    id: generateId(),
                    groupId: group.id,
                    userId: createdById,
                    role: 'ADMIN',
                    addedById: createdById,
                    isActive: true
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
                        where: {
                            NOT: {
                                title: {
                                    startsWith: "[GROUP_PLACEHOLDER]"
                                }
                            }
                        },
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
                    members: {
                        where: { isActive: true },
                        include: {
                            user: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            addedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        }
                    },
                    _count: {
                        select: { tasks: true }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });

            // Process groups to add member information
            const processedGroups = groups.map(group => {
                const members = group.members.map(member => ({
                    ...member.user,
                    role: member.role,
                    addedAt: member.addedAt,
                    addedBy: member.addedBy
                }));
                
                return {
                    ...group,
                    members,
                    memberCount: members.length,
                    stats: {
                        totalTasks: group.tasks.length,
                        pendingTasks: group.tasks.filter(t => t.status === 'PENDING').length,
                        inProgressTasks: group.tasks.filter(t => t.status === 'IN_PROGRESS').length,
                        completedTasks: group.tasks.filter(t => t.status === 'COMPLETED').length
                    }
                };
            });

            res.json({
                success: true,
                data: processedGroups
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
                        where: {
                            NOT: {
                                title: {
                                    startsWith: "[GROUP_PLACEHOLDER]"
                                }
                            }
                        },
                        include: {
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
                    },
                    members: {
                        where: { isActive: true },
                        include: {
                            user: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            },
                            addedBy: {
                                select: { id: true, firstName: true, lastName: true, email: true }
                            }
                        },
                        orderBy: { addedAt: 'asc' }
                    }
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found'
                });
            }

            // Process members for easier frontend consumption
            const members = group.members.map(member => ({
                ...member.user,
                role: member.role,
                addedAt: member.addedAt,
                addedBy: member.addedBy
            }));
            
            const processedGroup = {
                ...group,
                members,
                memberCount: members.length,
                stats: {
                    totalTasks: group.tasks.length,
                    pendingTasks: group.tasks.filter(t => t.status === 'PENDING').length,
                    inProgressTasks: group.tasks.filter(t => t.status === 'IN_PROGRESS').length,
                    completedTasks: group.tasks.filter(t => t.status === 'COMPLETED').length
                }
            };

            res.json({
                success: true,
                data: processedGroup
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
            const { userIds, role = 'MEMBER' } = req.body;
            const userId = req.user.id;
            const orgId = req.user.orgId;

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'userIds array is required'
                });
            }

            // Validate role
            if (!['ADMIN', 'MEMBER'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role. Must be ADMIN or MEMBER'
                });
            }

            // Verify the task group exists and user has access (only creator can add members)
            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    orgId,
                    createdById: userId
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found or access denied'
                });
            }

            // Verify all users exist, belong to the same organization, and are active
            const users = await prisma.user.findMany({
                where: {
                    id: { in: userIds },
                    orgId,
                    status: 'active'
                },
                select: { id: true, firstName: true, lastName: true, email: true, status: true }
            });

            if (users.length !== userIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Some users not found, do not belong to the organization, or are inactive'
                });
            }

            // Check for existing memberships
            const existingMembers = await prisma.taskGroupMember.findMany({
                where: {
                    groupId: id,
                    userId: { in: userIds },
                    isActive: true
                }
            });

            const existingUserIds = existingMembers.map(m => m.userId);
            const newUserIds = userIds.filter(uid => !existingUserIds.includes(uid));

            if (newUserIds.length === 0) {
                return res.json({
                    success: true,
                    message: 'All users are already members of this group',
                    data: {
                        groupId: id,
                        addedMembers: [],
                        skippedMembers: users
                    }
                });
            }

            // Create new memberships
            const newMembers = await prisma.taskGroupMember.createMany({
                data: newUserIds.map(userId => ({
                    id: generateId(),
                    groupId: id,
                    userId,
                    role,
                    addedById: userId,
                    isActive: true
                }))
            });

            await logActivity({
                orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK_GROUP',
                entityId: id,
                description: `Added ${newUserIds.length} new members to task group: ${group.name}`,
                metadata: { 
                    groupId: id, 
                    addedMembers: users.filter(u => newUserIds.includes(u.id)).map(u => ({ 
                        id: u.id, 
                        name: `${u.firstName} ${u.lastName}`,
                        role 
                    }))
                }
            });

            res.json({
                success: true,
                message: 'Members added to task group successfully',
                data: {
                    groupId: id,
                    addedMembers: users.filter(u => newUserIds.includes(u.id)),
                    skippedMembers: users.filter(u => existingUserIds.includes(u.id))
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

            // Verify the task group exists and user has access (only creator can remove members)
            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    orgId,
                    createdById: userId
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found or access denied'
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

            // Prevent removing the group creator
            if (userIds.includes(group.createdById)) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot remove the group creator from the group'
                });
            }

            // Remove members from TaskGroupMember table
            const removedMembers = await prisma.taskGroupMember.updateMany({
                where: {
                    groupId: id,
                    userId: { in: userIds },
                    isActive: true
                },
                data: {
                    isActive: false,
                    removedAt: new Date()
                }
            });

            // Also remove task assignments for these users from ALL tasks in this group
            const deletedAssignments = await prisma.taskAssignment.deleteMany({
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
                    removedMembers: users.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}` })),
                    deletedAssignments: deletedAssignments.count
                }
            });

            res.json({
                success: true,
                message: 'Members removed from task group successfully',
                data: {
                    groupId: id,
                    removedMembers: users,
                    deletedAssignments: deletedAssignments.count
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
    },

    async updateMemberRole(req, res) {
        try {
            const { id } = req.params;
            const { userId: targetUserId, role } = req.body;
            const userId = req.user.id;
            const orgId = req.user.orgId;

            // Validate role
            if (!['ADMIN', 'MEMBER'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role. Must be ADMIN or MEMBER'
                });
            }

            // Verify the task group exists and user has access (only creator can update roles)
            const group = await prisma.taskGroup.findFirst({
                where: { 
                    id, 
                    orgId,
                    createdById: userId
                }
            });

            if (!group) {
                return res.status(404).json({
                    success: false,
                    message: 'Task group not found or access denied'
                });
            }

            // Prevent changing the group creator's role
            if (targetUserId === group.createdById) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot change the group creator\'s role'
                });
            }

            // Update the member's role
            const updatedMember = await prisma.taskGroupMember.updateMany({
                where: {
                    groupId: id,
                    userId: targetUserId,
                    isActive: true
                },
                data: { role }
            });

            if (updatedMember.count === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Member not found in this group'
                });
            }

            // Get user details for logging
            const user = await prisma.user.findUnique({
                where: { id: targetUserId },
                select: { id: true, firstName: true, lastName: true, email: true }
            });

            await logActivity({
                orgId,
                actorId: userId,
                action: 'UPDATE',
                entity: 'TASK_GROUP',
                entityId: id,
                description: `Updated role for ${user.firstName} ${user.lastName} to ${role} in task group: ${group.name}`,
                metadata: { 
                    groupId: id, 
                    targetUserId,
                    newRole: role,
                    userName: `${user.firstName} ${user.lastName}`
                }
            });

            res.json({
                success: true,
                message: 'Member role updated successfully',
                data: {
                    groupId: id,
                    userId: targetUserId,
                    newRole: role
                }
            });
        } catch (error) {
            console.error('Update member role error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update member role',
                error: error.message
            });
        }
    }
};
