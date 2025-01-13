import prisma from "../../db/connectDb.js";
import bcrypt from "bcrypt";
import { sendPasswordResetEmail } from "../../util/sendEmail.js";

const registerManager = async (req, res) => { 
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = Math.floor(1000 + Math.random() * 9000);
        const admin = await prisma.user.create({
            data: {
                name,
                email,
                hashedPassword: hashedPassword,
                role: "MANAGER",
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
        console.log(error)
        res.status(500).json({ error: error.message });
    }

}
const listOfLeave  = async (req, res) => {
    try {
        const leaves = await prisma.leaveRequest.findMany({
            where: {
                status: "PENDING",
            },
            include:{
                User:true
            }
        });
        res.status(200).json(leaves);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}
const responseLeave = async (req, res) => {
    try {
        const { leaveId, status,rejectedReason } = req.body;
        if (!leaveId || !status) {
            return res.status(400).json({ error: "All fields are required" });
        }
        const user = req.user;
        const leave = await prisma.leaveRequest.findFirst({
            where: {
                id: leaveId,
            },
        });
        if (!leave) {
            return res.status(404).json({ error: "Leave request not found" });
        }
        if(leave.status !== "PENDING"){
            return res.status(400).json({ error: "Leave request already responded" });
        }
        if(status === "REJECTED"){
            const updatedLeave = await prisma.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status,
                    approvedBy: user.id,
                    approvedAt: new Date(),
                    rejectedReason: rejectedReason
                }
            });
            return res.status(200).json(updatedLeave);
        }
        const updatedLeave = await prisma.leaveRequest.update({
            where: { id: leaveId },
            data: {
                status,
                approvedBy: user.id,
                approvedAt: new Date(),
            }
        });
        const leaveRecord = await prisma.leaveRecord.findFirst({
            where: {
                userId: leave.userId,
                year: new Date().getFullYear(),
                leaveTypeId: leave.leaveTypeId
            },
        })
        console.log(leaveRecord);
        
        const updatedLeaveRecord = await prisma.leaveRecord.update({
            where: { id: leaveRecord.id },
            data: { usedDays: leaveRecord.usedDays + 1, remainingDays: leaveRecord.remainingDays - 1 },
        });
        res.status(200).json(updatedLeave);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}
const leaveTypeCreate = async (req, res) => {
    const { name,description,annualLimit } = req.body;
    try {
        if (!name || !description || !annualLimit) {
            return res.status(400).json({ error: "All fields are required" });
        }
        const leave = await prisma.leaveType.create({
            data: {
                name,
                description,
                annualLimit:parseInt(annualLimit)
            },
        });
        const employeeList = await prisma.user.findMany({
            where: {
                role: "EMPLOYEE",
            },
        });
        for (let i = 0; i < employeeList.length; i++) {
            await prisma.leaveRecord.create({
                data: {
                    userId: employeeList[i].id,
                    year: new Date().getFullYear(),
                    leaveTypeId: leave.id,
                    usedDays: 0,
                    remainingDays: leave.annualLimit
                }
            });
        }
        res.status(201).json(leave);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}
const employeeList = async (req, res) => {
    try {
        const employees = await prisma.user.findMany({
            where: {
                role: "EMPLOYEE",
            },
        });
        res.status(200).json(employees);
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
}
export { registerManager,listOfLeave,responseLeave,leaveTypeCreate,employeeList }
