import prisma from "./src/db/connectDb.js";

const attendance = async () => {
    try {
        const date = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]
        const userId = "cm7ur350j0042p8ujvrk4jlfv"
        for (let i = 0; i<date.length;i++){
            // Format day with leading zero if needed
            const formattedDay = date[i].toString().padStart(2, '0');
            
            const attendanceRecord = await prisma.attendanceRecord.create({
                data: {
                    userId: userId,
                    date: `2025-03-${formattedDay}T00:00:00.000Z`,
                    status: "PRESENT",
                    sessionNumber:1,
                    checkInLocation:"22.599454255187926,88.29325246848722",
                    checkInTime: `2025-03-${formattedDay}T09:00:00.000Z`,
                    checkOutLocation:"22.599454255187926,88.29325246848722",
                    checkOutTime: `2025-03-${formattedDay}T18:00:00.000Z`,
                    notes: "On time",
                    duration: {
                        "hours": 9.00,
                        "minutes": 0,
                        "totalMinutes": 0
                      },
                      ipAddress:"127.0.0.1",
                      deviceInfo:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
                      verificationStatus:"VERIFIED",
                },  
            });
            console.log(attendanceRecord);
        }

    } catch (error) {
        console.log(error);
    }
}
attendance()