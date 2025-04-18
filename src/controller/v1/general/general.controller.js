import bcrypt from "bcrypt";
import prisma from "../../../db/connectDb.js";
import jwt from "jsonwebtoken";
import { generateTokens } from "../../../util/generate.js";
import exp from "constants";
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
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Invalid user authentication" });
        }

        let data = await prisma.user.findFirst({
            where: { email: req.user.email }, 
            include: {
                organization: {
                    select: {
                        id: true,
                        isActive: true,
                        name: true
                    }
                },
                Department: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });
        
        if(data?.organization?.isActive === false){
            return res.status(401).json({ message: "Organization is inactive" });
        }
        
        if (!data) {
            data = await prisma.superAdmin.findUnique({ 
                where: { email: req.user.email },
                select: {
                    id: true,
                    email: true,
                    name: true
                }
            });
            
            if (!data) {
                return res.status(404).json({ message: "User not found" });
            }
        }
        
        // Return successful response with user data
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
        
        if (!refreshToken) {
            return res.status(401).json({ message: "Refresh token is required." });
        }

        // Verify refresh token
        const decodedToken = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        // Find user
        const user = await findUserById(decodedToken.email);
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: "Invalid refresh token." });
        }

        // Generate new tokens
        const tokens = generateTokens(
            user.email,
            user.id,
            "2d",
            "7d"
        );

        // Update user's refresh token
        await updateUser(user.email, { refreshToken: tokens.refreshToken });

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

            // Find user and verify tokens
            const user = await findUserById(accessDecoded.email);
            if (!user || user.refreshToken !== refreshToken) {
                return res.status(403).json({
                    message: "Access denied. Invalid tokens."
                });
            }

            // Clear refresh token in database
            await updateUser(user.email, { refreshToken: null });

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

const findUserById = async (email) => {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        user = await prisma.superAdmin.findUnique({ where: { email } });
    }
    return user;
}
const updateUser = async (email, data) => {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        user = await prisma.superAdmin.findUnique({ where: { email } });
        if (user) {
            return await prisma.superAdmin.update({
                where: { email },
                data,
            });
        }
    }
    if (user) {
        return await prisma.user.update({
            where: { email },
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

export { setPassword, loginUser, validatetoken, refreshToken, logout, Profiledetails, updateProfile };