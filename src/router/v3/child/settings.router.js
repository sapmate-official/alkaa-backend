import e from "express";
import { fetchSettings, resetSettings, updateSettings } from "../../../controller/v3/settings/settings.controller.js";
const router = e.Router();


router.get("/:orgId",fetchSettings);
router.put("/:orgId",updateSettings);
router.post("/reset/:orgId",resetSettings);
export default router;