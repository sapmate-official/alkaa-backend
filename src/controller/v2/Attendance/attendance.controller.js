import prisma from "../../../db/connectDb.js";
const WORKING_HOURS = {
    FULL_DAY: 8,
    HALF_DAY: 4,
    MINIMUM_SESSION: 0.5, // 30 minutes minimum per session
    TARGET_DAILY_HOURS: 8
};
export const getAttendances = async (req, res) => {
    try {
        const attendances = await prisma.attendanceRecord.findMany();
        res.status(200).json(attendances);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch attendances" });
    }
};

export const getAttendanceById = async (req, res) => {
    const { id } = req.params;
    try {
        const attendance = await prisma.attendanceRecord.findUnique({
            where: { id },
        });
        if (!attendance) {
            return res.status(404).json({ error: "Attendance not found" });
        }
        res.status(200).json(attendance);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch attendance" });
    }
};

export const createAttendance = async (req, res) => {
    const { userId, date, sessionNumber, checkInTime, checkOutTime, checkInLocation, checkOutLocation, status, notes, duration } = req.body;
    try {
        const newAttendance = await prisma.attendanceRecord.create({
            data: {
                userId,
                date,
                sessionNumber,
                checkInTime,
                checkOutTime,
                checkInLocation,
                checkOutLocation,
                status,
                notes,
                duration,
                ipAddress,
                deviceInfo,
            },
        });
        res.status(201).json(newAttendance);
    } catch (error) {
        res.status(500).json({ error: "Failed to create attendance" });
    }
};

export const updateAttendance = async (req, res) => {
    const { id } = req.params;
    const { userId, date, sessionNumber, checkInTime, checkOutTime, checkInLocation, checkOutLocation, status, notes, duration } = req.body;
    try {
        const updatedAttendance = await prisma.attendanceRecord.update({
            where: { id },
            data: {
                userId,
                date,
                sessionNumber,
                checkInTime,
                checkOutTime,
                checkInLocation,
                checkOutLocation,
                status,
                notes,
                duration,
                ipAddress,
                deviceInfo
            },
        });
        res.status(200).json(updatedAttendance);
    } catch (error) {
        res.status(500).json({ error: "Failed to update attendance" });
    }
};

export const deleteAttendance = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.attendanceRecord.delete({
            where: { id },
        });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: "Failed to delete attendance" });
    }
};



/**
 * @route POST /api/v2/attendance/check-in
 * @desc Check in attendance for a user
 * @access Private
 */
export const checkIn = async (req, res) => {
    console.log('Starting checkIn process...');
    try {
        const { date, checkInTime, checkInLocation, notes } = req.body;
        console.log('Request body:', { date, checkInTime, checkInLocation, notes });
        
        if (!date || !checkInTime || !checkInLocation) {
            console.log('Missing required fields:', { date, checkInTime, checkInLocation });
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        console.log('User details:', user);
        
        const checkInDateTime = new Date(checkInTime);
        const attendanceDate = new Date(date);
        console.log('Parsed dates:', { checkInDateTime, attendanceDate });

        if (attendanceDate > new Date()) {
            console.log('Future date detected:', attendanceDate, new Date());
            return res.status(400).json({ message: "Cannot check in for future dates" });
        }

        const ongoingSession = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                date: attendanceDate,
                checkOutTime: null
            }
        });
        console.log('Ongoing session check:', ongoingSession);

        if (ongoingSession) {
            console.log('Found ongoing session:', ongoingSession.id);
            return res.status(400).json({ 
                message: "You have an ongoing work session. Please check out first.",
                sessionId: ongoingSession.id
            });
        }

        const nextSessionNumber = await getNextSessionNumber(user.id, attendanceDate);
        console.log('Next session number:', nextSessionNumber);

        const newSession = await prisma.attendanceRecord.create({
            data: {
                userId: user.id,
                date: attendanceDate,
                checkInTime: checkInDateTime,
                checkInLocation,
                notes,
                sessionNumber: nextSessionNumber,
                status: 'PRESENT',
                ipAddress: req.ip,
                deviceInfo: req.headers['user-agent']
            }
        });
        console.log('Created new session:', newSession);

        res.status(201).json(newSession);
    } catch (error) {
        console.error("Error in checkIn:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/**
 * @route POST /api/v2/attendance/check-out
 * @desc Check out attendance for a user
 * @access Private
 */
export const checkOut = async (req, res) => {
    try {
        const { checkInId,date, checkOutTime, checkOutLocation, notes } = req.body;
        
        if (!date || !checkOutTime || !checkOutLocation) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        const checkOutDateTime = new Date(checkOutTime);
        const attendanceDate = new Date(date);

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

        if (checkOutDateTime <= new Date(currentSession.checkInTime)) {
            return res.status(400).json({ message: "Check-out time must be after check-in time" });
        }

        const sessionDuration = calculateSessionDuration(currentSession.checkInTime, checkOutDateTime);
        
        if (sessionDuration.hours < WORKING_HOURS.MINIMUM_SESSION) {
            return res.status(400).json({ 
                message: `Session duration must be at least ${WORKING_HOURS.MINIMUM_SESSION * 60} minutes`
            });
        }

        const allDaySessions = await prisma.attendanceRecord.findMany({
            where: {
                userId: user.id,
                date: attendanceDate
            }
        });

        const totalDuration = calculateTotalDuration([
            ...allDaySessions.filter(session => session.checkOutTime),
            { checkInTime: currentSession.checkInTime, checkOutTime: checkOutDateTime }
        ]);

        const status = determineStatus(totalDuration.hours);

        const updatedSession = await prisma.attendanceRecord.update({
            where: { id: currentSession.id },
            data: {
                checkOutTime: checkOutDateTime,
                checkOutLocation,
                notes: notes ? `${currentSession.notes || ''} ${notes}`.trim() : currentSession.notes,
                status,
                duration: sessionDuration,
                ipAddress: req.ip,
                deviceInfo: req.headers['user-agent']
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

/**
 * @route GET /api/v2/attendance/sessions
 * @desc Get all sessions for a specific date
 * @access Private
 */
export const sessionListByDate = async (req, res) => {
    console.log('Starting sessionListByDate...');
    try {
        const { date } = req.params;
        console.log('Request query:', { date });
        
        if (!date) {
            console.log('Date parameter missing');
            return res.status(400).json({ message: "Date is required" });
        }
        
        const user = req.user;
        console.log('User details:', user);

        const attendanceDate = new Date(date);
        console.log('Parsed attendance date:', attendanceDate);

        const sessions = await prisma.attendanceRecord.findMany({
            where: {
                userId: user.id,
                date: attendanceDate
            },
            orderBy: {
                checkInTime: 'asc'
            }
        });
        console.log('Retrieved sessions:', sessions);

        res.status(200).json(sessions);
    } catch (error) {
        console.error("Error in sessionListByDate:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

/**
 * @route GET /api/v2/attendance/employees
 * @desc Get attendance records for all employees
 * @access Private (Admin only)
 */
export const getEmployeeAttendance = async (req, res) => {
    try {
        const employeeList = await prisma.user.findMany({
            include: {
                attendanceRecords: true,
                roles: {
                    include: {
                        role: true
                    }
                }
            }
        });

        res.status(200).json(employeeList);
    } catch (error) {
        console.error("Error in getEmployeeAttendance:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// Helper functions
const getNextSessionNumber = async (userId, date) => {
    const sessions = await prisma.attendanceRecord.findMany({
        where: { userId, date },
        orderBy: { sessionNumber: 'desc' },
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
    }
    return 'ABSENT';
};
export const getUserAttendance = async(req, res) => {
    const {id} = req.params;
    try {
        if(!id){
            return res.status(400).json({error:"User id is required"})
        }
        const attendance = await prisma.attendanceRecord.findMany({
            where: {
                userId: id,
                // checkInTime: { not: null },
                checkOutTime: { not: null }
            }
        });
        res.status(200).json(attendance);
    } catch (error) {
        console.log(error)
        res.status(500).json({error:"Failed to fetch user attendance"})
    }
}

export const getEmployeeRecords = async(req, res) => {
    const {managerId} = req.params
    try {
        const rawdata = await prisma.user.findMany({
            where: {
                managerId: managerId
            },
            select: {
                attendanceRecords: {
                    include:{
                        user:{
                            select:{
                                firstName:true,
                                lastName:true,
                                email:true,
                                department:{
                                    select:{
                                        name:true
                                    }
                                },
                                roles:{
                                    select:{
                                        role:{
                                            select:{
                                                name:true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        rawdata.forEach(employees=>{
            employees.attendanceRecords.forEach(records=>{
                console.log(records.user);
                
                records.user = {
                    name: `${records?.user?.firstName} ${records?.user?.lastName}`,
                    email: records?.user?.email,
                    department: records?.user?.department?.name,
                    role: records?.user?.roles[0]?.role?.name,
                }
            })
        })
        const HalfpreparedData = rawdata.map(data=>data.attendanceRecords)
        const preparedData = HalfpreparedData.flat()
        res.status(200).json(preparedData)

    } catch (error) {
        console.log(error)
        res.status(500).json({error:"Failed to fetch employee records"})
    }
}
export const verifyAttendance = async(req, res) => {
    const {userId,attendanceId,verificationStatus} = req.body
    try {
        const attendance = await prisma.attendanceRecord.update({
            where:{
                id:attendanceId
            },
            data:{
                verificationStatus
            }
        })
        res.status(200).json(attendance)
    } catch (error) {
        console.log(error)
        res.status(500).json({error:"Failed to verify attendance"})
    }
}
export const getTodaysAttendance = async(req, res) => {
    try {
        const {managerId} = req.params
        // Get today's date (start and end)
        const today = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay = new Date(today.setHours(23, 59, 59, 999));

        // Get all users with their attendance records for today
        const users = await prisma.user.findMany({
            where: {
                // Optionally filter by organization if needed
                // orgId: req.user.orgId,
                status: 'active',
                managerId
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                department: {
                    select: {
                        name: true
                    }
                },
                roles: {
                    select: {
                        role: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                attendanceRecords: {
                    where: {
                        date: {
                            gte: startOfDay,
                            lte: endOfDay
                        }
                    },
                    orderBy: {
                        sessionNumber: 'asc'
                    }
                }
            }
        });

        // Transform the data to match frontend expectations
        const formattedData = users.map(user => {
            // Basic user info
            const userInfo = {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email,
                department: user.department?.name || 'Unassigned',
                position: user.roles[0]?.role?.name || 'Unknown'
            };

            // Format attendance records
            const records = user.attendanceRecords.map(record => ({
                id: record.id,
                userId: record.userId,
                date: record.date,
                sessionNumber: record.sessionNumber,
                checkInTime: record.checkInTime,
                checkOutTime: record.checkOutTime || undefined,
                checkInLocation: record.checkInLocation,
                checkOutLocation: record.checkOutLocation || undefined,
                status: record.status,
                notes: record.notes,
                duration: record.duration,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                deviceInfo: record.deviceInfo,
                ipAddress: record.ipAddress,
                verificationStatus: record.verificationStatus
            }));

            return {
                user: userInfo,
                records
            };
        });

        // Group records by user ID for easier frontend consumption
        const groupedRecords = formattedData.reduce((acc, { user, records }) => {
            acc[user.id] = records;
            return acc;
        }, {});

        res.status(200).json({
            users: formattedData.map(item => item.user),
            attendanceRecords: groupedRecords
        });

    } catch (error) {
        console.error("Error in getTodaysAttendance:", error);
        res.status(500).json({ 
            error: "Failed to fetch today's attendance records",
            details: error.message 
        });
    }
}