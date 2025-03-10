import e from "express";
import { createCategory, createPermission, createSubcategory, deleteCategory, getAllCategories, getAllPermissions, getAllSubcategories, getCategoryById, updateCategory,updatePermission,deletePermission } from "../../../controller/v3/permission/permission.controller.js";

const router = e.Router();

router.get('/category', getAllCategories);
router.get('/category/:id', getCategoryById);
router.post('/category', createCategory);
router.put('/category/:id', updateCategory);
router.delete('/category/:id', deleteCategory);

// Subcategory routes
router.get('/subcategory', getAllSubcategories);
router.post('/subcategory', createSubcategory);

// Permission routes
router.get('/permissions', getAllPermissions);
router.post('/permissions', createPermission);
router.put('/permission/:id', updatePermission);
router.delete('/permission/:id', deletePermission);

export default router;