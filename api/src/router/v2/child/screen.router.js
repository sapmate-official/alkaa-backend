import e from "express"
import { dashboardController } from "../../../controller/v2/screen/screen.controller.js"

const router = e.Router()
router.get("/dashboard/:userId",dashboardController)
export default router