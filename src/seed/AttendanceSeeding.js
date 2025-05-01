import { fileURLToPath } from 'url';
import path from 'path';
import prisma from '../db/connectDb.js';
import { format, addDays, isBefore } from 'date-fns';

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
  let weekendDays = [5]; // Default: Sunday, Saturday

  if (skipWeekends) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true }
      });
      if (user) {
        const orgSettings = await prisma.organizationSettings.findFirst({
          where: { orgId: user.orgId }
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
  const seedEndDate = endDate || new Date(today.setDate(today.getDate() - 1));

  if (isBefore(seedEndDate, startDate)) {
    console.error("End date must be after start date");
    return;
  }

  const locationString = `${latitude},${longitude}`;
  let currentDate = new Date(startDate);

  while (isBefore(currentDate, seedEndDate) || currentDate.getTime() === seedEndDate.getTime()) {
    const dayOfWeek = currentDate.getDay();
    if (skipWeekends && weekendDays.includes(dayOfWeek)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const [checkInHours, checkInMinutes] = checkInTime.split(':');
    const checkInDateTime = new Date(currentDate);
    checkInDateTime.setHours(parseInt(checkInHours, 10), parseInt(checkInMinutes, 10), 0);

    const [checkOutHours, checkOutMinutes] = checkOutTime.split(':');
    const checkOutDateTime = new Date(currentDate);
    checkOutDateTime.setHours(parseInt(checkOutHours, 10), parseInt(checkOutMinutes, 10), 0);

    const durationMs = checkOutDateTime.getTime() - checkInDateTime.getTime();
    const hours = durationMs / (1000 * 60 * 60);
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const sessionDuration = {
      hours,
      minutes,
      totalMinutes: Math.floor(hours * 60 + minutes)
    };

    let status = 'PRESENT';
    if (hours < 8) {
      status = hours >= 4 ? 'HALF_DAY' : 'EARLY_DEPARTURE';
    }

    const reportData = {};
    defaultTasks.forEach((task, index) => {
      reportData[`Task ${index + 1}`] = task;
    });

    try {
      const attendanceRecord = await prisma.attendanceRecord.create({
        data: {
          userId,
          date: new Date(formattedDate),
          sessionNumber: 1,
          checkInTime: checkInDateTime,
          checkOutTime: checkOutDateTime,
          checkInLocation: locationString,
          checkOutLocation: locationString,
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

    currentDate = addDays(currentDate, 1);
  }
}


await seedPastAttendance({
  userId: 'cm7ur350j0042p8ujvrk4jlfv',
  startDate: new Date('2025-04-01'),
  endDate: new Date('2025-04-30'),
  latitude: 22.599190906390163,
  longitude: 88.29336005463968
});