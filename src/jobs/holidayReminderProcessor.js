import { fileURLToPath } from 'url';

import prisma from '../db/connectDb.js';
import { UserStatus } from '@prisma/client';
import { sendHolidayReminderEmail } from '../util/sendEmail.js';

const DEFAULT_LEAD_DAYS = 1;
const DEFAULT_BATCH_SIZE = 50;

const getEnvNumber = (envKey, fallback) => {
  const value = process.env[envKey];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const chunkArray = (items, chunkSize) => {
  if (chunkSize <= 0) return [items];
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
};

const buildHolidayEmailPayload = (holiday) => ({
  name: holiday.name,
  date: holiday.date,
  description: holiday.description,
  isOptional: holiday.isOptional,
});

const getTargetDateRange = (leadDays) => {
  const now = new Date();
  const targetDateUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + leadDays
  ));

  const startOfDayUTC = new Date(targetDateUTC);
  const endOfDayUTC = new Date(startOfDayUTC);
  endOfDayUTC.setUTCDate(endOfDayUTC.getUTCDate() + 1);

  return {
    startOfDay: startOfDayUTC,
    endOfDay: endOfDayUTC,
    targetDate: targetDateUTC,
  };
};

export const sendUpcomingHolidayReminders = async () => {
  const reminderLeadDays = getEnvNumber('HOLIDAY_REMINDER_LEAD_DAYS', DEFAULT_LEAD_DAYS);
  const emailBatchSize = getEnvNumber('HOLIDAY_EMAIL_BATCH_SIZE', DEFAULT_BATCH_SIZE);

  const { startOfDay, endOfDay, targetDate } = getTargetDateRange(reminderLeadDays);

  console.log(
    `Holiday Reminder Job: target date ${targetDate.toISOString()} | window ${startOfDay.toISOString()} -> ${endOfDay.toISOString()}`
  );

  const upcomingHolidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(`Holiday Reminder Job: found ${upcomingHolidays.length} upcoming holiday(s)`);

  if (!upcomingHolidays.length) {
    console.log('Holiday Reminder Job: no upcoming holidays found in the target window');
    return {
      processedHolidays: 0,
      emailsQueued: 0,
    };
  }

  let processedHolidays = 0;
  let emailsQueued = 0;

  for (const holiday of upcomingHolidays) {
    try {
      const organizationName = holiday.organization?.name || 'Alkaa';
      console.log(
        `Holiday Reminder Job: processing holiday ${holiday.name} (${holiday.id}) for organization ${organizationName}`
      );

      const activeEmployees = await prisma.user.findMany({
        where: {
          orgId: holiday.orgId,
          status: UserStatus.active,
        },
        select: {
          email: true,
        },
      });

      const recipientEmails = activeEmployees
        .map((user) => user.email)
  .filter((email) => typeof email === 'string' && email.trim().length > 0);

      console.log(
        `Holiday Reminder Job: ${recipientEmails.length} active recipient(s) identified for organization ${organizationName}`
      );

      if (!recipientEmails.length) {
        console.log(
          `Holiday Reminder Job: no active employee emails found for organization ${organizationName} (${holiday.orgId})`
        );
        processedHolidays += 1;
        continue;
      }

      const emailPayload = buildHolidayEmailPayload(holiday);
      const emailChunks = chunkArray(recipientEmails, emailBatchSize);

      for (const chunk of emailChunks) {
        await sendHolidayReminderEmail(chunk, emailPayload, organizationName, reminderLeadDays);
        emailsQueued += chunk.length;
        console.log(
          `Holiday Reminder Job: queued holiday reminder for ${chunk.length} recipients in organization ${organizationName}`
        );
      }

      processedHolidays += 1;
    } catch (holidayError) {
      console.error(
        `Holiday Reminder Job: failed to process holiday ${holiday.id} for org ${holiday.orgId}:`,
        holidayError
      );
    }
  }

  console.log(
    `Holiday Reminder Job: completed with ${processedHolidays} holidays processed and ${emailsQueued} recipient emails queued.`
  );

  return {
    processedHolidays,
    emailsQueued,
  };
};

// Allow manual invocation when running this file directly
const currentFilePath = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFilePath) {
  sendUpcomingHolidayReminders()
    .then((result) => {
      console.log('Holiday Reminder Job finished:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Holiday Reminder Job encountered a fatal error:', error);
      process.exit(1);
    });
}
