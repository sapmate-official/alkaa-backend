const axios = require('axios');

const whatsappController = {
    async sendNotification(req, res) {
        try {
            const { phoneNumbers, message, taskId, taskTitle } = req.body;

            if (!phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone numbers array is required'
                });
            }

            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: 'Message is required'
                });
            }

            const whatsappApiUrl = process.env.WHATSAPP_API_URL;
            const whatsappApiKey = process.env.WHATSAPP_API_KEY;

            if (!whatsappApiUrl || !whatsappApiKey) {
                return res.status(500).json({
                    success: false,
                    message: 'WhatsApp API configuration missing'
                });
            }

            const results = [];
            const taskMessage = taskTitle 
                ? `📋 *Task Assignment: ${taskTitle}*\n\n${message}\n\n*Task ID:* ${taskId || 'N/A'}`
                : message;

            for (const phoneNumber of phoneNumbers) {
                try {
                    const response = await axios.post(whatsappApiUrl, {
                        phone: phoneNumber,
                        message: taskMessage,
                        apikey: whatsappApiKey
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${whatsappApiKey}`
                        },
                        timeout: 10000
                    });

                    results.push({
                        phoneNumber,
                        success: true,
                        response: response.data
                    });
                } catch (error) {
                    console.error(`WhatsApp send error for ${phoneNumber}:`, error.message);
                    results.push({
                        phoneNumber,
                        success: false,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failureCount = results.length - successCount;

            res.json({
                success: successCount > 0,
                message: `Messages sent: ${successCount} successful, ${failureCount} failed`,
                data: {
                    total: results.length,
                    successful: successCount,
                    failed: failureCount,
                    results
                }
            });

        } catch (error) {
            console.error('WhatsApp notification error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send WhatsApp notifications',
                error: error.message
            });
        }
    },

    async sendTaskAssignmentNotification(req, res) {
        try {
            const { taskId, assignedUsers, taskTitle, taskDescription, dueDate, priority } = req.body;
            const assignedBy = req.user;

            if (!assignedUsers || !Array.isArray(assignedUsers) || assignedUsers.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned users array is required'
                });
            }

            const phoneNumbers = assignedUsers
                .filter(user => user.phoneNumber)
                .map(user => user.phoneNumber);

            if (phoneNumbers.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid phone numbers found for assigned users'
                });
            }

            const priorityEmoji = {
                LOW: '🟢',
                MEDIUM: '🟡',
                HIGH: '🔴',
                URGENT: '🚨'
            };

            const dueDateText = dueDate 
                ? `\n📅 *Due Date:* ${new Date(dueDate).toLocaleDateString()}`
                : '';

            const message = `📋 *New Task Assignment*

*Task:* ${taskTitle}
*Description:* ${taskDescription || 'No description provided'}
*Priority:* ${priorityEmoji[priority] || '⚪'} ${priority || 'Medium'}${dueDateText}

*Assigned by:* ${assignedBy.firstName} ${assignedBy.lastName}

Please check the ALKAA app for more details and to update task progress.

*Task ID:* ${taskId}`;

            const whatsappResponse = await whatsappController.sendNotification({
                body: {
                    phoneNumbers,
                    message,
                    taskId,
                    taskTitle
                }
            }, res);

            return whatsappResponse;

        } catch (error) {
            console.error('Task assignment notification error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send task assignment notifications',
                error: error.message
            });
        }
    },

    async sendTaskUpdateNotification(req, res) {
        try {
            const { taskId, taskTitle, updateMessage, updatedBy, assignedUsers, taskCreator } = req.body;

            const allNotifyUsers = [...(assignedUsers || [])];
            if (taskCreator && !allNotifyUsers.find(u => u.id === taskCreator.id)) {
                allNotifyUsers.push(taskCreator);
            }

            const phoneNumbers = allNotifyUsers
                .filter(user => user.phoneNumber)
                .map(user => user.phoneNumber);

            if (phoneNumbers.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid phone numbers found for notification'
                });
            }

            const message = `📝 *Task Update*

*Task:* ${taskTitle}
*Update:* ${updateMessage}

*Updated by:* ${updatedBy.firstName} ${updatedBy.lastName}

Check the ALKAA app for complete task details.

*Task ID:* ${taskId}`;

            const whatsappResponse = await whatsappController.sendNotification({
                body: {
                    phoneNumbers,
                    message,
                    taskId,
                    taskTitle
                }
            }, res);

            return whatsappResponse;

        } catch (error) {
            console.error('Task update notification error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to send task update notifications',
                error: error.message
            });
        }
    }
};

module.exports = whatsappController;
