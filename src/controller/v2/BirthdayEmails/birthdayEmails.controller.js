import { processBirthdayEmails, processBirthdayEmailsForTimezone } from '../../../jobs/birthdayService.js';
import { sendBirthdayEmail } from '../../../util/sendEmail.js';
import prisma from '../../../db/connectDb.js';

/**
 * Test birthday email functionality
 * This endpoint allows administrators to test the birthday email system
 */
export const testBirthdayEmails = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check if user has admin permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const hasAdminPermission = user.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        if (!hasAdminPermission) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin permissions required."
            });
        }

        const { action, testEmail, timezone } = req.body;

        switch (action) {
            case 'send_test_email':
                // Send a test birthday email to a specific email address
                if (!testEmail) {
                    return res.status(400).json({
                        success: false,
                        message: "Test email address is required"
                    });
                }

                await sendBirthdayEmail(
                    testEmail,
                    "Test Employee",
                    "Test",
                    user.organization?.name || "Alkaa",
                    []
                );

                return res.status(200).json({
                    success: true,
                    message: `Test birthday email sent to ${testEmail}`
                });

            case 'process_all_birthdays':
                // Process all birthday emails for today
                const result = await processBirthdayEmails();
                
                return res.status(200).json({
                    success: true,
                    message: "Birthday email processing completed",
                    data: result
                });

            case 'process_timezone_birthdays':
                // Process birthday emails for a specific timezone
                const timezoneResult = await processBirthdayEmailsForTimezone(timezone || 'UTC');
                
                return res.status(200).json({
                    success: true,
                    message: `Birthday email processing completed for timezone: ${timezone || 'UTC'}`,
                    data: timezoneResult
                });

            case 'check_todays_birthdays':
                // Just check who has birthdays today without sending emails
                const today = new Date();
                const organizations = await prisma.organization.findMany({
                    select: {
                        id: true,
                        name: true,
                        timezone: true,
                        users: {
                            where: {
                                dateOfBirth: { not: null },
                                status: 'active'
                            },
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                dateOfBirth: true
                            }
                        }
                    }
                });

                const birthdaysToday = [];
                organizations.forEach(org => {
                    org.users.forEach(user => {
                        if (user.dateOfBirth) {
                            const birthDate = new Date(user.dateOfBirth);
                            const isBirthdayToday = (
                                birthDate.getMonth() === today.getMonth() &&
                                birthDate.getDate() === today.getDate()
                            );

                            if (isBirthdayToday) {
                                birthdaysToday.push({
                                    organization: org.name,
                                    user: `${user.firstName} ${user.lastName}`,
                                    email: user.email,
                                    birthDate: user.dateOfBirth
                                });
                            }
                        }
                    });
                });

                return res.status(200).json({
                    success: true,
                    message: `Found ${birthdaysToday.length} birthdays today`,
                    data: {
                        todaysDate: today.toISOString().split('T')[0],
                        birthdays: birthdaysToday
                    }
                });

            default:
                console.log(action)
                return res.status(400).json({
                    success: false,
                    message: "Invalid action. Supported actions: send_test_email, process_all_birthdays, process_timezone_birthdays, check_todays_birthdays"
                });
        }

    } catch (error) {
        console.error('Error in birthday email test:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to test birthday emails",
            error: error.message
        });
    }
};

/**
 * Get birthday email logs for monitoring
 */
export const getBirthdayEmailLogs = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Check if user has admin permissions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const hasAdminPermission = user.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        if (!hasAdminPermission) {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin permissions required."
            });
        }

        const { limit = 50, offset = 0 } = req.query;

        const logs = await prisma.birthdayEmailLog.findMany({
            take: parseInt(limit),
            skip: parseInt(offset),
            orderBy: {
                sentDate: 'desc'
            },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                organization: {
                    select: {
                        name: true
                    }
                }
            }
        });

        const totalLogs = await prisma.birthdayEmailLog.count();

        return res.status(200).json({
            success: true,
            data: {
                logs,
                totalLogs,
                currentPage: Math.floor(offset / limit) + 1,
                totalPages: Math.ceil(totalLogs / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching birthday email logs:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch birthday email logs",
            error: error.message
        });
    }
};