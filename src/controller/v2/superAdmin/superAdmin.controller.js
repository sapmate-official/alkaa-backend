import prisma from '../../../db/connectDb.js';
import bcrypt from 'bcrypt';



// Get all super admins
export const getSuperAdmins = async (req, res) => {
    try {
        const superAdmins = await prisma.superAdmin.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });
        
        res.status(200).json(superAdmins);
    } catch (error) {
        res.status(500).json({ message: "Error fetching super admins", error: error.message });
    }
};

// Get super admin by ID
export const getSuperAdminById = async (req, res) => {
    try {
        const { id } = req.params;
        const superAdmin = await prisma.superAdmin.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!superAdmin) {
            return res.status(404).json({ message: "Super admin not found" });
        }

        res.status(200).json(superAdmin);
    } catch (error) {
        res.status(500).json({ message: "Error fetching super admin", error: error.message });
    }
};

// Create super admin
export const createSuperAdmin = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        // Validate input
        if (!email || !name || !password) {
            return res.status(400).json({ message: "Email, name and password are required" });
        }

        // Check if super admin already exists
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if (existingSuperAdmin) {
            return res.status(409).json({ message: "Super admin with this email already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create super admin
        const superAdmin = await prisma.superAdmin.create({
            data: {
                email,
                name,
                hashedPassword
            },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(201).json(superAdmin);
    } catch (error) {
        res.status(500).json({ message: "Error creating super admin", error: error.message });
    }
};

// Update super admin
export const updateSuperAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, password } = req.body;

        // Check if super admin exists
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { id }
        });

        if (!existingSuperAdmin) {
            return res.status(404).json({ message: "Super admin not found" });
        }

        // Prepare update data
        const updateData = {};
        if (email) updateData.email = email;
        if (name) updateData.name = name;
        if (password) {
            updateData.hashedPassword = await bcrypt.hash(password, 10);
        }

        // Update super admin
        const updatedSuperAdmin = await prisma.superAdmin.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(200).json(updatedSuperAdmin);
    } catch (error) {
        res.status(500).json({ message: "Error updating super admin", error: error.message });
    }
};

// Delete super admin
export const deleteSuperAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if super admin exists
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { id }
        });

        if (!existingSuperAdmin) {
            return res.status(404).json({ message: "Super admin not found" });
        }

        // Delete super admin
        await prisma.superAdmin.delete({
            where: { id }
        });

        res.status(200).json({ message: "Super admin deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting super admin", error: error.message });
    }
};
export const loginSuperAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send({
                message: "Email and password are required",
            });
        }
        const superAdmin = await prisma.superAdmin.findFirst({
            where: {
                email,
            },
        });
        if (!superAdmin) {
            return res.status(401).send({
                message: "No super admin exists with this Email",
            });
        }
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
                id: user.id,
                email: user.email,
                name:user.name,
            },
            refreshToken,
            accessToken,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}