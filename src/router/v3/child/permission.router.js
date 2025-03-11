import e from "express";
import { createCategory, createPermission, createSubcategory, deleteCategory, getAllCategories, getAllPermissions, getAllSubcategories, getCategoryById, updateCategory,updatePermission,deletePermission,getSubCategoryById,updateSubCategory,deleteSubCategory,getPermissionById } from "../../../controller/v3/permission/permission.controller.js";

const router = e.Router();

router.get('/categories', getAllCategories);
router.get('/category/:id', getCategoryById);
router.post('/category', createCategory);
router.put('/category/:id', updateCategory);
router.delete('/category/:id', deleteCategory);

// Subcategory routes
router.get('/subcategories', getAllSubcategories);
router.get('/subcategory/:id', getSubCategoryById);
router.post('/subcategory', createSubcategory);
router.put('/subcategory/:id', updateSubCategory);
router.delete('/subcategory/:id', deleteSubCategory);

// Permission routes
router.get('/permissions', getAllPermissions);
router.get('/permission/:id', getPermissionById);
router.post('/permission', createPermission);
router.put('/permission/:id', updatePermission);
router.delete('/permission/:id', deletePermission);

export default router;