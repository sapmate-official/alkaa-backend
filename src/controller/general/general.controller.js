import bcrypt from "bcrypt";
import prisma from "../../db/connectDb.js";
import jwt from "jsonwebtoken";
import { generateTokens } from "../../utils/generate.js";
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
            if(user.role == 'EMPLOYEE'){
                
            }
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
            const isPasswordValid =  bcrypt.compare(password, user.hashedPassword);
            if (!isPasswordValid) {
                return res.status(401).send({
                    message: "Invalid credentials",
                });
            }
            const { accessToken, refreshToken } = generateTokens(
                user.email,
                user.role,
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
                    role:user.role
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
    
    const data = await prisma.user.findUnique({ where: { email: req.user.email } });
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

        console.log(user);
        
        const tokens = generateTokens(
            user.email, 
            user.role,
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

        const user = await findUserById(decodedToken.username);
        if (!user || user.refreshToken !== incomingRefreshToken) {
            return res
                .status(403)
                .json({ message: "Access denied. Invalid Token." });
        }

        await updateUser(user.email, { refreshToken: null });

        res.clearCookie("refreshToken");
        res.clearCookie("accessToken");

        return res.status(200).json({
            message: "Logged out successfully",
        });
    } catch (error) {
        return res.status(403).json({ message: "Invalid refresh token." });
    }
}

const findUserById = async (email) => {
    return await prisma.user.findUnique({ where: { email } });
}
const updateUser = async (email, data) => {
    if(!email) return null;
    return await prisma.user.update({ where: { email:email }, data });
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
                id:true,
                name:true,
                email:true,
                role:true,
                status:true,
                annualPackage:true,
                hiredDate:true,
                dateOfBirth:true,
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