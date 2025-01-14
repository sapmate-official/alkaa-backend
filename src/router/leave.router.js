import e from 'express'
import { leaveTypeList } from '../controller/leave/leave.controller.js'

const router = e.Router()

router.get('/type', leaveTypeList)
export default router