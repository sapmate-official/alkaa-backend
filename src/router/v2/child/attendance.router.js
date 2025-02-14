import express from "express";
import { checkIn, checkOut, createAttendance, deleteAttendance, getAttendanceById, getAttendances, getEmployeeAttendance, getUserAttendance, sessionListByDate, updateAttendance } from "../../../controller/v2/Attendance/attendance.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

router.get("/", getAttendances);
router.get("/:id", getAttendanceById);
router.post("/", createAttendance);
router.put("/:id", updateAttendance);
router.patch("/:id", updateAttendance);
router.delete("/:id", deleteAttendance);

//extra routes
router.post("/check-in",validateToken,checkIn);
router.post("/check-out",validateToken,checkOut);
router.get("/session/:date",validateToken,sessionListByDate);
router.get("/employees",validateToken,getEmployeeAttendance);
router.get("/user/:id",validateToken,getUserAttendance);



export default router;