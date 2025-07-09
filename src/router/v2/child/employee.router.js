import express from "express";

import draftRouter from "./draft.router.js";
import {
    getEmployeeById,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    generateEmployeeId,
    checkEmployeeId
} from "../../../controller/v2/organization/Employee/index.js";

const router = express.Router();
 router.get('/:id',getEmployeeById);
router.post('/',createEmployee);
router.put('/',updateEmployee);
router.delete('/',deleteEmployee);


//extra routes
router.get("/employee-id/:orgId",generateEmployeeId);
router.get("/employee-id/:orgId/check/:employeeId",checkEmployeeId);
router.use("/draft/", draftRouter);


export default router;