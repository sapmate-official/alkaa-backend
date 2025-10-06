import prisma from "../../../db/connectDb.js";
import { sendAttendanceVerificationEmail } from "../../../util/sendEmail.js";

const WORKING_HOURS = {
    FULL_DAY: 8,
    HALF_DAY: 4,
    MINIMUM_SESSION: 0.0, // 30 minutes minimum per session
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
        // Get user's hiring date for validation
        const userDetails = await prisma.user.findUnique({
            where: { id: userId },
            select: { hiredDate: true }
        });
        
        const attendanceDate = new Date(date);
        
        // Validate attendance date is not before hiring date
        if (userDetails && userDetails.hiredDate && attendanceDate < new Date(userDetails.hiredDate)) {
            return res.status(400).json({ 
                error: "Cannot create attendance for a date before the user's hiring date",
                hiredDate: userDetails.hiredDate.toISOString().split('T')[0],
                attemptedDate: attendanceDate.toISOString().split('T')[0]
            });
        }
        
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
                ipAddress: req.ip,
                deviceInfo: req.headers['user-agent'],
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
                ipAddress: req.ip,
                deviceInfo: req.headers['user-agent']
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
        const { date, checkInTime, checkInLocation, notes, clientTimestamp, clientTimezone } = req.body;
        console.log('Request body:', { date, checkInTime, checkInLocation, notes, clientTimestamp, clientTimezone });
        
        if (!date || !checkInTime || !checkInLocation) {
            console.log('Missing required fields:', { date, checkInTime, checkInLocation });
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        console.log('User details:', user);
        
        // Get user's hiring date for validation
        const userDetails = await prisma.user.findUnique({
            where: { id: user.id },
            select: { hiredDate: true }
        });
        
        // Use client-provided timestamp with timezone validation
        const checkInDateTime = new Date(checkInTime);
        const attendanceDate = new Date(date);
        const serverTime = new Date();
        
        // Validate attendance date is not before hiring date
        if (userDetails.hiredDate && attendanceDate < new Date(userDetails.hiredDate)) {
            console.log('Attendance date before hiring date:', { attendanceDate, hiredDate: userDetails.hiredDate });
            return res.status(400).json({ 
                message: "Cannot check in for a date before your hiring date",
                hiredDate: userDetails.hiredDate.toISOString().split('T')[0],
                attemptedDate: attendanceDate.toISOString().split('T')[0]
            });
        }
        
        console.log('Timestamps:', { 
            clientCheckIn: checkInDateTime, 
            clientTimezone: clientTimezone,
            attendanceDate, 
            serverTime 
        });

        // Validate that the client time is reasonable (within 24 hours of server time)
        const timeDifferenceHours = Math.abs(serverTime - checkInDateTime) / (1000 * 60 * 60);
        if (timeDifferenceHours > 24) {
            console.log('Time difference too large:', timeDifferenceHours, 'hours');
            return res.status(400).json({ 
                message: "Client time appears to be incorrect. Please check your device's time settings.",
                serverTime: serverTime.toISOString(),
                clientTime: checkInDateTime.toISOString(),
                timezoneReceived: clientTimezone
            });
        }

        if (attendanceDate > new Date(Date.now() + 24 * 60 * 60 * 1000)) { // Allow 1 day future
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
                checkInTime: checkInDateTime, // Store client timestamp as-is (already in UTC)
                checkInLocation,
                notes: `${notes || ''} | Client timezone: ${clientTimezone}`.trim(),
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
        const { checkInId, date, checkOutTime, checkOutLocation, notes, reportContent, clientTimestamp, clientTimezone } = req.body;
        
        console.log('=== CHECKOUT REQUEST RECEIVED ===');
        console.log('Request body:', req.body);
        console.log('Report content received:', reportContent);
        console.log('Client timezone:', clientTimezone);
        
        if (!date || !checkOutTime || !checkOutLocation) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        
        // Get user's hiring date for validation
        const userDetails = await prisma.user.findUnique({
            where: { id: user.id },
            select: { hiredDate: true }
        });
        
        const checkOutDateTime = new Date(checkOutTime); // Use client timestamp
        let attendanceDate = new Date(date);
        const serverTime = new Date();
        
        // Validate attendance date is not before hiring date
        if (userDetails.hiredDate && attendanceDate < new Date(userDetails.hiredDate)) {
            console.log('Attendance date before hiring date:', { attendanceDate, hiredDate: userDetails.hiredDate });
            return res.status(400).json({ 
                message: "Cannot check out for a date before your hiring date",
                hiredDate: userDetails.hiredDate.toISOString().split('T')[0],
                attemptedDate: attendanceDate.toISOString().split('T')[0]
            });
        }

        console.log('Parsed dates:', {
            originalDate: date,
            attendanceDate: attendanceDate,
            checkOutDateTime: checkOutDateTime,
            userId: user.id
        });

        // Validate that the client time is reasonable
        const timeDifferenceHours = Math.abs(serverTime - checkOutDateTime) / (1000 * 60 * 60);
        if (timeDifferenceHours > 24) {
            return res.status(400).json({ 
                message: "Client time appears to be incorrect. Please check your device's time settings.",
                serverTime: serverTime.toISOString(),
                clientTime: checkOutDateTime.toISOString(),
                timezoneReceived: clientTimezone
            });
        }

        // First, let's find all sessions for this user to debug
        const allUserSessions = await prisma.attendanceRecord.findMany({
            where: {
                userId: user.id
            },
            orderBy: {
                date: 'desc'
            },
            take: 5
        });

        console.log('Recent user sessions:', allUserSessions);

        const currentSession = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                date: attendanceDate,
                checkOutTime: null
            }
        });

        console.log('Found current session:', currentSession);

        let anyActiveSession = null;
        
        if (!currentSession) {
            // Try to find any active session for today without strict date matching
            anyActiveSession = await prisma.attendanceRecord.findFirst({
                where: {
                    userId: user.id,
                    checkOutTime: null
                },
                orderBy: {
                    checkInTime: 'desc'
                }
            });

            console.log('Any active session found:', anyActiveSession);

            if (!anyActiveSession) {
                return res.status(400).json({ 
                    message: "No active work session found. Please check in first or contact support.",
                    debug: {
                        userId: user.id,
                        searchDate: attendanceDate,
                        recentSessions: allUserSessions.length
                    }
                });
            } else {
                // Use the active session found
                console.log('Using any active session:', anyActiveSession.id);
                // Update the attendanceDate to match the active session
                attendanceDate = new Date(anyActiveSession.date);
            }
        }

        // Use the session we found (either currentSession or anyActiveSession)
        const sessionToUpdate = currentSession || anyActiveSession;

        if (checkOutDateTime <= new Date(sessionToUpdate.checkInTime)) {
            return res.status(400).json({ message: "Check-out time must be after check-in time" });
        }

        const sessionDuration = calculateSessionDuration(sessionToUpdate.checkInTime, checkOutDateTime);
        
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
            { checkInTime: sessionToUpdate.checkInTime, checkOutTime: checkOutDateTime }
        ]);

        const status = determineStatus(totalDuration.hours);

        const updatedSession = await prisma.attendanceRecord.update({
            where: { id: sessionToUpdate.id },
            data: {
                checkOutTime: checkOutDateTime, // Store client timestamp as-is (already in UTC)
                checkOutLocation,
                notes: notes ? `${sessionToUpdate.notes || ''} ${notes} | Client timezone: ${clientTimezone}`.trim() : `${sessionToUpdate.notes || ''} | Client timezone: ${clientTimezone}`.trim(),
                status,
                duration: sessionDuration,
                ipAddress: req.ip,
                deviceInfo: req.headers['user-agent']
            }
        });
        
        console.log('Creating daily report with content:', reportContent);
        
        let report;
        try {
            report = await prisma.userDailyReport.create({
                data: {
                    reportContent,
                    attendanceId: updatedSession.id
                }
            });
            console.log('Daily report created successfully:', report);
        } catch (reportError) {
            console.error('Error creating daily report:', reportError);
        }

        let userData = await prisma.user.findUnique({
            where: {
                id: user.id
            },
            select: {
                firstName: true,
                lastName: true,
                managerId: true,
                manager:{
                    select:{
                        email:true
                    }
                },
                email: true,
                organization:{
                    select:{
                        name:true,
                        Organization_admin:{
                            select:{
                                admin_user:{
                                    select:{
                                        email:true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        const employeename = `${userData.firstName} ${userData.lastName}`;
        
        // Check if manager and organization admin exist before sending email
        const managerEmail = userData.manager?.email;
        const organizationAdminEmail = userData.organization?.Organization_admin?.[0]?.admin_user?.email;
        const organizationName = userData.organization?.name;
        
        console.log('Email details:', {
            managerEmail,
            organizationAdminEmail,
            employeename,
            userEmail: userData.email,
            organizationName
        });
        
        // Only send email if we have the required email addresses
        if (managerEmail && organizationAdminEmail && organizationName) {
            try {
                await sendAttendanceVerificationEmail(
                    managerEmail,
                    organizationAdminEmail,
                    employeename,
                    userData.email,
                    {
                        id: updatedSession.id,
                        date: updatedSession.date,
                        checkInTime: updatedSession.checkInTime,
                        checkOutTime: updatedSession.checkOutTime,
                        sessionNumber: updatedSession.sessionNumber,
                        status: updatedSession.status
                    },
                    organizationName
                );
                console.log('Attendance verification email sent successfully');
            } catch (emailError) {
                console.error('Failed to send attendance verification email:', emailError);
                // Continue execution even if email fails
            }
        } else {
            console.log('Skipping email notification - missing required email addresses or organization info');
        }

        console.log('Checkout process completed successfully');
        res.status(200).json({
            session: updatedSession,
            dailyTotal: totalDuration,
            remainingHours: Math.max(0, WORKING_HOURS.TARGET_DAILY_HOURS - totalDuration.hours),
            reportCreated: !!report
        });
    } catch (error) {
        console.error("Error in checkOut:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


export const getUserAttendance = async(req, res) => {
    const {id} = req.params;
    try {
        if(!id){
            return res.status(400).json({error:"User id is required"})
        }

        // If the requested user ID is not the current user's ID, check permissions
        if (id !== req.user.id) {
            // Check if user has necessary permissions
            const userWithRoles = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: {
                    roles: {
                        include: {
                            role: {
                                include: {
                                    permissions: {
                                        include: {
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // Check for view_all_user_attendance permission
            const hasViewAllPermission = userWithRoles?.roles.some(userRole => 
                userRole.role.permissions.some(permission => 
                    permission.permission.key === 'view_all_user_attendance'
                )
            );

            // Check for view_subordinates_attendance permission
            const hasViewSubordinatesPermission = userWithRoles?.roles.some(userRole => 
                userRole.role.permissions.some(permission => 
                    permission.permission.key === 'view_subordinates_attendance'
                )
            );

            // If user has view_all_user_attendance permission, they can view any user's attendance
            if (hasViewAllPermission) {
                // Allow access
            } 
            // If user has view_subordinates_attendance permission, check if the requested user is a subordinate
            else if (hasViewSubordinatesPermission) {
                // Check if the requested user is a subordinate of the current user
                const isSubordinate = await prisma.user.findFirst({
                    where: {
                        id: id,
                        managerId: req.user.id
                    }
                });

                if (!isSubordinate) {
                    return res.status(403).json({error:"Access denied. You can only view your own or your subordinates' attendance records."});
                }
            } else {
                // User doesn't have permissions to view other users' attendance
                return res.status(403).json({error:"Access denied. You can only view your own attendance records."});
            }
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
                        },
                        UserDailyReport: true  // Include the daily reports
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
export const getCheckOutPast = async(req, res) => {
    try {
        const userId = req.user.id;
        const data = await prisma.attendanceRecord.findMany({
            where: {
                userId,
                checkOutTime: null,
                date: {
                    lt: new Date() // Only get past sessions
                }
            },
            orderBy: {
                date: 'desc'
            }
        });
        
        res.status(200).json(data);
        
    } catch (error) {
        console.error("Error in getCheckOutPast:", error);
        res.status(500).json({
            error: "Failed to fetch past unchecked sessions",
            details: error.message
        });
    }
};

export const postPastCheckOut = async(req, res) => {
    try {
        const { attendanceId, checkOutTime, notes, clientTimestamp, clientTimezone } = req.body;
        const userId = req.user.id;
        console.log('Request body:', { attendanceId, checkOutTime, notes, clientTimestamp, clientTimezone });
        
        // Validate the attendance record belongs to the user
        const attendance = await prisma.attendanceRecord.findFirst({
            where: {
                id: attendanceId,
                userId
            }
        });

        if (!attendance) {
            return res.status(404).json({ error: "Attendance record not found" });
        }

        const checkOutDateTime = new Date(checkOutTime); // Use client timestamp
        const checkInDateTime = new Date(attendance.checkInTime);
        const serverTime = new Date();

        // Validate that the client time is reasonable
        const timeDifferenceHours = Math.abs(serverTime - checkOutDateTime) / (1000 * 60 * 60);
        if (timeDifferenceHours > 168) { // Allow 1 week difference for past entries
            return res.status(400).json({ 
                error: "Client time appears to be incorrect. Please check your device's time settings.",
                serverTime: serverTime.toISOString(),
                clientTime: checkOutDateTime.toISOString(),
                timezoneReceived: clientTimezone
            });
        }

        if (checkOutDateTime <= checkInDateTime) {
            return res.status(400).json({ 
                error: "Check-out time must be after check-in time" 
            });
        }

        const sessionDuration = calculateSessionDuration(attendance.checkInTime, checkOutDateTime);
        
        const updated = await prisma.attendanceRecord.update({
            where: {
                id: attendanceId
            },
            data: {
                checkOutTime: checkOutDateTime, // Store client timestamp as-is (already in UTC)
                notes: notes ? `${attendance.notes || ''} | Late checkout reason: ${notes} | Client timezone: ${clientTimezone}`.trim() : `${attendance.notes || ''} | Client timezone: ${clientTimezone}`.trim(),
                duration: sessionDuration,
                status: determineStatus(sessionDuration.hours)
            }
        });

        res.status(200).json(updated);
    } catch (error) {
        console.error("Error in postPastCheckOut:", error);
        res.status(500).json({
            error: "Failed to update past session",
            details: error.message
        });
    }
};

/**
 * @route POST /api/v2/attendance/past-attendance
 * @desc Create a complete attendance record for a past day
 * @access Private
 */
export const createPastAttendance = async (req, res) => {
    try {
        const { 
            date, 
            checkInTime, 
            checkInLocation, 
            checkOutTime, 
            checkOutLocation, 
            notes,
            reportContent,
            clientTimestamp,
            clientTimezone
        } = req.body;
        
        console.log('=== PAST ATTENDANCE REQUEST RECEIVED ===');
        console.log('Request body:', req.body);
        
        if (!date || !checkInTime || !checkInLocation || !checkOutTime || !checkOutLocation) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const user = req.user;
        
        // Get user's hiring date for validation
        const userDetails = await prisma.user.findUnique({
            where: { id: user.id },
            select: { hiredDate: true }
        });
        
        const checkInDateTime = new Date(checkInTime); // Use client timestamp
        const checkOutDateTime = new Date(checkOutTime); // Use client timestamp
        const attendanceDate = new Date(date);
        const serverTime = new Date();
        
        // Validate attendance date is not before hiring date
        if (userDetails.hiredDate && attendanceDate < new Date(userDetails.hiredDate)) {
            console.log('Past attendance date before hiring date:', { attendanceDate, hiredDate: userDetails.hiredDate });
            return res.status(400).json({ 
                message: "Cannot create attendance for a date before your hiring date",
                hiredDate: userDetails.hiredDate.toISOString().split('T')[0],
                attemptedDate: attendanceDate.toISOString().split('T')[0]
            });
        }
        
        // Validate that the client times are reasonable for past entries
        const checkInTimeDifference = Math.abs(serverTime - checkInDateTime) / (1000 * 60 * 60 * 24);
        const checkOutTimeDifference = Math.abs(serverTime - checkOutDateTime) / (1000 * 60 * 60 * 24);
        
        if (checkInTimeDifference > 365 || checkOutTimeDifference > 365) { // Allow up to 1 year for past entries
            return res.status(400).json({ 
                message: "Date is too far in the past. Please contact your administrator for older records.",
                serverTime: serverTime.toISOString(),
                clientCheckIn: checkInDateTime.toISOString(),
                clientCheckOut: checkOutDateTime.toISOString(),
                timezoneReceived: clientTimezone
            });
        }
        
        // Validate dates
        const currentDate = new Date();
        if (attendanceDate > currentDate) {
            return res.status(400).json({ message: "Cannot create attendance for future dates" });
        }
        if (attendanceDate == currentDate) {
            return res.status(400).json({ message: "Cannot create attendance for same-day dates" });
        }
        
        // Check if the attendance date is more than 45 days in the past
        const fortyFiveDaysAgo = new Date();
        fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
        if (attendanceDate < fortyFiveDaysAgo) {
            return res.status(400).json({ 
                message: "Cannot create attendance for dates more than 45 days in the past. Please contact your administrator for older records.",
                maxAllowedDate: fortyFiveDaysAgo.toISOString().split('T')[0],
                attemptedDate: attendanceDate.toISOString().split('T')[0]
            });
        }
        
        if (checkOutDateTime <= checkInDateTime) {
            return res.status(400).json({ message: "Check-out time must be after check-in time" });
        }

        // Check if an entry already exists for this date
        const existingSession = await prisma.attendanceRecord.findFirst({
            where: {
                userId: user.id,
                date: attendanceDate
            }
        });

        if (existingSession) {
            return res.status(400).json({ 
                message: "An attendance record already exists for this date. Please edit the existing record." 
            });
        }

        // Calculate session duration
        const sessionDuration = calculateSessionDuration(checkInDateTime, checkOutDateTime);
        const status = determineStatus(sessionDuration.hours);
        
        // Create the attendance record with client timestamps
        const newAttendance = await prisma.attendanceRecord.create({
            data: {
                userId: user.id,
                date: attendanceDate,
                checkInTime: checkInDateTime, // Store client timestamp as-is (already in UTC)
                checkOutTime: checkOutDateTime, // Store client timestamp as-is (already in UTC)
                checkInLocation,
                checkOutLocation,
                notes: `Past attendance reason: ${notes} | Client timezone: ${clientTimezone}`,
                status,
                duration: sessionDuration,
                sessionNumber: 1,
                ipAddress: req.ip,
                deviceInfo: req.headers['user-agent']
            }
        });
        
        // Create the daily report
        let report;
        try {
            if (reportContent) {
                report = await prisma.userDailyReport.create({
                    data: {
                        reportContent,
                        attendanceId: newAttendance.id
                    }
                });
                console.log('Daily report created successfully:', report);
            }
        } catch (reportError) {
            console.error('Error creating daily report:', reportError);
            // Continue even if report creation fails
        }
        const managerId = await prisma.user.findUnique({
            where:{
                id:user.id
            },
            select:{
                managerId:true
            }
        })
        const templateId = await prisma.notificationTemplate.findFirst({
            where:{
                id:"cm8yraup50001tlfobklj264q"
            }
        })
        // Format the notification content using the template
        const content = `Employee ${user.firstName} ${user.lastName} has submitted attendance for ${attendanceDate.toLocaleDateString()} (past date). Please verify this attendance record.`;

        // Check if we have a valid template and manager
        if (templateId && managerId.managerId) {
            try {
                // Create the notification in the database
                const notification = await prisma.notification.create({
                    data: {
                        userId: managerId.managerId,
                        templateId: templateId.id,
                        content: content,
                        isRead: false,
                        metadata: {
                            attendanceId: newAttendance.id,
                            employeeId: user.id,
                            type: "ATTENDANCE_VERIFICATION"
                        }
                    }
                });
                
                console.log('Notification created:', notification);
                
                // Schedule as background job for push notification delivery
                await prisma.backgroundJob.create({
                    data: {
                        type: "NOTIFICATION_DISPATCH",
                        status: "PENDING",
                        priority: 1,
                        scheduledFor: new Date(),
                        payload: {
                            notificationId: notification.id,
                            userId: managerId.managerId,
                            title: "Attendance Verification Required",
                            content: content,
                            type: "PUSH"
                        }
                    }
                });
                
                console.log('Background job created for notification dispatch');
            } catch (notificationError) {
                console.error('Error creating notification:', notificationError);
                // Continue execution even if notification fails
            }
        }

        res.status(201).json({
            attendance: newAttendance,
            reportCreated: !!report
        });
        
    } catch (error) {
        console.error("Error in createPastAttendance:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

export const getAllUserLiveAttendance = async (req, res) => {
    try {
        console.log('Fetching all users live attendance...');
        
        const userId = req.user.id;
        //check for this user has permission to view all users attendance
        const userWithRoles = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        // Check for view_all_user_attendance permission
        const hasViewAllPermission = userWithRoles?.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        if (!hasViewAllPermission) {
            return res.status(403).json({error:"Access denied. You can only view your own attendance records."});
        }
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        const currentUser = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                orgId: true
            }
        });
        if (!currentUser) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Get all active users
        const users = await prisma.user.findMany({
            where: {
                status: 'active',
                orgId: currentUser.orgId
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
        console.log(req.user.orgId);
        
        console.log("live panel : ", users)
        
        if (users.length === 0) {
            return res.status(200).json({ 
                users: [],
                attendanceRecords: {}
            });
        }
        
        // Transform user data to match frontend expectations
        const formattedUsers = users.map(user => ({
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            email: user.email,
            department: user.department?.name || 'Unassigned',
            position: user.roles[0]?.role?.name || 'Unknown',
            avatarUrl: user.avatarUrl
        }));
        
        // Group attendance records by user ID
        const attendanceRecords = users.reduce((acc, user) => {
            if (user.attendanceRecords.length > 0) {
                acc[user.id] = user.attendanceRecords.map(record => ({
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
            } else {
                acc[user.id] = [];
            }
            return acc;
        }, {});
        
        console.log(`Found ${formattedUsers.length} users with attendance records`);
        
        res.status(200).json({
            users: formattedUsers,
            attendanceRecords
        });

    } catch (error) {
            console.error('Error fetching attendance:', error);
            res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
};

export const getAdminVerificationRecords = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        
        // Check if user has permission to view all user attendance records
        const userWithRoles = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Check for view_all_user_attendance permission
        const hasViewAllPermission = userWithRoles?.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        if (!hasViewAllPermission) {
            return res.status(403).json({ 
                error: "Access denied. You don't have permission to view all attendance records." 
            });
        }
        
        // Get all attendance records for all users in the organization
        const records = await prisma.attendanceRecord.findMany({
            where: {
                user: {
                    orgId: userWithRoles.orgId
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,  // Changed from name to firstName
                        lastName: true,   // Added lastName
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
                        }
                    }
                },
                UserDailyReport: true
            },
            orderBy: {
                date: 'desc'
            }
        });

        // Format the records as needed
        const formattedRecords = records.map(record => ({
            ...record,
            user: {
                id: record.user.id,
                name: `${record.user.firstName || ''} ${record.user.lastName || ''}`.trim(),
                email: record.user.email,
                department: record.user.department?.name,
                position: record.user.roles[0]?.role?.name
            }
        }));

        res.status(200).json(formattedRecords);
    } catch (error) {
        console.error("Failed to fetch admin verification records:", error);
        res.status(500).json({ 
            error: "Failed to fetch attendance records",
            details: error.message
        });
    }
};

export const adminVerifyAttendance = async (req, res) => {
    try {
        const { userId, attendanceId, verificationStatus } = req.body;
        
        // Check if user has permission to verify all attendances
        const userWithRoles = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: {
                    include: {
                        role: {
                            include: {
                                permissions: {
                                    include: {
                                        permission: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Check for view_all_user_attendance permission
        const hasViewAllPermission = userWithRoles?.roles.some(userRole => 
            userRole.role.permissions.some(permission => 
                permission.permission.key === 'view_all_user_attendance'
            )
        );

        if (!hasViewAllPermission) {
            return res.status(403).json({ 
                error: "Access denied. You don't have permission to verify all attendance records." 
            });
        }
        
        const attendance = await prisma.attendanceRecord.update({
            where: {
                id: attendanceId
            },
            data: {
                verificationStatus
            }
        });
        
        res.status(200).json(attendance);
    } catch (error) {
        console.error("Failed to verify attendance:", error);
        res.status(500).json({ 
            error: "Failed to verify attendance", 
            details: error.message 
        });
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