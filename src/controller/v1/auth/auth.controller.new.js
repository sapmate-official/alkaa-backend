import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../../db/connectDb.js';
import { sendLoginOTPEmail, sendLoginNotificationEmail } from '../../../util/sendEmail.js';
import { generateTokens, generateTokensWithOrg } from '../../../util/generate.js';

/**
 * Step 1: Enhanced multi-tenant email check
 * @route POST /api/v1/auth/check-email
 * @desc Check email and return organization associations
 * @access Public
 */
export const checkEmailForLogin = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({
                message: "Email is required",
            });
        }

        // Check for super admin first
        const superAdmin = await prisma.superAdmin.findFirst({
            where: { email },
        });
        
        if (superAdmin) {
            return res.status(401).json({
                message: "Super Admins cannot login through this endpoint",
            });
        }

        // Find all organizations this user belongs to
        const userOrganizations = await prisma.user.findMany({
            where: { 
                email,
                status: { in: ['active', 'inactive'] }
            },
            include: {
                organization: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true
                    }
                }
            }
        });

        if (!userOrganizations.length) {
            return res.status(404).json({
                message: "No User exists with this Email",
            });
        }

        // Filter active organizations
        const activeUserOrgs = userOrganizations.filter(user => 
            user.organization.isActive && user.status !== 'suspended'
        );

        if (!activeUserOrgs.length) {
            return res.status(401).json({
                message: "No active organizations found for this user",
            });
        }

        // If single organization, return it directly
        if (activeUserOrgs.length === 1) {
            return res.status(200).json({
                singleOrganization: true,
                organization: {
                    orgId: activeUserOrgs[0].orgId,
                    orgName: activeUserOrgs[0].organization.name,
                    userId: activeUserOrgs[0].id
                },
                message: "Single organization found"
            });
        }

        // Multiple organizations - return selection options
        return res.status(200).json({
            multipleOrganizations: true,
            organizations: activeUserOrgs.map(user => ({
                orgId: user.orgId,
                orgName: user.organization.name,
                userId: user.id,
                userStatus: user.status
            })),
            message: "Multiple organizations found. Please select one."
        });

    } catch (error) {
        console.error("Check email error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Step 1: Verify credentials without full login (v2 style - advanced)
 * @route POST /api/v1/auth/verify-credentials
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
 * Step 2: Enhanced multi-tenant password verification with OTP
 * @route POST /api/v1/auth/verify-password
 * @desc Verify password and send OTP for selected organization
 * @access Public
 */
export const verifyPasswordAndSendOtp = async (req, res) => {
    try {
        const { email, password, orgId } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        // Find the specific user in the organization
        let user;
        if (orgId) {
            user = await prisma.user.findFirst({
                where: { 
                    email,
                    orgId 
                },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            isActive: true
                        }
                    }
                }
            });
        } else {
            // Single organization case
            user = await prisma.user.findFirst({
                where: { email },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            isActive: true
                        }
                    }
                }
            });
        }

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        // Validate user and organization status
        if (user.status === "suspended") {
            return res.status(401).json({
                message: "User is suspended",
            });
        }

        if (user.status === "inactive") {
            return res.status(401).json({
                message: "User is inactive",
            });
        }

        if (!user.organization.isActive) {
            return res.status(401).json({
                message: "Organization is inactive",
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }

        // Generate and store OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        // Store OTP verification record
        await prisma.emailOtpVerification.create({
            data: {
                userId: user.id,
                otpCode: otpCode,
                purpose: 'LOGIN',
                expiresAt: otpExpiry,
                isUsed: false,
                attemptsCount: 0,
                maxAttempts: 3,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });
        console.log('OTP Code:', otpCode);

        // Send OTP email with organization branding
        try {
            await sendLoginOTPEmail(
                user.email,
                `${user.firstName} ${user.lastName}`,
                otpCode,
                user.organization.name,
                {
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    timestamp: new Date()
                }
            );
        } catch (emailError) {
            console.error('Failed to send OTP email:', emailError);
            // Continue execution even if email fails
        }

        // Generate temporary session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000);

        // Store temporary session
        await prisma.tempLoginSession.create({
            data: {
                sessionToken,
                userId: user.id,
                expiresAt: sessionExpiry,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            }
        });

        return res.status(200).json({
            message: "OTP sent successfully",
            sessionToken: sessionToken,
            organizationName: user.organization.name,
            otpExpiresIn: 600
        });

    } catch (error) {
        console.error("Password verification error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Step 2: Request OTP for login (v2 style - advanced)
 * @route POST /api/v1/auth/request-otp
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
 * Step 3: Enhanced multi-tenant OTP verification and login completion
 * @route POST /api/v1/auth/verify-otp
 * @desc Verify OTP and complete login with organization context
 * @access Public
 */
export const verifyOtpAndLogin = async (req, res) => {
    try {
        const { sessionToken, otpCode } = req.body;
        
        if (!sessionToken || !otpCode) {
            return res.status(400).json({
                message: "Session token and OTP code are required",
            });
        }

        // Find and verify session
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
                            select: {
                                id: true,
                                name: true,
                                isActive: true
                            }
                        },
                        roles: {
                            include: {
                                role: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!session) {
            return res.status(401).json({
                message: "Invalid or expired session"
            });
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
            return res.status(401).json({
                message: "Invalid or expired OTP"
            });
        }

        // Check attempts
        if (otpRecord.attemptsCount >= otpRecord.maxAttempts) {
            await prisma.emailOtpVerification.update({
                where: { id: otpRecord.id },
                data: { isUsed: true }
            });
            
            return res.status(429).json({
                message: "Maximum OTP attempts exceeded. Please try again."
            });
        }

        // Verify OTP
        if (otpRecord.otpCode !== otpCode) {
            await prisma.emailOtpVerification.update({
                where: { id: otpRecord.id },
                data: { attemptsCount: otpRecord.attemptsCount + 1 }
            });
            
            return res.status(401).json({
                message: "Invalid OTP code"
            });
        }

        // Mark OTP as used
        await prisma.emailOtpVerification.update({
            where: { id: otpRecord.id },
            data: { 
                isUsed: true,
                usedAt: new Date()
            }
        });

        // Mark session as used
        await prisma.tempLoginSession.update({
            where: { id: session.id },
            data: { isUsed: true }
        });

        const user = session.user;

        // Generate tokens with orgId
        const { accessToken, refreshToken } = generateTokensWithOrg(
            user.email,
            user.id,
            user.orgId,
            "2d",
            "7d"
        );

        // Update user's refresh token
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: refreshToken }
        });

        // Set cookies
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 2 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined
        });

        return res.status(200).json({
            message: "Login successful",
            userData: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                orgId: user.orgId,
                orgName: user.organization.name,
                roles: user.roles.map(ur => ur.role.name)
            },
            refreshToken,
            accessToken,
        });

    } catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Step 3: Verify OTP and complete login (v2 style - advanced)
 * @route POST /api/v1/auth/verify-login-otp
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
 * @route POST /api/v1/auth/resend-otp
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
 * Legacy set password functionality
 * @route POST /api/v1/auth/set-password
 * @desc Set password for new user using verification token
 * @access Public
 */
export const setPassword = async (req, res) => {
    try {
        const { password, verificationToken } = req.body;
        console.log(password, verificationToken);

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.findFirst({
            where: {
                verificationToken
            }
        });
        if (user) {
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: { hashedPassword, status: "active" },
            });

            res.status(200).json(updatedUser);
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Legacy login functionality (kept for backward compatibility)
 * @route POST /api/v1/auth/login
 * @desc Legacy single-step login
 * @access Public
 */
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(email, password);
        
        if (!email || !password) {
            return res.status(400).send({
                message: "Email and password are required",
            });
        }

        // Check for super admin first
        const superAdmin = await prisma.superAdmin.findFirst({
            where: { email },
        });
        
        if (superAdmin) {
            return res.status(401).send({
                message: "Super Admins cannot login through this endpoint",
            });
        }

        const user = await prisma.user.findFirst({
            where: { email },
        });
        
        if (!user) {
            return res.status(401).send({
                message: "No User exists with this Email",
            });
        }
        
        if (user.status == "inactive") {
            return res.status(401).send({
                message: "User is inactive",
            });
        }
        
        if (user.status == "suspended") {
            return res.status(401).send({
                message: "User is suspended",
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);
        
        if (!isPasswordValid) {
            return res.status(401).send({
                message: "Invalid credentials",
            });
        }

        const userRole = await prisma.userRole.findFirst({
            where: {
                userId: user.id
            },
            include: {
                role: {
                    select: {
                        name: true
                    }
                }
            }
        });

        const organisationStatus = await prisma.organization.findFirst({
            where: {
                id: user.orgId
            },
            select: {
                isActive: true,
            }
        });
        
        if (!organisationStatus.isActive) {
            return res.status(401).send({
                message: "Organization is inactive",
            });
        }

        const { accessToken, refreshToken } = generateTokens(
            user.email,
            user.id,
            "2d",
            "7d"
        );
        
        if (user) {
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    refreshToken: refreshToken,
                }
            });
        }

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 2 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined
        });

        return res.status(200).send({
            message: "User logged in successfully",
            userData: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            },
            refreshToken,
            accessToken,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Enhanced token validation with organization context
 * @route GET /api/v1/auth/validate-token
 * @desc Validate access token and return user data with organization context
 * @access Private
 */
export const validatetoken = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Invalid user authentication" });
        }

        let data = await prisma.user.findFirst({
            where: { 
                id: req.user.id,
                ...(req.user.orgId && { orgId: req.user.orgId })
            }, 
            include: {
                organization: {
                    select: {
                        id: true,
                        isActive: true,
                        name: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                roles: {
                    include: {
                        role: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
        
        if (!data) {
            // Check if it's a super admin
            data = await prisma.superAdmin.findUnique({ 
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            });
            
            if (!data) {
                return res.status(404).json({ message: "User not found" });
            }
        } else {
            // Check organization status
            if (data?.organization?.isActive === false) {
                return res.status(401).json({ message: "Organization is inactive" });
            }
        }
        
        res.status(200).json({ 
            message: "Token is valid", 
            user: data,
            authenticated: true 
        });
    } catch (error) {
        console.error("Validate token error:", error);
        res.status(500).json({ message: "Error validating token", error: error.message });
    }
};

/**
 * Enhanced refresh token with organization context
 * @route POST /api/v1/auth/refresh-token
 * @desc Refresh access token while maintaining organization context
 * @access Public
 */
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const { refreshToken: cookieRefreshToken } = req.cookies;

        if (!refreshToken && !cookieRefreshToken) {
            return res.status(401).json({ message: "Refresh token is required." });
        }

        // Verify refresh token
        const decodedToken = jwt.verify(
            refreshToken || cookieRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        // Find user using ID from token
        const user = await findUserById(decodedToken.id);
        if (!user || user.refreshToken !== (refreshToken || cookieRefreshToken)) {
            return res.status(403).json({ message: "Invalid refresh token." });
        }

        // Generate new tokens with orgId if available in the original token
        let tokens;
        if (decodedToken.orgId) {
            tokens = generateTokensWithOrg(
                user.email,
                user.id,
                decodedToken.orgId,
                "2d",
                "7d"
            );
        } else {
            tokens = generateTokens(
                user.email,
                user.id,
                "2d",
                "7d"
            );
        }

        // Update user's refresh token
        await updateUser(user.id, { refreshToken: tokens.refreshToken });
        
        res.cookie("refreshToken", tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined
        });

        res.cookie("accessToken", tokens.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 2 * 24 * 60 * 60 * 1000,
            expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined
        });

        return res.status(200).json({
            message: "Tokens refreshed successfully",
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken
        });
    } catch (error) {
        console.error("Token refresh error:", error);
        return res.status(403).json({ message: "Invalid refresh token." });
    }
};

/**
 * Enhanced logout with proper session cleanup
 * @route POST /api/v1/auth/logout
 * @desc Logout user and clear all tokens
 * @access Private
 */
export const logout = async (req, res) => {
    try {
        // Get access token from Authorization header
        const accessToken = req.headers.authorization?.split(' ')[1];
        // Get refresh token from cookies or body
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

        if (!accessToken || !refreshToken) {
            return res.status(401).json({
                message: "Access denied. Tokens not provided."
            });
        }

        try {
            // Verify access token first
            const accessDecoded = jwt.verify(
                accessToken,
                process.env.ACCESS_TOKEN_SECRET
            );

            // Then verify refresh token
            const refreshDecoded = jwt.verify(
                refreshToken,
                process.env.REFRESH_TOKEN_SECRET
            );

            // Find user and verify tokens using ID from token
            const user = await findUserById(accessDecoded.id);
            if (!user || user.refreshToken !== refreshToken) {
                return res.status(403).json({
                    message: "Access denied. Invalid tokens."
                });
            }

            // Clear refresh token in database
            await updateUser(user.id, { refreshToken: null });

            // Clear cookies
            res.clearCookie("refreshToken");
            res.clearCookie("accessToken");

            return res.status(200).json({
                message: "Logged out successfully",
            });

        } catch (jwtError) {
            console.log("JWT Verification failed:", jwtError.message);
            return res.status(403).json({
                message: "Invalid token",
                details: process.env.NODE_ENV === 'development' ? jwtError.message : undefined
            });
        }
    } catch (error) {
        console.log("Error during logout:", error);
        return res.status(500).json({
            message: "Internal server error during logout"
        });
    }
};

/**
 * Get user profile details
 * @route GET /api/v1/auth/profile/:id
 * @desc Get profile details for a specific user
 * @access Private
 */
export const Profiledetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: id,
            },
            select: {
                address: true,
                annualPackage: true,
                dateOfBirth: true,
                email: true,
                hiredDate: true,
                id: true,
                firstName: true,
                lastName: true,
                status: true
            }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update user profile
 * @route PUT /api/v1/auth/profile/:id
 * @desc Update profile details for a specific user
 * @access Private
 */
export const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, email, status, annualPackage, hiredDate, dateOfBirth } = req.body;
        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const user = await prisma.user.update({
            where: { id: id },
            data: { firstName, lastName, email, status, annualPackage, hiredDate, dateOfBirth },
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Toggle 2FA for user
 * @route POST /api/v1/auth/toggle-2fa
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
 * @route PUT /api/v1/auth/notification-preferences
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

const findUserById = async (id) => {
    let user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        user = await prisma.superAdmin.findUnique({ where: { id } });
    }
    return user;
};

const updateUser = async (id, data) => {
    let user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        user = await prisma.superAdmin.findUnique({ where: { id } });
        if (user) {
            return await prisma.superAdmin.update({
                where: { id },
                data,
            });
        }
    }
    if (user) {
        return await prisma.user.update({
            where: { id },
            data,
        });
    }
    return null;
};
