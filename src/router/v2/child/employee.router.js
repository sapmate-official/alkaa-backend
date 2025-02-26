import express from "express";
import { createEmployee, deleteEmployee, getEmployeeById, listOfEmployees,checkEmployeeId, updateEmployee,generateEmployeeId } from "../../../controller/v2/organization/Employee/employee.controller.js";

const router = express.Router();
 router.get('/:orgId',listOfEmployees);
 router.get('/:id',getEmployeeById);
router.post('/',createEmployee);
router.put('/',updateEmployee);
router.delete('/',deleteEmployee);


//extra routes
router.get("/employee-id/:orgId",generateEmployeeId);
router.get("/employee-id/:orgId/check/:employeeId",checkEmployeeId);

export default router;