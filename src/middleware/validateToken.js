import jwt from "jsonwebtoken";
import prisma from "../db/connectDb.js";

export default async function validateToken(req, res, next) {
    try {

        if (req.path === "/super-admin") {
            return next();
        }
        if (req.path === "/super-admin" || 
            req.path.startsWith("/verify/") || 
            req.path.startsWith("/submit/")) {
            return next();
        }
        // Get token from multiple sources (header or cookie)
    const authHeader = req.header("Authorization");
    const cookieToken = req.cookies?.accessToken;
    const queryToken = req.query?.token;
        
        let token;
        
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        } else if (cookieToken) {
            token = cookieToken;
        } else if (typeof queryToken === "string" && queryToken.trim()) {
            token = queryToken.trim();
        }
        
        if (!token) {
            return res.status(401).json({ 
                message: "Access denied. No token provided.",
                expired: false
            });
        }
        
        // Add clock tolerance to handle slight time differences
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            clockTolerance: 60 // 60 seconds tolerance
        });

        // Fetch user data from database to get orgId and other details
        const userId = decoded.id || decoded.userId;
        const userdata = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                orgId: true,
                firstName: true,
                lastName: true,
                isActive: true,
                employmentType: true,
                contractEndDate: true
            }
        });

        if (!userdata) {
            // Check if it's a super admin
            const superAdmin = await prisma.superAdmin.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true
                }
            });
            
            if (superAdmin) {
                req.user = {
                    id: superAdmin.id,
                    email: superAdmin.email
                };
            } else {
                return res.status(401).json({ 
                    message: "User not found.",
                    expired: false 
                });
            }
        } else {
            // Check if user account is active
            if (!userdata.isActive) {
                return res.status(403).json({
                    message: "Account has been deactivated. Please contact your administrator.",
                    deactivated: true,
                    reason: userdata.contractEndDate ? "Contract expired" : "Account deactivated"
                });
            }

            // Standardize the user object with orgId
            req.user = {
                id: userdata.id,
                email: userdata.email,
                orgId: userdata.orgId,
                firstName: userdata.firstName,
                lastName: userdata.lastName,
                employmentType: userdata.employmentType,
                contractEndDate: userdata.contractEndDate
            };
        }
        
        next();
    } catch (error) {
        console.error("Token verification error:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                message: "Token expired",
                expired: true
            });
        }

        return res.status(401).json({ 
            message: "Invalid token.",
            expired: false 
        });
    }
}

export const validateSuperAdminTokenMiddleware = (req, res, next) => {
    try {
        let token = req.cookies.accessToken || req.headers["authorization"]?.split(" ")[1];
        
        if(!token) return res.status(401).json({message: "Token not found"});
        
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if(err) return res.status(403).json({message: "Invalid token"});
            req.user = decoded;
            next();
        });
    } catch (error) {
        console.error("Super admin token validation error:", error);
        return res.status(500).json({message: "Token validation error"});
    }
}