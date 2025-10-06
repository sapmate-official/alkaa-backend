import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../../../db/connectDb.js';
import { sendLoginOTPEmail, sendLoginNotificationEmail } from '../../../util/sendEmail.js';
import { generateTokens, generateTokensWithOrg } from '../../../util/generate.js';
import { setAuthCookies, clearAuthCookies } from '../../../util/authCookies.js';



/**
 * Step 1: Multi-tenant Email Discovery
 * @route POST /api/v1/auth/discover-organizations
 * @desc Find all organizations associated with an email
 * @access Public
 */
export const discoverOrganizations = [
    body('email').isEmail().withMessage('Valid email required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email } = req.body;

            console.log('=== ORGANIZATION DISCOVERY START ===');
            console.log('Email:', email);

            // Check for super admin first
            const superAdmin = await prisma.superAdmin.findUnique({
                where: { email }
            });

            if (superAdmin) {
                return res.status(400).json({ 
                    error: 'Super Admins cannot login through this endpoint. Please use the admin login portal.' 
                });
            }

            // Find all organizations for this user
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

            if (userOrganizations.length === 0) {
                return res.status(404).json({ 
                    error: 'No account found with this email address' 
                });
            }

            // Filter active organizations only (both user status and org status should be active)
            const activeUserOrgs = userOrganizations.filter(u => 
                u.organization.isActive && u.status !== 'suspended'
            );

            if (activeUserOrgs.length === 0) {
                return res.status(403).json({ 
                    error: 'No active organizations found for this user' 
                });
            }

            // Check if any users are inactive and handle accordingly
            const hasInactiveUsers = activeUserOrgs.some(u => u.status === 'inactive');
            
            // If single organization and user is inactive, initiate password reset flow
            if (activeUserOrgs.length === 1 && activeUserOrgs[0].status === 'inactive') {
                console.log(`Single inactive organization found for ${email}, initiating reset flow`);
                
                return res.status(200).json({
                    email,
                    requiresPasswordReset: true,
                    singleInactiveOrganization: {
                        orgId: activeUserOrgs[0].orgId,
                        orgName: activeUserOrgs[0].organization.name,
                        userId: activeUserOrgs[0].id
                    },
                    message: "Your account is inactive. Email verification required for password reset."
                });
            }
            
            // Return organization options with user status information
            console.log(`Found ${activeUserOrgs.length} accessible organizations for ${email}`);
            
            return res.status(200).json({
                email,
                organizations: activeUserOrgs.map(u => ({
                    orgId: u.orgId,
                    orgName: u.organization.name,
                    userId: u.id,
                    userStatus: u.status,
                    hasInactiveUser: u.status === 'inactive'
                })),
                hasInactiveUsers,
                message: activeUserOrgs.length === 1 
                    ? "Organization found. Please enter your password." 
                    : "Multiple organizations found. Please select one and enter your password."
            });

        } catch (error) {
            console.error('Organization discovery error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Step 1.5: Email OTP verification for inactive user password reset
 * @route POST /api/v1/auth/request-reset-otp
 * @desc Send OTP to email for inactive user password reset verification
 * @access Public
 */
export const requestResetOTP = [
    body('email').isEmail().withMessage('Valid email required'),
    body('orgId').notEmpty().withMessage('Organization ID is required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email, orgId } = req.body;

            console.log('=== RESET OTP REQUEST START ===');
            console.log('Email:', email);
            console.log('OrgId:', orgId);

            // Find the specific inactive user in the specific organization
            const user = await prisma.user.findFirst({
                where: { 
                    email,
                    orgId,
                    status: 'inactive'
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

            if (!user) {
                return res.status(404).json({ error: 'Inactive user not found for this organization' });
            }

            // Check organization status
            if (!user.organization?.isActive) {
                return res.status(403).json({ 
                    error: 'Organization is inactive. Please contact support.' 
                });
            }

            // Check if recent OTP exists and is still valid (rate limiting)
            const recentOTP = await prisma.emailOtpVerification.findFirst({
                where: {
                    userId: user.id,
                    purpose: 'PASSWORD_RESET',
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
                    userId: user.id,
                    otpCode: otp,
                    purpose: 'PASSWORD_RESET',
                    expiresAt: otpExpiry,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                }
            });

            // Send OTP email
            try {
                if (process.env.NODE_ENV === 'development') {
                    console.log('=== DEVELOPMENT MODE - RESET OTP ===');
                    console.log(`Reset OTP for ${user.email} (${user.firstName}): ${otp}`);
                    console.log(`Organization: ${user.organization.name}`);
                    console.log(`Client Info: IP=${req.ip}, UserAgent=${req.headers['user-agent']}`);
                    console.log('=====================================');
                } else {
                    await sendLoginOTPEmail(
                        user.email,
                        user.firstName,
                        otp,
                        user.organization.name,
                        {
                            ip: req.ip,
                            userAgent: req.headers['user-agent'],
                            location: await getLocationFromIP(req.ip)
                        }
                    );
                    console.log('Reset OTP email sent successfully');
                }
            } catch (emailError) {
                console.error('Failed to send reset OTP email:', emailError);
                // Continue execution even if email fails
            }

            res.status(200).json({ 
                message: 'Password reset OTP sent successfully',
                expiresIn: 600, // 10 minutes in seconds
                maskedEmail: email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
            });

        } catch (error) {
            console.error('Reset OTP request error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Step 1.6: Verify email OTP for inactive user password reset
 * @route POST /api/v1/auth/verify-reset-otp
 * @desc Verify OTP and generate password reset token for inactive user
 * @access Public
 */
export const verifyResetOTP = [
    body('email').isEmail().withMessage('Valid email required'),
    body('orgId').notEmpty().withMessage('Organization ID is required'),
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

            const { email, orgId, otp } = req.body;

            console.log('=== RESET OTP VERIFICATION START ===');
            console.log('Email:', email);
            console.log('OrgId:', orgId);
            console.log('OTP:', otp);

            // Find the specific inactive user in the specific organization
            const user = await prisma.user.findFirst({
                where: { 
                    email,
                    orgId,
                    status: 'inactive'
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

            if (!user) {
                return res.status(404).json({ error: 'Inactive user not found for this organization' });
            }

            // Find and verify OTP
            const otpRecord = await prisma.emailOtpVerification.findFirst({
                where: {
                    userId: user.id,
                    purpose: 'PASSWORD_RESET',
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
                // Increment attempt count
                await prisma.emailOtpVerification.update({
                    where: { id: otpRecord.id },
                    data: { 
                        attemptsCount: { increment: 1 }
                    }
                });

                const remainingAttempts = otpRecord.maxAttempts - (otpRecord.attemptsCount + 1);
                return res.status(401).json({ 
                    error: 'Invalid OTP', 
                    remainingAttempts: Math.max(0, remainingAttempts)
                });
            }

            // Generate verification token for password reset
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            // Mark OTP as used and update user with verification token
            await prisma.$transaction([
                prisma.emailOtpVerification.update({
                    where: { id: otpRecord.id },
                    data: { 
                        isUsed: true,
                        usedAt: new Date()
                    }
                }),
                prisma.user.update({
                    where: { id: user.id },
                    data: {
                        verificationToken,
                        verificationTokenExpiry: tokenExpiry
                    }
                })
            ]);

            console.log('Reset OTP verification successful, token generated');
            res.status(200).json({
                message: "OTP verified successfully. You can now reset your password.",
                verificationToken,
                userDetails: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    orgId: user.orgId,
                    orgName: user.organization.name
                }
            });

        } catch (error) {
            console.error('Reset OTP verification error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

/**
 * Step 2: Enhanced Multi-tenant Credential Verification with 2FA Integration
 * @route POST /api/v1/auth/verify-credentials
 * @desc Verify user credentials for specific organization and check if 2FA is required
 * @access Public
 */
export const verifyLoginCredentials = [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('orgId').notEmpty().withMessage('Organization ID is required'),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { email, password, orgId } = req.body;
            const clientInfo = {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date()
            };

            console.log('=== CREDENTIAL VERIFICATION START ===');
            console.log('Email:', email);
            console.log('OrgId:', orgId);
            console.log('Client Info:', clientInfo);

            // Find the specific user in the specific organization
            const user = await prisma.user.findFirst({
                where: { 
                    email,
                    orgId,
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

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check user status - handle inactive users specially
            if (user.status === 'inactive') {
                // Generate or retrieve verification token for password reset
                let verificationToken = user.verificationToken;
                let tokenExpiry = user.verificationTokenExpiry;
                
                // Generate new token if doesn't exist or expired
                if (!verificationToken || !tokenExpiry || new Date(tokenExpiry) < new Date()) {
                    verificationToken = crypto.randomBytes(32).toString('hex');
                    tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                    
                    await prisma.user.update({
                        where: { id: user.id },
                        data: {
                            verificationToken,
                            verificationTokenExpiry: tokenExpiry
                        }
                    });
                }
                
                return res.status(403).json({ 
                    error: 'ACCOUNT_INACTIVE',
                    message: 'Your account is inactive. You need to reset your password to activate it.',
                    requiresPasswordReset: true,
                    verificationToken,
                    userDetails: {
                        id: user.id,
                        email: user.email,
                        firstName: user.firstName,
                        orgId: user.orgId,
                        orgName: user.organization.name
                    }
                });
            }
            
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
                const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

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

                console.log('2FA required, session created for user:', user.id);
                return res.status(200).json({
                    requiresOTP: true,
                    sessionToken,
                    userId: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    organizationName: user.organization.name,
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
                    organization: {
                        id: user.organization.id,
                        name: user.organization.name
                    },
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
                if (process.env.NODE_ENV === 'development') {
                    console.log('=== DEVELOPMENT MODE - REQUEST OTP ===');
                    console.log(`OTP for ${session.user.email} (${session.user.firstName}): ${otp}`);
                    console.log(`Organization: ${session.user.organization.name}`);
                    console.log(`Session Token: ${sessionToken}`);
                    console.log(`Client Info: IP=${req.ip}, UserAgent=${req.headers['user-agent']}`);
                    console.log('======================================');
                } else {
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
                }
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
 * Step 3: Enhanced Multi-tenant OTP Verification and Login Completion
 * @route POST /api/v1/auth/verify-login-otp
 * @desc Verify OTP and complete the login process with multi-tenant support
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

            console.log('=== ENHANCED OTP VERIFICATION START ===');
            console.log('Session Token:', sessionToken);
            console.log('OTP:', otp);

            // Verify session token with full user context
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
                            organization: {
                                select: {
                                    id: true,
                                    name: true,
                                    isActive: true
                                }
                            }
                        }
                    }
                }
            });

            if (!session) {
                return res.status(401).json({ error: 'Invalid or expired session' });
            }

            // Additional organization and user status checks
            if (!session.user.organization?.isActive) {
                return res.status(403).json({ 
                    error: 'Organization is inactive. Please contact support.' 
                });
            }

            if (session.user.status !== 'active') {
                return res.status(403).json({ 
                    error: `Account is ${session.user.status}. Please contact your administrator.` 
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
                // Increment attempt count
                await prisma.emailOtpVerification.update({
                    where: { id: otpRecord.id },
                    data: { 
                        attemptsCount: { increment: 1 }
                    }
                });

                const remainingAttempts = otpRecord.maxAttempts - (otpRecord.attemptsCount + 1);
                return res.status(401).json({ 
                    error: 'Invalid OTP', 
                    remainingAttempts: Math.max(0, remainingAttempts)
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

            // Generate tokens with organization context
            const { accessToken, refreshToken } = generateTokensWithOrg(
                session.user.email,
                session.user.id,
                session.user.orgId,
                "2d",
                "7d"
            );

            // Update user's refresh token
            await prisma.user.update({
                where: { id: session.user.id },
                data: { refreshToken }
            });

            setAuthCookies(res, accessToken, refreshToken);

            // Log successful login with 2FA
            await logLoginActivity(session.userId, {
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                timestamp: new Date()
            }, 'SUCCESS_WITH_2FA');

            // Send login notification if enabled
            if (session.user.loginNotificationsEnabled) {
                try {
                    if (process.env.NODE_ENV === 'development') {
                        console.log('=== DEVELOPMENT MODE - LOGIN NOTIFICATION ===');
                        console.log(`Login notification for ${session.user.email} (${session.user.firstName})`);
                        console.log(`Client Info: IP=${req.ip}, UserAgent=${req.headers['user-agent']}`);
                        console.log('=============================================');
                    } else {
                        await sendLoginNotificationEmail(
                            session.user.email,
                            session.user.firstName,
                            {
                                ip: req.ip,
                                userAgent: req.headers['user-agent'],
                                location: await getLocationFromIP(req.ip),
                                timestamp: new Date()
                            }
                        );
                    }
                } catch (notificationError) {
                    console.error('Failed to send login notification:', notificationError);
                    // Continue execution even if notification fails
                }
            }

            console.log('Enhanced OTP verification successful, login completed');
            res.status(200).json({
                message: "Login successful",
                userData: {
                    id: session.user.id,
                    email: session.user.email,
                    firstName: session.user.firstName,
                    lastName: session.user.lastName,
                    orgId: session.user.orgId,
                    orgName: session.user.organization.name,
                    roles: session.user.roles.map(ur => ur.role.name),
                    twoFactorEnabled: session.user.twoFactorEnabled
                },
                refreshToken,
                accessToken,
                organization: {
                    id: session.user.organization.id,
                    name: session.user.organization.name
                }
            });

        } catch (error) {
            console.error('Enhanced OTP verification error:', error);
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
                if (process.env.NODE_ENV === 'development') {
                    console.log('=== DEVELOPMENT MODE - RESEND OTP ===');
                    console.log(`Resent OTP for ${session.user.email} (${session.user.firstName}): ${otp}`);
                    console.log(`Organization: ${session.user.organization.name}`);
                    console.log(`Session Token: ${sessionToken}`);
                    console.log(`Client Info: IP=${req.ip}, UserAgent=${req.headers['user-agent']}`);
                    console.log('====================================');
                } else {
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
                }
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
        
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

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

            clearAuthCookies(res);

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
            twoFactorEnabled: updatedUser.twoFactorEnabled,
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

/**
 * @route PUT /api/v1/auth/change-password
 * @desc Change user's password
 * @access Private
 */
export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        const userId = req.user.id;

        // Validate request body
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                error: 'Current password, new password, and confirmation are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                error: 'New password and confirmation do not match'
            });
        }

        // Password strength validation
        if (newPassword.length < 8) {
            return res.status(400).json({
                error: 'New password must be at least 8 characters long'
            });
        }

        // Find user with current password
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                hashedPassword: true,
                firstName: true,
                lastName: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.hashedPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                error: 'Current password is incorrect'
            });
        }

        // Check if new password is different from current
        const isSamePassword = await bcrypt.compare(newPassword, user.hashedPassword);
        if (isSamePassword) {
            return res.status(400).json({
                error: 'New password must be different from current password'
            });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        // Update password in database
        await prisma.user.update({
            where: { id: userId },
            data: { 
                hashedPassword: hashedNewPassword,
                updatedAt: new Date()
            }
        });

        // Log password change activity
        await logLoginActivity(userId, {
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || 'Unknown',
            timestamp: new Date()
        }, 'PASSWORD_CHANGE');

        res.status(200).json({
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
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
