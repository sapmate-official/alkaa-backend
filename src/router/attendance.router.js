import e from "express";
import { getEmployeeAttendance, checkIn, checkOut, sessionListByDate } from "../controller/attendance/attendance.controller.js";
import validateToken from "../middleware/validateToken.js";
import { roleCheckEmployee } from "../middleware/roleCheck.js";

const router = e.Router();

router.post("/check-in",validateToken, checkIn)
router.post("/check-out",validateToken, checkOut)
router.get("/session", validateToken, sessionListByDate)
router.get("/history", validateToken, getEmployeeAttendance)


export default router