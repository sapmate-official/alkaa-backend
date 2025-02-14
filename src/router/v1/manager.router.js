import express from 'express'
import { registerManager,listOfLeave, responseLeave,leaveTypeCreate,employeeList } from '../../controller/v1/manager/manager.controller.js'
import validateToken from '../../middleware/validateToken.js'
import { roleCheckManager } from '../../middleware/roleCheck.js'
const router = express.Router()


router.post("/register",registerManager)
router.get("/list-of-leave",validateToken,roleCheckManager,listOfLeave)
router.post("/respond-leave",validateToken,roleCheckManager,responseLeave)
router.post("/leave-type/create",leaveTypeCreate)
router.get("/employee-list",validateToken,roleCheckManager,employeeList)

export default router