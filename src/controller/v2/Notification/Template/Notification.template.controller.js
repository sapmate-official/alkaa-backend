import prisma from "../../../../db/connectDb.js";


const getAllnotification = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany();
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
}
const getNotificationByUserId = async (req, res) => {
    const { id } = req.params;
    try {
        const notification = await prisma.notification.findMany({ where: { userId:id } });
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.status(200).json(notification);
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: 'Failed to fetch notification' });
    }
}
const createNotification = async (req, res) => {
    const { title, body, type, userId } = req.body;
    try {
        const newNotification = await prisma.notification.create({
            data: { title, body, type, userId }
        });
        res.status(201).json(newNotification);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create notification' });
    }
}
const updateNotification = async (req, res) => {
    const { id } = req.params;
    const { title, body, type, userId } = req.body;

    try {
        const existingNotification = await prisma.notification.findUnique({ where: { id } });
        if (!existingNotification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        const updatedNotification = await prisma.notification.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existingNotification.title,
                body: body !== undefined ? body : existingNotification.body,

                type: type !== undefined ? type : existingNotification.type,
                userId: userId !== undefined ? userId : existingNotification.userId
            }
        });
        res.status(200).json(updatedNotification);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notification' });
    }
}
const deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.notification.delete({ where: { id } });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete notification' });
    }
}


const getAllnotificationTemplate = async (req, res) => {
    try {
        const notificationTemplates = await prisma.notificationTemplate.findMany();
        res.status(200).json(notificationTemplates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notification templates' });
    }
}
const getNotificationTemplateById = async (req, res) => {
    const { id } = req.params;
    try {
        const notificationTemplate = await prisma.notificationTemplate.findUnique({ where: { id } });
        if (!notificationTemplate) {
            return res.status(404).json({ error: 'Notification template not found' });
        }
        res.status(200).json(notificationTemplate);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notification template' });
    }
}
const createNotificationTemplate = async (req, res) => {
    const { orgId, name, type, subject, content, variables } = req.body;
    try {
        const newNotificationTemplate = await prisma.notificationTemplate.create({
            data: {
                orgId,
                name,
                type,
                subject,
                content,
                variables: variables || {}
            }
        });
        res.status(201).json(newNotificationTemplate);
    } catch (error) {
        console.log(error);
        
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Template name already exists for this organization' });
        }
        res.status(500).json({ error: 'Failed to create notification template' });
    }
}
const updateNotificationTemplate = async (req, res) => {
    const { id } = req.params;
    const { title, body, type } = req.body;
    try {
        const existingNotificationTemplate = await prisma.notificationTemplate.findUnique({ where: { id } });
        if (!existingNotificationTemplate) {
            return res.status(404).json({ error: 'Notification template not found' });
        }
        const updatedNotificationTemplate = await prisma.notificationTemplate.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existingNotificationTemplate.title,
                body: body !== undefined ? body : existingNotificationTemplate.body,
                type: type !== undefined ? type : existingNotificationTemplate.type
            }
        });
        res.status(200).json(updatedNotificationTemplate);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update notification template' });
    }
}
const deleteNotificationTemplate = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.notificationTemplate.delete({ where: { id } });
        res.status(204).end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete notification template' });
    }
}
export { getAllnotificationTemplate, getNotificationTemplateById, createNotificationTemplate, updateNotificationTemplate, deleteNotificationTemplate,getAllnotification, getNotificationByUserId, createNotification, updateNotification, deleteNotification };