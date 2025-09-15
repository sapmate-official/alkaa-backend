import bcrypt from "bcrypt";
import prisma from "../../../db/connectDb.js";
import jwt from "jsonwebtoken";
import { generateTokens, generateTokensWithOrg } from "../../../util/generate.js";
import crypto from "crypto";
import { sendLoginOTPEmail } from "../../../util/sendEmail.js";
// Step 1: Check Email and Organizations
const checkEmailForLogin = async (req, res) => {
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
                status: { in: ['active', 'inactive'] } // Exclude suspended users
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

// Step 2: Verify Password and Send OTP
const verifyPasswordAndSendOtp = async (req, res) => {
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
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

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
        // console.log("OTP : ",otpCode)
        // Send OTP email with organization branding
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

        // Generate temporary session token
        const sessionToken = crypto.randomBytes(32).toString('hex');
        const sessionExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

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
            otpExpiresIn: 600 // 10 minutes in seconds
        });

    } catch (error) {
        console.error("Password verification error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Step 3: Verify OTP and Complete Login
const verifyOtpAndLogin = async (req, res) => {
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

const setPassword = async (req, res) => {
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
}

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(email,password)
        if (!email || !password) {
            return res.status(400).send({
                message: "college_uid and password are required",
            });
        }
        const superAdmin = await prisma.superAdmin.findFirst({
            where: {
                email,
            },
        });
        console.log(superAdmin);
        if (superAdmin) {
            return res.status(401).send({
                message: "Super Admins cannot login through this endpoint",
            });
            // const isPasswordValid = await bcrypt.compare(password, superAdmin.hashedPassword);
            // console.log(isPasswordValid);   
            // if (!isPasswordValid) {
            //     return res.status(401).send({
            //         message: "Invalid credentials",
            //     }); 
            // }
            
            // const { accessToken, refreshToken } = generateTokens(
            //     superAdmin.email,
            //     superAdmin.id,
            //     "2d",
            //     "7d"
            // );
            // const puttoken = await prisma.superAdmin.update({
            //     where: {
            //         email: email
            //     },
            //     data: {
            //         refreshToken: refreshToken,
            //     }
            // })
            // res.cookie("refreshToken", refreshToken, {
            //     httpOnly: true,
            //     secure: process.env.NODE_ENV === "production",
            //     sameSite: "lax",  // Changed from strict to lax for better cross-site compatibility
            //     maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in milliseconds
            //     expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            //     path: "/",
            //     domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined // Root domain for production
            // });
            // res.cookie("accessToken", accessToken, {
            //     httpOnly: true,
            //     secure: process.env.NODE_ENV === "production",
            //     sameSite: "lax",  // Changed from strict to lax
            //     maxAge: 2 * 24 * 60 * 60 * 1000,  // 2 days in milliseconds
            //     expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            //     path: "/",
            //     domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined // Root domain for production
            // });
            // return res.status(200).send({
            //     message: "Super Admin logged in successfully",
            //     userData: {
            //         id: superAdmin.id,
            //         email: superAdmin.email,
            //         name: superAdmin.name,
            //     },
            //     refreshToken,
            //     accessToken,
            // });
        }

        const user = await prisma.user.findFirst({
            where: {
                email,
            },
        });
        console.log(user);
        if (!user) {
            // Use a generic message to prevent user enumeration
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
        console.log(user.hashedPassword);

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
        })
        const organisationStatus = await prisma.organization.findFirst({
            where: {
                id: user.orgId
            },
            select:{
                isActive:true,
            }
        })
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
        if(user){
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    refreshToken: refreshToken,
                }
            })
        }

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",  // Changed from strict to lax
            maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days in milliseconds
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined // Root domain for production
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",  // Changed from strict to lax
            maxAge: 2 * 24 * 60 * 60 * 1000,  // 2 days in milliseconds
            expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
            path: "/",
            domain: process.env.NODE_ENV === "production" ? ".alkaa.online" : undefined // Root domain for production
        });

        return res.status(200).send({
            message: "User logged in successfully",
            userData: {
                id: user.id,
                email: user.email,
                name: user.name,
                // Include other non-sensitive user data here
            },
            refreshToken,
            accessToken,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}
// Update the validatetoken function
const validatetoken = async (req, res) => {
    try {
        // req.user should be available from the middleware
        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Invalid user authentication" });
        }

        let data = await prisma.user.findFirst({
            where: { 
                id: req.user.id,
                ...(req.user.orgId && { orgId: req.user.orgId }) // Include orgId if available in token
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
}
// Update the refreshToken function
const refreshToken = async (req, res) => {
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

        // Return new tokens
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
const logout = async (req, res) => {
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

const findUserById = async (id) => {
    let user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
        user = await prisma.superAdmin.findUnique({ where: { id } });
    }
    return user;
}

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
}
const Profiledetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }
        console.log(id);

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
                name: true,
                role: true,
                status: true

            }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, role, status, annualPackage, hiredDate, dateOfBirth } = req.body;
        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const user = await prisma.user.update({
            where: { id: id },
            data: { name, email, role, status, annualPackage, hiredDate, dateOfBirth },
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export { 
    setPassword, 
    loginUser, 
    validatetoken, 
    refreshToken, 
    logout, 
    Profiledetails, 
    updateProfile,
    checkEmailForLogin,
    verifyPasswordAndSendOtp,
    verifyOtpAndLogin
};