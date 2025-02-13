import bcrypt from "bcrypt";
import prisma from "../../../db/connectDb.js";
import jwt from "jsonwebtoken";
import { generateTokens } from "../../../utils/generate.js";
const setPassword = async (req, res) => {   
    try {
        const {password,verificationToken} = req.body;
        console.log(password,verificationToken);
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.findFirst({
            where:{
                verificationToken
            }
        });
        if(user){
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: { hashedPassword, status: "active" },
            });
            
            res.status(200).json(updatedUser);
        }else{
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
        
    }
}
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
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
        if (superAdmin) {
            const isPasswordValid = await bcrypt.compare(password, superAdmin.hashedPassword);
            if (!isPasswordValid) {
                return res.status(401).send({
                    message: "Invalid credentials",
                });
            }
            const { accessToken, refreshToken } = generateTokens(
                superAdmin.email,
                superAdmin.id,
                "2d",
                "7d"
            );
            const puttoken = await prisma.superAdmin.update({
                where:{
                    email: email},
                data:{refreshToken:refreshToken,
                }
            })
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
            });
            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
            });
            return res.status(200).send({
                message: "Super Admin logged in successfully",
                userData: {
                    id: superAdmin.id,
                    email: superAdmin.email,
                    name:superAdmin.name,
                },
                refreshToken,
                accessToken,
            });
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
        if(user.status =="inactive"){
            return res.status(401).send({
                message: "User is inactive",
            });
        }
        if(user.status =="suspended"){
            return res.status(401).send({
                message: "User is suspended",
            });
        }
        console.log(user.hashedPassword);
        
            const isPasswordValid =  bcrypt.compare(password, user.hashedPassword);
            if (!isPasswordValid) {
                return res.status(401).send({
                    message: "Invalid credentials",
                });
            }
            const userRole = await prisma.userRole.findFirst({
                where:{
                    userId:user.id
                },
                include:{
                    role:{
                        select:{
                            name:true
                        }
                    }
                }
            })
            const { accessToken, refreshToken } = generateTokens(
                user.email,
                user.id,
                "2d",
                "7d"
            );
            const puttoken = await prisma.user.update({
                where:{
                    email: email},
                data:{refreshToken:refreshToken,
                }
            })
            
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
            });
    
            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
            });

            return res.status(200).send({
                message: "User logged in successfully",
                userData: {
                    id: user.id,
                    email: user.email,
                    name:user.name,
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
const validatetoken  = async (req, res) => {
    
    let data = await prisma.user.findUnique({ where: { email: req.user.email } ,include:{
        organization:{
            select:{
                id:true
            }
        },
        department:{
            select:{
                id:true
            }
        }
    }});
    if(!data){
        data = await prisma.superAdmin.findUnique({ where: { email: req.user.email } });
    }
    res.status(200).json({ message: "Token is valid", user: data });
}
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body; 
        let incomingRefreshToken = req.cookies.refreshToken || req.headers.authorization?.split(' ')[1]; 

        
        if (!incomingRefreshToken && !refreshToken) {
            return res
                .status(401)
                .json({ message: "Access denied. No token provided." });
        }

        
        if (!incomingRefreshToken) {
            incomingRefreshToken = refreshToken;
        }

        
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        
        const user = await findUserById(decodedToken.email);
        if (!user || user.refreshToken !== incomingRefreshToken) {
            return res
                .status(403)
                .json({ message: "Access denied. Invalid Token." });
        }
       
        
        const tokens = generateTokens(
            user.email, 
            user.id,
            "2d", 
            "7d"   
        );

        const newaccessToken = tokens.accessToken;
        const newrefreshToken = tokens.refreshToken;
        console.log(newaccessToken, newrefreshToken);
        
        
        await updateUser(user.email, { refreshToken: newrefreshToken });

        
        res.cookie("refreshToken", newrefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        
        res.cookie("accessToken", newaccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        
        return res.status(200).json({
            message: "Access Token Refreshed Successfully",
            refreshToken: newrefreshToken,
            accessToken: newaccessToken,
        });
    } catch (error) {
        console.log(error);
        
        return res.status(403).json({ message: "Invalid refresh token." });
    }
}
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
        if(user){
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
        if(!id){
            return res.status(400).json({ error: "User ID is required" });
        }
        console.log(id);
        
        const user = await prisma.user.findUnique({
            where: {
                id: id,
            },
            select:{
                address:true,
                annualPackage:true,
                dateOfBirth:true,
                email:true,
                hiredDate:true,
                id:true,
                name:true,
                role:true,
                status:true
                
            }
        });
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


const updateProfile = async(req,res) => {
    try {
        const { id } = req.params;
        const { name, email, role, status, annualPackage, hiredDate, dateOfBirth } = req.body;
        if(!id){
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

export { setPassword,loginUser,validatetoken,refreshToken,logout,Profiledetails,updateProfile }