import express from "express";
import  {createPreset,
    deletePreset,
    getPresetById,
    getPresets,
    updatePreset
} from "../../../controller/v3/PermissionPreset/PermissionPreset.controller.js"

const router = express.Router();

router.get("/org/:orgId", getPresets);
router.get("/:id", getPresetById);
router.post("/", createPreset);
router.put("/:id", updatePreset);
router.delete("/:id", deletePreset);

export default router;