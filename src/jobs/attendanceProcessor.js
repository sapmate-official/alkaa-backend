import prisma from "../db/connectDb.js";
import { sendCheckoutReminderEmail } from "../util/sendEmail.js";

/**
 * Checks for employees who have checked in but not checked out for more than 8 hours
 * and sends them reminder emails
 */
export const checkMissingCheckouts = async () => {
  try {
    console.log('Starting missing checkout check...');
    
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - (8 * 60 * 60 * 1000)); // 8 hours ago
    
    // Find attendance records for today where:
    // 1. There is a check-in time
    // 2. There is no check-out time
    // 3. The check-in time is more than 8 hours ago
    const attendanceWithoutCheckout = await prisma.attendanceRecord.findMany({
      where: {
        date: {
          // Today's date (without time component)
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
        },
        checkInTime: {
          lt: cutoffTime // Check-in time is more than 8 hours ago
        },
        checkOutTime: null // No check-out time
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            managerId: true,
            orgId: true
          }
        }
      }
    });
    
    console.log(`Found ${attendanceWithoutCheckout.length} employees without checkout`);
    
    // Process each attendance record and send email
    for (const attendance of attendanceWithoutCheckout) {
      try {
        // Get employee details
        const { user } = attendance;
        const employeeName = `${user.firstName} ${user.lastName}`;
        
        // Get organization name
        const organization = await prisma.organization.findUnique({
          where: { id: user.orgId },
          select: { name: true }
        });
        
        // Get manager email
        let managerEmail = null;
        if (user.managerId) {
          const manager = await prisma.user.findUnique({
            where: { id: user.managerId },
            select: { email: true }
          });
          if (manager) {
            managerEmail = manager.email;
          }
        }
        
        // Send reminder email
        await sendCheckoutReminderEmail(
          user.email,
          employeeName,
          attendance.checkInTime,
          organization.name,
          managerEmail
        );
        
        console.log(`Sent checkout reminder to ${employeeName} (${user.email})`);
      } catch (emailError) {
        console.error(`Failed to send reminder for user ${attendance.userId}:`, emailError);
      }
    }
    
    console.log('Completed missing checkout check');
  } catch (error) {
    console.error('Error in missing checkout processor:', error);
  }
};

// If this script is called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
  checkMissingCheckouts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error in attendance processor:', error);
      process.exit(1);
    });
}
