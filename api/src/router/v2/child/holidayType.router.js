import express from "express";
import { createHolidayType, deleteHolidayType, getAllHolidayTypes, getHolidayType, updateHolidayType } from "../../../controller/v2/holiday/holidayType.controller.js";

const router = express.Router();

router.get("/:orgId", getAllHolidayTypes);
router.get("/:id", getHolidayType);
router.post("/", createHolidayType);
router.put("/:id", updateHolidayType);
router.patch("/:id", updateHolidayType);
router.delete("/:id", deleteHolidayType);

export default router;