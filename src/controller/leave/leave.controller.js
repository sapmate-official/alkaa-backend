import prisma from "../../db/connectDb.js";

const leaveTypeList =async (req,res)=>{
    try {
        
        const typeList = await prisma.leaveType.findMany();
        res.status(200).json(typeList);
    } catch (error) {
        res.status(500).json({ error: error.message });
        
    }
}
export {leaveTypeList}