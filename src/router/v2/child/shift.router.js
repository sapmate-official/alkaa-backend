import express from "express";
import {
  assignShiftToEmployee,
  createShiftTemplate,
  deleteShiftTemplate,
  getEmployeeShifts,
  getShiftTemplates,
  updateEmployeeShift,
  updateShiftTemplate
} from "../../../controller/v2/Shift/shift.controller.js";
import {
  createAttendanceRule,
  createBreakRule,
  createOvertimeRule,
  getOrganizationShiftRules
} from "../../../controller/v2/Shift/rule.controller.js";

const router = express.Router();

router.get("/templates/org/:orgId", getShiftTemplates);
router.post("/templates", createShiftTemplate);
router.put("/templates/:id", updateShiftTemplate);
router.delete("/templates/:id", deleteShiftTemplate);

router.get("/rules/org/:orgId", getOrganizationShiftRules);
router.post("/rules/break", createBreakRule);
router.post("/rules/attendance", createAttendanceRule);
router.post("/rules/overtime", createOvertimeRule);

router.get("/employee/:userId", getEmployeeShifts);
router.post("/employee/:userId", assignShiftToEmployee);
router.put("/employee/assignment/:assignmentId", updateEmployeeShift);

export default router;
