import prisma from "../../db/connectDb.js";

const WORKING_HOURS = {
    FULL_DAY: 8,
    HALF_DAY: 4,
    MINIMUM_SESSION: 0.5, // 30 minutes minimum per session
    TARGET_DAILY_HOURS: 8
};

const checkIn = async (req, res) => {
    try {
        const { date, checkInTime, checkInLocation, notes } = req.body;
        
        // Basic validation
        if (!date || !checkInTime || !checkInLocation) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        const checkInDateTime = new Date(checkInTime);
        const attendanceDate = new Date(date);

        // Validate check-in date is not in future
        if (attendanceDate > new Date()) {
            return res.status(400).json({ message: "Cannot check in for future dates" });
        }

        // Check for any ongoing session (has check-in but no check-out)
        const ongoingSession = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                date: attendanceDate,
                checkOutTime: null
            }
        });

        if (ongoingSession) {
            return res.status(400).json({ 
                message: "You have an ongoing work session. Please check out first.",
                sessionId: ongoingSession.id
            });
        }

        // Create new attendance record for this session
        const newSession = await prisma.attendanceRecord.create({
            data: {
                userId: user.id,
                date: attendanceDate,
                checkInTime: checkInDateTime,
                checkInLocation,
                notes,
                sessionNumber: await getNextSessionNumber(user.id, attendanceDate),
                status: 'PRESENT' // Initial status, will be updated on checkout
            }
        });

        res.status(201).json(newSession);
    } catch (error) {
        console.error("Error in checkIn:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const checkOut = async (req, res) => {
    try {
        const { date, checkOutTime, checkOutLocation, notes } = req.body;
        
        if (!date || !checkOutTime || !checkOutLocation) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        const checkOutDateTime = new Date(checkOutTime);
        const attendanceDate = new Date(date);

        // Find current ongoing session
        const currentSession = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                date: attendanceDate,
                checkOutTime: null
            }
        });

        if (!currentSession) {
            return res.status(400).json({ message: "No active work session found" });
        }

        // Validate check-out time
        if (checkOutDateTime <= new Date(currentSession.checkInTime)) {
            return res.status(400).json({ message: "Check-out time must be after check-in time" });
        }

        // Calculate session duration
        const sessionDuration = calculateSessionDuration(currentSession.checkInTime, checkOutDateTime);
        
        // Validate minimum session duration
        if (sessionDuration.hours < WORKING_HOURS.MINIMUM_SESSION) {
            return res.status(400).json({ 
                message: `Session duration must be at least ${WORKING_HOURS.MINIMUM_SESSION * 60} minutes`
            });
        }

        // Get all sessions for the day including current one
        const allDaySessions = await prisma.attendanceRecord.findMany({
            where: {
                userId: user.id,
                date: attendanceDate
            }
        });

        // Calculate total work duration for the day including current session
        const totalDuration = calculateTotalDuration([
            ...allDaySessions.filter(session => session.checkOutTime), // completed sessions
            { checkInTime: currentSession.checkInTime, checkOutTime: checkOutDateTime } // current session
        ]);

        // Determine final status based on total duration
        const status = determineStatus(totalDuration.hours);

        // Update current session
        const updatedSession = await prisma.attendanceRecord.update({
            where: {
                id: currentSession.id
            },
            data: {
                checkOutTime: checkOutDateTime,
                checkOutLocation,
                notes: notes ? `${currentSession.notes || ''} ${notes}`.trim() : currentSession.notes,
                status,
                duration: sessionDuration
            }
        });

        res.status(200).json({
            session: updatedSession,
            dailyTotal: totalDuration,
            remainingHours: Math.max(0, WORKING_HOURS.TARGET_DAILY_HOURS - totalDuration.hours)
        });
    } catch (error) {
        console.error("Error in checkOut:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const getNextSessionNumber = async (userId, date) => {
    const sessions = await prisma.attendanceRecord.findMany({
        where: {
            userId,
            date
        },
        orderBy: {
            sessionNumber: 'desc'
        },
        take: 1
    });

    return sessions.length > 0 ? sessions[0].sessionNumber + 1 : 1;
};

const calculateSessionDuration = (checkInTime, checkOutTime) => {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const durationMs = checkOut - checkIn;
    const hours = durationMs / (1000 * 60 * 60);
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
        hours,
        minutes,
        totalMinutes: Math.floor(hours * 60 + minutes)
    };
};

const calculateTotalDuration = (sessions) => {
    const totalMinutes = sessions.reduce((total, session) => {
        const duration = calculateSessionDuration(session.checkInTime, session.checkOutTime);
        return total + duration.totalMinutes;
    }, 0);

    return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        totalMinutes
    };
};

const determineStatus = (totalHours) => {
    if (totalHours >= WORKING_HOURS.FULL_DAY) {
        return 'PRESENT';
    } else if (totalHours >= WORKING_HOURS.HALF_DAY) {
        return 'HALF_DAY';
    } else if (totalHours > 0) {
        return 'EARLY_DEPARTURE';
    } else {
        return 'ABSENT';
    }
};
const sessionListByDate = async (req, res) => {
    try {
        const { date } = req.query;
        console.log(date);
        if(!date){
            return res.status(400).json({ message: "Date is required" });
        }
        
        const user = req.user;
        const attendanceDate = new Date(date);

        const sessions = await prisma.attendanceRecord.findMany({
            where: {
                userId: user.id,
                date: attendanceDate
            },
            orderBy: {
                checkInTime: 'asc'
            }
        });

        res.status(200).json(sessions);
    } catch (error) {
        console.error("Error in sessionListByDate:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}
const getEmployeeAttendance = async (req, res) => {
    try {
        const employeeList = await prisma.user.findMany({
            where: {
                role: 'EMPLOYEE'
            },
            include:{
                attendanceRecords: true

            },
        })
        res.json(employeeList);
    } catch (error) {
        console.error("Error in getEmployeeAttendance:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
        
    }
};
export { checkIn, checkOut,sessionListByDate,getEmployeeAttendance };