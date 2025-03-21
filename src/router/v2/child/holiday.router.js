import express from "express";
import { createHoliday, deleteHoliday, getHolidayById, getHolidays, updateHoliday } from "../../../controller/v2/holiday/holiday.controller.js";

const router = express.Router();

router.get("/:orgId", getHolidays);
router.get("/:id", getHolidayById);
router.post("/", createHoliday);
router.put("/:id", updateHoliday);
router.patch("/:id", updateHoliday);
router.delete("/:id", deleteHoliday);

export default router;