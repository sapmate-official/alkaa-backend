import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../../db/connectDb.js';
import { sendLoginOTPEmail, sendLoginNotificationEmail } from '../../../util/sendEmail.js';
import { generateTokens } from '../../../util/generate.js';

/**
 * Step 1: Verify credentials without full login
 * @route POST /api/v2/auth/verify-credentials
 * @desc Verify user credentials and check if 2FA is required
 * @access Public
 */
export const verifyLoginCredentials = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email, password } = req.body;
            const clientInfo = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date()
            };

            console.log('=== CREDENTIAL VERIFICATION START ===');
            console.log('Email:', email);
            console.log('Client Info:', clientInfo);

            // Check for super admin first
            const superAdmin = await prisma.superAdmin.findUnique({
                where: { email }
            });

            if (superAdmin) {
                return res.status(400).json({ 
                    error: 'Super Admins cannot login through this endpoint. Please use the admin login portal.' 
                });
            }

            // Find regular user
            const user = await prisma.user.findUnique({
                where: { email },
                include: {
                    organization: {
                        select: { 
                            name: true,
                            isActive: true
                        }
                    }
                }
            });

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check user status
            if (user.status !== 'active') {
                return res.status(403).json({ 
                    error: `Account is ${user.status}. Please contact your administrator.` 
                });
            }

            // Check organization status
            if (!user.organization?.isActive) {
                return res.status(403).json({ 
                    error: 'Organization is inactive. Please contact support.' 
                });
            }

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.hashedPassword);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check if 2FA is enabled for user or organization policy
            const requires2FA = user.twoFactorEnabled || await checkOrganization2FAPolicy(user.orgId);

            if (requires2FA) {
                // Generate session token for OTP flow
                const sessionToken = crypto.randomBytes(32).toString('hex');
                const sessionExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

                // Store session temporarily
                await prisma.tempLoginSession.create({
                    data: {
                        sessionToken,
                        userId: user.id,
                        expiresAt: sessionExpiry,
                        ipAddress: clientInfo.ip,
                        userAgent: clientInfo.userAgent
                    }
                });

                console.log('2FA required, session created');
                return res.status(200).json({
                    requiresOTP: true,
                    sessionToken,
                    userId: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    message: 'Credentials verified. OTP required for login.'
                });
            } else {
                // Complete login without OTP
                const tokens = await generateAuthTokens(user);
                await logLoginActivity(user.id, clientInfo, 'SUCCESS_NO_2FA');
                
                console.log('Login completed without 2FA');
                return res.status(200).json({
                    requiresOTP: false,
                    ...tokens,
                    user: sanitizeUserData(user),
                    message: 'Login successful'
                });
            }

        } catch (error) {
            console.error('Credential verification error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Step 2: Request OTP for login
 * @route POST /api/v2/auth/request-otp
 * @desc Generate and send OTP for login verification
 * @access Public
 */
export const requestLoginOTP = [
    body('sessionToken').notEmpty().withMessage('Session token required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { sessionToken } = req.body;

            console.log('=== OTP REQUEST START ===');
            console.log('Session Token:', sessionToken);

            // Verify session token
            const session = await prisma.tempLoginSession.findFirst({
                where: {
                    sessionToken,
                    expiresAt: { gt: new Date() },
                    isUsed: false
                },
                include: {
                    user: {
                        include: {
                            organization: {
                                select: { name: true }
                            }
                        }
                    }
                }
            });

            if (!session) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            // Check if recent OTP exists and is still valid (rate limiting)
            const recentOTP = await prisma.emailOtpVerification.findFirst({
                where: {
                    userId: session.userId,
                    purpose: 'LOGIN',
                    expiresAt: { gt: new Date() },
                    isUsed: false
                },
                orderBy: { createdAt: 'desc' }
            });

            if (recentOTP && recentOTP.createdAt > new Date(Date.now() - 60 * 1000)) {
                const waitTime = 60 - Math.floor((Date.now() - recentOTP.createdAt) / 1000);
                return res.status(429).json({ 
                    error: 'Please wait before requesting a new OTP',
                    waitTime
                });
            }

            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Store OTP
            await prisma.emailOtpVerification.create({
                data: {
                    userId: session.userId,
                    otpCode: otp,
                    purpose: 'LOGIN',
                    expiresAt: otpExpiry,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                }
            });

            // Send OTP email
            try {
                await sendLoginOTPEmail(
                    session.user.email,
                    session.user.firstName,
                    otp,
                    session.user.organization.name,
                    {
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                        location: await getLocationFromIP(req.ip)
                    }
                );
                console.log('OTP email sent successfully');
            } catch (emailError) {
                console.error('Failed to send OTP email:', emailError);
                // Continue execution even if email fails
            }

            // Schedule background job for notification
            try {
                await prisma.backgroundJob.create({
                    data: {
                        type: 'NOTIFICATION_DISPATCH',
                        status: 'PENDING',
                        payload: {
                            type: 'LOGIN_ATTEMPT_NOTIFICATION',
                            userId: session.userId,
                            loginInfo: {
                                ip: req.ip,
                                userAgent: req.headers['user-agent'],
                                timestamp: new Date()
                            }
                        },
                        scheduledFor: new Date(),
                        priority: 1
                    }
                });
            } catch (jobError) {
                console.warn('Failed to schedule notification job:', jobError);
            }

            res.status(200).json({ 
                message: 'OTP sent successfully',
                expiresIn: 600 // 10 minutes in seconds
            });

        } catch (error) {
            console.error('OTP request error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Step 3: Verify OTP and complete login
 * @route POST /api/v2/auth/verify-otp
 * @desc Verify OTP and complete the login process
 * @access Public
 */
export const verifyLoginOTP = [
    body('sessionToken').notEmpty().withMessage('Session token required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('Valid OTP required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { sessionToken, otp } = req.body;

            console.log('=== OTP VERIFICATION START ===');
            console.log('Session Token:', sessionToken);
            console.log('OTP:', otp);

            // Verify session token
            const session = await prisma.tempLoginSession.findFirst({
                where: {
                    sessionToken,
                    expiresAt: { gt: new Date() },
                    isUsed: false
                },
                include: {
                    user: {
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
                            },
                            organization: true
                        }
                    }
                }
            });

            if (!session) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            // Find and verify OTP
            const otpRecord = await prisma.emailOtpVerification.findFirst({
                where: {
                    userId: session.userId,
                    purpose: 'LOGIN',
                    expiresAt: { gt: new Date() },
                    isUsed: false
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!otpRecord) {
                return res.status(401).json({ error: 'Invalid or expired OTP' });
            }

            // Check attempts
            if (otpRecord.attemptsCount >= otpRecord.maxAttempts) {
                await prisma.emailOtpVerification.update({
                    where: { id: otpRecord.id },
                    data: { isUsed: true }
                });
                
                return res.status(429).json({ 
                    error: 'Maximum OTP attempts exceeded. Please request a new OTP.' 
                });
            }

            // Verify OTP
            if (otpRecord.otpCode !== otp) {
                await prisma.emailOtpVerification.update({
                    where: { id: otpRecord.id },
                    data: { attemptsCount: otpRecord.attemptsCount + 1 }
                });
                
                return res.status(401).json({ 
                    error: 'Invalid OTP',
                    attemptsRemaining: otpRecord.maxAttempts - (otpRecord.attemptsCount + 1)
                });
            }

            // Mark OTP and session as used
            await prisma.$transaction([
                prisma.emailOtpVerification.update({
                    where: { id: otpRecord.id },
                    data: { 
                        isUsed: true,
                        usedAt: new Date()
                    }
                }),
                prisma.tempLoginSession.update({
                    where: { id: session.id },
                    data: { isUsed: true }
                })
            ]);

            // Generate auth tokens
            const tokens = await generateAuthTokens(session.user);

            // Log successful login
            await logLoginActivity(session.userId, {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date()
            }, 'SUCCESS_WITH_2FA');

            // Send login notification if enabled
            if (session.user.loginNotificationsEnabled) {
                try {
                    await sendLoginNotificationEmail(
                        session.user.email,
                        session.user.firstName,
                        {
                            ip: req.ip,
                            userAgent: req.headers['user-agent'],
                            timestamp: new Date(),
                            location: await getLocationFromIP(req.ip)
                        },
                        session.user.organization.name
                    );
                    console.log('Login notification sent');
                } catch (emailError) {
                    console.warn('Failed to send login notification:', emailError);
                }
            }

            console.log('OTP verification successful, login completed');
            res.status(200).json({
                ...tokens,
                user: sanitizeUserData(session.user),
                message: 'Login successful'
            });

        } catch (error) {
            console.error('OTP verification error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Resend OTP for login
 * @route POST /api/v2/auth/resend-otp
 * @desc Resend OTP for login verification
 * @access Public
 */
export const resendLoginOTP = [
    body('sessionToken').notEmpty().withMessage('Session token required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { sessionToken } = req.body;

            console.log('=== OTP RESEND REQUEST ===');

            // Verify session token
            const session = await prisma.tempLoginSession.findFirst({
                where: {
                    sessionToken,
                    expiresAt: { gt: new Date() },
                    isUsed: false
                },
                include: {
                    user: {
                        include: {
                            organization: {
                                select: { name: true }
                            }
                        }
                    }
                }
            });

            if (!session) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            // Rate limiting - allow resend only after 60 seconds
            const recentOTP = await prisma.emailOtpVerification.findFirst({
                where: {
                    userId: session.userId,
                    purpose: 'LOGIN',
                    createdAt: { gt: new Date(Date.now() - 60 * 1000) }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (recentOTP) {
                const waitTime = 60 - Math.floor((Date.now() - recentOTP.createdAt) / 1000);
                return res.status(429).json({ 
                    error: 'Please wait before requesting a new OTP',
                    waitTime
                });
            }

            // Mark previous OTPs as used
            await prisma.emailOtpVerification.updateMany({
                where: {
                    userId: session.userId,
                    purpose: 'LOGIN',
                    isUsed: false
                },
                data: { isUsed: true }
            });

            // Generate new OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

            await prisma.emailOtpVerification.create({
                data: {
                    userId: session.userId,
                    otpCode: otp,
                    purpose: 'LOGIN',
                    expiresAt: otpExpiry,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                }
            });

            // Send OTP email
            try {
                await sendLoginOTPEmail(
                    session.user.email,
                    session.user.firstName,
                    otp,
                    session.user.organization.name,
                    {
                        ip: req.ip,
                        userAgent: req.headers['user-agent'],
                        location: await getLocationFromIP(req.ip)
                    }
                );
                console.log('OTP resent successfully');
            } catch (emailError) {
                console.error('Failed to resend OTP email:', emailError);
                return res.status(500).json({ error: 'Failed to send OTP email' });
            }

            res.status(200).json({ 
                message: 'OTP resent successfully',
                expiresIn: 600
            });

        } catch (error) {
            console.error('OTP resend error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Toggle 2FA for user
 * @route POST /api/v2/auth/toggle-2fa
 * @desc Enable or disable 2FA for the current user
 * @access Private
 */
export const toggle2FA = async (req, res) => {
    try {
        const { enabled } = req.body;
        const userId = req.user.id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { twoFactorEnabled: enabled },
            select: {
                id: true,
                email: true,
                firstName: true,
                twoFactorEnabled: true,
                loginNotificationsEnabled: true
            }
        });

        res.status(200).json({
            message: `2FA ${enabled ? 'enabled' : 'disabled'} successfully`,
            user: updatedUser
        });

    } catch (error) {
        console.error('Toggle 2FA error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Update notification preferences
 * @route PUT /api/v2/auth/notification-preferences
 * @desc Update user's notification preferences
 * @access Private
 */
export const updateNotificationPreferences = async (req, res) => {
    try {
        const { loginNotificationsEnabled } = req.body;
        const userId = req.user.id;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: { loginNotificationsEnabled },
            select: {
                id: true,
                email: true,
                firstName: true,
                twoFactorEnabled: true,
                loginNotificationsEnabled: true
            }
        });

        res.status(200).json({
            message: 'Notification preferences updated successfully',
            user: updatedUser
        });

    } catch (error) {
        console.error('Update notification preferences error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Helper functions
const generateAuthTokens = async (user) => {
    const payload = {
        id: user.id,
        email: user.email,
        orgId: user.orgId
    };

    const { accessToken, refreshToken } = generateTokens(
        user.email,
        user.id,
        "2d",
        "7d"
    );

    // Store refresh token
    await prisma.user.update({
        where: { id: user.id },
        data: { refreshToken }
    });

    return { accessToken, refreshToken };
};

const sanitizeUserData = (user) => {
    const { hashedPassword, refreshToken, verificationToken, ...sanitizedUser } = user;
    return sanitizedUser;
};

const checkOrganization2FAPolicy = async (orgId) => {
    try {
        const orgSettings = await prisma.organizationSettings.findFirst({
            where: { orgId }
        });
        
        return orgSettings?.settings?.require2FA || false;
    } catch (error) {
        console.warn('Failed to check organization 2FA policy:', error);
        return false;
    }
};

const logLoginActivity = async (userId, clientInfo, type) => {
    try {
        await prisma.activityLog.create({
            data: {
                orgId: (await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true } })).orgId,
                actorId: userId,
                action: 'LOGIN',
                entity: 'USER',
                entityId: userId,
                description: `User logged in with ${type}`,
                metadata: {
                    loginType: type,
                    clientInfo
                },
                ipAddress: clientInfo.ip,
                userAgent: clientInfo.userAgent
            }
        });
    } catch (error) {
        console.warn('Failed to log login activity:', error);
    }
};

const getLocationFromIP = async (ip) => {
    // Placeholder for IP geolocation service
    // You can integrate with services like IPGeolocation, MaxMind, etc.
    try {
        if (ip === '::1' || ip === '127.0.0.1' || ip.includes('localhost')) {
            return 'Local Development';
        }
        // TODO: Implement actual IP geolocation
        return null;
    } catch (error) {
        console.warn('Failed to get location from IP:', error);
        return null;
    }
};
