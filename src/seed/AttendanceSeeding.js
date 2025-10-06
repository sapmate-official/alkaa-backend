import { fileURLToPath } from 'url';
import path from 'path';
import prisma from '../db/connectDb.js';
import { format, addDays, isBefore, isSameDay } from 'date-fns';

/**
 * Seeds attendance records for a user for specified date range.
 * @param {Object} params
 * @param {string} params.userId
 * @param {Date} params.startDate
 * @param {Date} [params.endDate]
 * @param {number} params.latitude
 * @param {number} params.longitude
 * @param {string} [params.checkInTime]
 * @param {string} [params.checkOutTime]
 * @param {string} [params.notes]
 * @param {boolean} [params.skipWeekends]
 * @param {string[]} [params.defaultTasks]
 */
export async function seedPastAttendance({
  userId,
  startDate,
  endDate,
  latitude,
  longitude,
  checkInTime = "09:00",
  checkOutTime = "17:00",
  notes,
  skipWeekends = true,
  defaultTasks = ["Completed assigned tasks", "Team meeting", "Documentation"]
}) {
  let weekendDays = [0, 6]; // Default: Sunday, Saturday

  if (skipWeekends) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true }
      });
      if (user) {
        const orgSettings = await prisma.organizationSettings.findFirst({
          where: { orgId: user.orgId },
          select: { settings: true }
        });
        if (orgSettings?.settings?.weekendDays) {
          weekendDays = orgSettings.settings.weekendDays;
          console.log(`Using organization-specific weekend days: ${weekendDays.join(', ')}`);
        }
      }
    } catch (error) {
      console.warn("Could not fetch organization weekend settings, using default weekend days:", error.message);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seedEndDate = endDate || new Date(today.getTime() - 24 * 60 * 60 * 1000); // Yesterday

  // Allow same start and end date for single day seeding
  if (isBefore(seedEndDate, startDate) && !isSameDay(startDate, seedEndDate)) {
    console.error("End date must be after or equal to start date");
    return;
  }

  const locationData = { latitude, longitude };
  let currentDate = new Date(startDate);

  // Handle single day case
  const shouldContinue = isSameDay(startDate, seedEndDate) 
    ? () => isSameDay(currentDate, startDate)
    : () => isBefore(currentDate, seedEndDate) || isSameDay(currentDate, seedEndDate);

  while (shouldContinue()) {
    const dayOfWeek = currentDate.getDay();
    if (skipWeekends && weekendDays.includes(dayOfWeek)) {
      if (isSameDay(startDate, seedEndDate)) break; // Don't skip single day even if weekend
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const attendanceDate = new Date(currentDate);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check for existing record
    try {
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          userId_date_sessionNumber: {
            userId,
            date: attendanceDate,
            sessionNumber: 1
          }
        }
      });

      if (existingRecord) {
        console.log(`⚠ Skipping ${formattedDate} (already exists)`);
        if (isSameDay(startDate, seedEndDate)) break;
        currentDate = addDays(currentDate, 1);
        continue;
      }
    } catch (error) {
      console.error(`Error checking existing record for ${formattedDate}:`, error.message);
      if (isSameDay(startDate, seedEndDate)) break;
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const [checkInHours, checkInMinutes] = checkInTime.split(':');
    const checkInDateTime = new Date(attendanceDate);
    checkInDateTime.setHours(parseInt(checkInHours, 10), parseInt(checkInMinutes, 10), 0);

    const [checkOutHours, checkOutMinutes] = checkOutTime.split(':');
    const checkOutDateTime = new Date(attendanceDate);
    checkOutDateTime.setHours(parseInt(checkOutHours, 10), parseInt(checkOutMinutes, 10), 0);

    const durationMs = Math.max(0, checkOutDateTime.getTime() - checkInDateTime.getTime());
    const totalMinutes = Math.round(durationMs / (1000 * 60));
    const sessionDuration = {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      totalMinutes
    };

    let status = 'PRESENT';
    if (sessionDuration.totalMinutes < 480) {
      status = sessionDuration.totalMinutes >= 240 ? 'HALF_DAY' : 'EARLY_DEPARTURE';
    }

    const reportData = {};
    defaultTasks.forEach((task, index) => {
      reportData[`Task ${index + 1}`] = task;
    });

    try {
      const attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          userId,
          date: attendanceDate,
          sessionNumber: 1,
          checkInTime: checkInDateTime,
          checkOutTime: checkOutDateTime,
          checkInLocation: locationData,
          checkOutLocation: locationData,
          status,
          notes: notes || `Backfilled attendance for ${formattedDate}`,
          duration: sessionDuration,
          ipAddress: "127.0.0.1",
          deviceInfo: "Seeding Script",
          verificationStatus: "VERIFIED"
        }
      });

      await prisma.userDailyReport.create({
        data: {
          attendanceId: attendanceRecord.id,
          reportContent: reportData
        }
      });

      console.log(`✓ Created attendance for ${formattedDate}`);
    } catch (error) {
      console.error(`✗ Failed for ${formattedDate}: ${error.message}`);
    }

    if (isSameDay(startDate, seedEndDate)) break;
    currentDate = addDays(currentDate, 1);
  }
}


await seedPastAttendance({
  userId: 'cme1mypsa00cqr4vbfs90opd3',
  startDate: new Date('2025-09-16'),
  endDate: new Date('2025-09-26'),
  latitude: 13.1011629,
  longitude: 77.6318278
});