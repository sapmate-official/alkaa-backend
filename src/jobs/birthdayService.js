import prisma from "../db/connectDb.js";
import { sendBirthdayEmail } from "../util/sendEmail.js";
import { format } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Email validation helper function
 * @param {string} email - Email to validate
 * @returns {boolean} - True if email is valid
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
};

/**
 * Safe string construction helper
 * @param {string} str - String to validate
 * @param {string} fallback - Fallback value
 * @returns {string} - Validated string or fallback
 */
const safeString = (str, fallback = '') => {
    return (str && typeof str === 'string') ? str.trim() : fallback;
};

/**
 * Check for today's birthdays and send birthday emails
 * This function should be called daily at 9 AM in each organization's timezone
 */
export const processBirthdayEmails = async () => {
    try {
        console.log('🎂 Starting birthday email processor...');
        
        // Get all organizations with their timezone information
        const organizations = await prisma.organization.findMany({
            select: {
                id: true,
                name: true,
                timezone: true,
                users: {
                    where: {
                        dateOfBirth: { not: null },
                        status: 'active',
                        email: { not: null }
                    },
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                        dateOfBirth: true,
                        manager: {
                            select: {
                                email: true,
                                firstName: true,
                                lastName: true
                            }
                        },
                        department: {
                            select: {
                                head: {
                                    select: {
                                        email: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        let totalEmailsSent = 0;
        let totalBirthdaysFound = 0;

        for (const org of organizations) {
            console.log(`🏢 Checking birthdays for organization: ${org.name}`);
            
            // Get current date in organization's timezone
            const orgTimezone = org.timezone || 'UTC';
            const now = new Date();
            const orgCurrentTime = toZonedTime(now, orgTimezone);
            
            console.log(`🕘 Current time in ${org.name} (${orgTimezone}): ${format(orgCurrentTime, 'yyyy-MM-dd HH:mm:ss')}`);

            // Check each user for birthday
            for (const user of org.users) {
                if (user.dateOfBirth) {
                    // Check if today is the user's birthday in the organization's timezone
                    const birthDate = new Date(user.dateOfBirth);
                    const isBirthdayToday = (
                        birthDate.getMonth() === orgCurrentTime.getMonth() &&
                        birthDate.getDate() === orgCurrentTime.getDate()
                    );

                    if (isBirthdayToday) {
                        totalBirthdaysFound++;
                        console.log(`🎉 Found birthday: ${user.firstName} ${user.lastName} (${user.email})`);
                        
                        // Check if we already sent a birthday email today for this user
                        const today = format(orgCurrentTime, 'yyyy-MM-dd');
                        const existingEmail = await prisma.birthdayEmailLog.findFirst({
                            where: {
                                userId: user.id,
                                sentDate: {
                                    gte: new Date(`${today}T00:00:00.000Z`),
                                    lt: new Date(`${today}T23:59:59.999Z`)
                                }
                            }
                        });

                        if (existingEmail) {
                            console.log(`✅ Birthday email already sent to ${user.firstName} ${user.lastName} today`);
                            continue;
                        }

                        try {
                            // Validate essential user data before sending email
                            if (!user.email || !user.firstName || !org.name) {
                                console.warn(`⚠️  Skipping birthday email for user ${user.id}: Missing essential data (email: ${user.email}, firstName: ${user.firstName}, orgName: ${org.name})`);
                                continue;
                            }

                            // Safely construct employee name with fallbacks
                            const firstName = user.firstName?.trim() || 'Colleague';
                            const lastName = user.lastName?.trim() || '';
                            const fullName = lastName ? `${firstName} ${lastName}` : firstName;
                            
                            // Calculate age for more personalized email
                            const birthDate = new Date(user.dateOfBirth);
                            const currentYear = orgCurrentTime.getFullYear();
                            const age = currentYear - birthDate.getFullYear();
                            
                            // Prepare CC emails with validation (manager and department head)
                            const ccEmails = [];
                            
                            // Add manager email if available and valid
                            if (user.manager?.email && isValidEmail(user.manager.email)) {
                                ccEmails.push({
                                    email: user.manager.email,
                                    name: user.manager.firstName && user.manager.lastName 
                                        ? `${user.manager.firstName} ${user.manager.lastName}` 
                                        : 'Manager'
                                });
                            }
                            
                            // Add department head email if available, valid, and different from manager
                            if (user.department?.head?.email && 
                                isValidEmail(user.department.head.email) && 
                                user.department.head.email !== user.manager?.email) {
                                ccEmails.push({
                                    email: user.department.head.email,
                                    name: 'Department Head'
                                });
                            }

                            console.log(`📧 Preparing birthday email for: ${fullName} (${user.email}), Age: ${age}, CC Recipients: ${ccEmails.length}`);

                            // Send birthday email with all validated parameters
                            await sendBirthdayEmail(
                                user.email,
                                fullName,
                                firstName,
                                org.name,
                                ccEmails,
                                age,
                                orgTimezone
                            );

                            // Log the sent email to prevent duplicates
                            await prisma.birthdayEmailLog.create({
                                data: {
                                    userId: user.id,
                                    organizationId: org.id,
                                    sentDate: new Date(),
                                    emailSent: true
                                }
                            });

                            totalEmailsSent++;
                            console.log(`📧 Birthday email sent successfully to ${user.firstName} ${user.lastName}`);
                            
                            // Add a small delay between emails to avoid overwhelming the email service
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                        } catch (error) {
                            console.error(`❌ Failed to send birthday email to ${user.firstName} ${user.lastName}:`, error);
                            
                            // Log the failed attempt
                            try {
                                await prisma.birthdayEmailLog.create({
                                    data: {
                                        userId: user.id,
                                        organizationId: org.id,
                                        sentDate: new Date(),
                                        emailSent: false,
                                        errorMessage: error.message
                                    }
                                });
                            } catch (logError) {
                                console.error('Failed to log birthday email error:', logError);
                            }
                        }
                    }
                }
            }
        }

        console.log(`🎂 Birthday email processor completed:`);
        console.log(`   📊 Total birthdays found: ${totalBirthdaysFound}`);
        console.log(`   📧 Total emails sent: ${totalEmailsSent}`);
        console.log(`   🏢 Organizations processed: ${organizations.length}`);
        
        return {
            success: true,
            totalBirthdaysFound,
            totalEmailsSent,
            organizationsProcessed: organizations.length
        };

    } catch (error) {
        console.error('❌ Error in birthday email processor:', error);
        throw error;
    }
};

/**
 * Check if it's the right time to send birthday emails for a specific timezone
 * @param {string} timezone - The timezone to check (e.g., 'America/New_York')
 * @param {number} targetHour - The hour to send emails (default: 9 for 9 AM)
 * @returns {boolean} - True if it's the right time to send emails
 */
export const isTimeForBirthdayEmails = (timezone = 'UTC', targetHour = 9) => {
    try {
        const now = new Date();
        const zonedTime = toZonedTime(now, timezone);
        const currentHour = zonedTime.getHours();
        
        // Check if we're within the target hour (e.g., 9:00-9:59 AM)
        return currentHour === targetHour;
    } catch (error) {
        console.error('Error checking time for birthday emails:', error);
        return false;
    }
};

/**
 * Process birthday emails for organizations in a specific timezone
 * This allows for more precise timing based on timezone
 * @param {string} timezone - The timezone to process
 */
export const processBirthdayEmailsForTimezone = async (timezone = 'UTC') => {
    try {
        if (!isTimeForBirthdayEmails(timezone, 9)) {
            console.log(`⏰ Not the right time for birthday emails in timezone ${timezone}`);
            return { success: false, reason: 'Not the right time' };
        }

        console.log(`🎂 Processing birthday emails for timezone: ${timezone}`);
        return await processBirthdayEmails();
        
    } catch (error) {
        console.error(`❌ Error processing birthday emails for timezone ${timezone}:`, error);
        throw error;
    }
};