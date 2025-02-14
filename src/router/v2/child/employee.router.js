import express from "express";
import { createEmployee, deleteEmployee, getEmployeeById, listOfEmployees, updateEmployee } from "../../../controller/v2/organization/Employee/employee.controller.js";

const router = express.Router();
 router.get('/:orgId',listOfEmployees);
 router.get('/:id',getEmployeeById);
router.post('/',createEmployee);
router.put('/',updateEmployee);
router.delete('/',deleteEmployee);
export default router;