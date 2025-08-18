import express from "express";
import validateToken from "../../../middleware/validateToken.js";

import draftRouter from "./draft.router.js";
import {
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    generateEmployeeId,
    checkEmployeeId,
    // NEW: Multi-department operations
    assignEmployeeToDepartments,
    removeEmployeeFromDepartments,
    setEmployeePrimaryDepartment
} from "../../../controller/v2/organization/Employee/index.js";

const router = express.Router();

// Basic CRUD operations
router.get('/:id', getEmployeeById);
router.post('/', createEmployee);
router.put('/', updateEmployee);
router.delete('/', deleteEmployee);

// Utility routes
router.get("/employee-id/:orgId", generateEmployeeId);
router.get("/employee-id/:orgId/check/:employeeId", checkEmployeeId);

// NEW: Multi-department management routes
router.post('/:id/departments', validateToken, assignEmployeeToDepartments); // Assign to additional departments
router.delete('/:id/departments', validateToken, removeEmployeeFromDepartments); // Remove from departments
router.put('/:id/departments/primary', validateToken, setEmployeePrimaryDepartment); // Set primary department

// Draft routes
router.use("/draft/", draftRouter);

export default router;