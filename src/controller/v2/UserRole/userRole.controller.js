import prisma from "../../../db/connectDb.js";
export const getUserRoles = async (req, res) => {
    try {
        const userRoles = await prisma.userRole.findMany();
        res.status(200).json(userRoles);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user roles" });
    }
};

export const getUserRoleById = async (req, res) => {
    const { id } = req.params;
    try {
        const userRole = await prisma.userRole.findUnique({ where: { id } });
        if (!userRole) {
            return res.status(404).json({ error: "User role not found" });
        }
        res.status(200).json(userRole);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user role" });
    }
};

export const createUserRole = async (req, res) => {
    const { userId, roleId } = req.body;
    try {
        const newUserRole = await prisma.userRole.create({
            data: { userId, roleId },
        });
        res.status(201).json(newUserRole);
    } catch (error) {
        res.status(500).json({ error: "Failed to create user role" });
    }
};

export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { userId, roleId } = req.body;
    try {
        const updatedUserRole = await prisma.userRole.update({
            where: { id },
            data: { userId, roleId },
        });
        res.status(200).json(updatedUserRole);
    } catch (error) {
        res.status(500).json({ error: "Failed to update user role" });
    }
};

export const deleteUserRole = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.userRole.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Failed to delete user role" });
    }
};