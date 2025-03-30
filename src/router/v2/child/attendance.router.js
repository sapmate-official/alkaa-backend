import express from "express";
import { checkIn, checkOut, createAttendance, deleteAttendance, getAttendanceById, getAttendances, getEmployeeAttendance, getUserAttendance, sessionListByDate, updateAttendance,getEmployeeRecords,verifyAttendance, getTodaysAttendance, getCheckOutPast, postPastCheckOut, createPastAttendance } from "../../../controller/v2/Attendance/attendance.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const  router = express.Router();

router.get("/", getAttendances);
router.get("/:id", getAttendanceById);
router.post("/", createAttendance);
router.put("/:id", updateAttendance);
router.patch("/:id", updateAttendance);
router.delete("/:id", deleteAttendance);

//extra routes
router.post("/check-in",validateToken,checkIn);
router.post("/check-out",validateToken,checkOut);
router.get("/check-out/past",validateToken,getCheckOutPast);
router.post("/check-out/past",validateToken,postPastCheckOut);
router.post("/past-attendance",validateToken,createPastAttendance);
router.get("/session/:date",validateToken,sessionListByDate);
router.get("/employees",validateToken,getEmployeeAttendance);
router.get("/user/:id",validateToken,getUserAttendance);
router.get("/manager/verification/:managerId",getEmployeeRecords);
router.post("/manager/verification",validateToken,verifyAttendance);
router.get("/manager/live/:managerId",getTodaysAttendance)


export default router;