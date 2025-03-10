import prisma from "../../../db/connectDb.js";
// Category Controllers
const getAllCategories = async (req, res) => {
    try {
        const categories = await prisma.permissionCategory.findMany({
            include: {
                subcategories: {
                    include: {
                        permissions: true
                    }
                }
            }
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

const getCategoryById = async (req, res) => {
    try {
        const category = await prisma.permissionCategory.findUnique({
            where: { id: req.params.id },
            include: {
                subcategories: {
                    include: {
                        permissions: true
                    }
                }
            }
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
};

const createCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const category = await prisma.permissionCategory.create({
            data: { name, description }
        });

        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }

        const category = await prisma.permissionCategory.update({
            where: { id: req.params.id },
            data: { name, description }
        });

        res.json(category);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

const deleteCategory = async (req, res) => {
    try {
        await prisma.permissionCategory.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
};

// Subcategory Controllers
const getAllSubcategories = async (req, res) => {
    try {
        const subcategories = await prisma.permissionSubcategory.findMany({
            include: {
                category: true,
                permissions: true
            }
        });

        res.json(subcategories);
    } catch (error) {
        console.error('Error fetching subcategories:', error);
        res.status(500).json({ error: 'Failed to fetch subcategories' });
    }
};

const createSubcategory = async (req, res) => {
    try {
        const { categoryId, name, description } = req.body;

        if (!categoryId || !name) {
            return res.status(400).json({ error: 'Category ID and name are required' });
        }

        const subcategory = await prisma.permissionSubcategory.create({
            data: { categoryId, name, description }
        });

        res.status(201).json(subcategory);
    } catch (error) {
        console.error('Error creating subcategory:', error);
        res.status(500).json({ error: 'Failed to create subcategory' });
    }
};

// Permission Controllers
const getAllPermissions = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany({
            include: {
                subcategory: {
                    include: {
                        category: true
                    }
                }
            }
        });

        res.json(permissions);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
};

const createPermission = async (req, res) => {
    try {
        const { name, description, subcategoryId, action } = req.body;

        if (!name || !subcategoryId || !action) {
            return res.status(400).json({ error: 'Name, subcategory ID, and action are required' });
        }

        const permission = await prisma.permission.create({
            data: { name, description, subcategoryId, action }
        });

        res.status(201).json(permission);
    } catch (error) {
        console.error('Error creating permission:', error);
        res.status(500).json({ error: 'Failed to create permission' });
    }
};
const updatePermission = async (req, res) => {
    try {
        const { name, subcategoryId, description, action } = req.body;

        const permissionId = req.params.id;

        if (!permissionId) {
            return res.status(400).json({ error: 'Permission ID is required' });
        }
        const permissionData = await prisma.permission.findUnique({
            where: { id: permissionId }
        });
        if (subcategoryId) {

            const subcategory = await prisma.permissionSubcategory.findUnique({
                where: { id: subcategoryId }
            });
            if (!subcategory) {
                return res.status(404).json({ error: 'Subcategory not found' });
            }
        }

        const permission = await prisma.permission.update({
            where: { id: req.params.id },
            data: {
                name: name || permissionData.name,
                subcategoryId: subcategoryId || permissionData.subcategoryId
                , description: description || permissionData.description,
                action: action || permissionData.action
            }
        });

        res.json(permission);
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({ error: 'Failed to update permission' });
    }
}

const deletePermission = async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: 'Permission ID is required' });
        }
        await prisma.permission.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Permission deleted successfully' });
    } catch (error) {
        console.error('Error deleting permission:', error);
        res.status(500).json({ error: 'Failed to delete permission' });
    }
}

export {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getAllSubcategories,
    createSubcategory,
    getAllPermissions,
    createPermission,
    updatePermission,
    deletePermission   
}