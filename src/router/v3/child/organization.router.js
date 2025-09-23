import e from "express";
import validateToken from "../../../middleware/validateToken.js";
import { getOrganizationEmployees } from "../../../controller/v3/Organization/organizationController.js";

const router = e.Router();

router.use((req, res, next) => {
    console.log("Organization Router v3 Loaded");
    next();
});

// Get organization employees
router.get("/employees", validateToken, getOrganizationEmployees);

export default router;
