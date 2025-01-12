import prisma from "../../db/connectDb.js";
import bcrypt from "bcrypt";
import { sendPasswordResetEmail } from "../../util/sendEmail.js";

const registerEmployee = async (req, res) => { 
    const { name, email, password="sapmate" } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = Math.floor(1000 + Math.random() * 9000);
        const admin = await prisma.user.create({
            data: {
                name,
                email,
                hashedPassword: hashedPassword,
                role: "EMPLOYEE",
                verificationToken:verificationToken.toString(),
                status:"inactive"
            },
        });
        if(admin){
            //send email with verificationToken\
            sendPasswordResetEmail(email,verificationToken)
        }
        res.status(201).json(admin);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }

}
const applyLeave = async (req, res) => {
    try {
        const { startDate, endDate, leaveTypeId, reason } = req.body;
        const user = req.user;
        const currentYear = new Date().getFullYear();
        const existingLeaveRecord = await prisma.leaveRecord.findFirst({
            where: {
                userId: user.id,
                year: currentYear,
                leaveTypeId
            }
        })
        if (!existingLeaveRecord) {
            const leaveTypeDetails = await prisma.leaveType.findUnique({
                where: {
                    id: leaveTypeId
                }
            })
            await prisma.leaveRecord.create({
                data: {
                    userId: user.id,
                    year: currentYear,
                    leaveTypeId,
                    usedDays: 0,
                    remainingDays: leaveTypeDetails.annualLimit
                    
                }
            });
        }
        const ISOstartDate = new Date(startDate).toISOString();
        const ISOendDate = new Date(endDate).toISOString();
        if(ISOstartDate < new Date().toISOString()){
            return res.status(400).json({ error: "Start date should be greater than today" });
        }
        if(ISOendDate < ISOstartDate){
            return res.status(400).json({ error: "End date should be greater than start date" });
        }


        const leaveRequest = await prisma.leaveRequest.create({
            data: {
                userId: user.id,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                leaveTypeId,
                reason,
                status: "PENDING"
            }
        });

        res.status(201).json(leaveRequest);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: error.message });
    }
}
const listLeave = async (req, res) => {
    try {
        console.log(req.user);
        
        const user = req.user;
        const leaves = await prisma.leaveRequest.findMany({
            where:{
                userId:user.id
            }
        });
        res.status(200).json(leaves);
        // res.status(200).json({ message: "List of leave requests" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}
const leaveBalance = async (req, res) => {
    try {
        const user = req.user;
        const currentYear = new Date().getFullYear();
        const leaveBalance = await prisma.leaveRecord.findMany({
            where: {
                userId: user.id,
                year: currentYear
            },
            include:{
                leaveType:true
            }
        });
        res.status(200).json(leaveBalance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export { registerEmployee,applyLeave,listLeave,leaveBalance }
