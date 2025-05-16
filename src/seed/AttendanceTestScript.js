import prisma from "../db/connectDb.js";
import { format, addDays, isBefore, isEqual } from 'date-fns';

/**
 * Seeds attendance and leave records for April 2025
 */
async function seedAprilAttendance() {
  try {
    console.log('Starting April attendance and leave test data generation...');
    
    const userId = "cmapp007r0013tgl7z8s15gvl";
    const leaveTypeId = "cmapqextd0001tg2of3xyq6yo"; // Using the specific leave type ID
    const year = 2025;
    const month = 3; // April
    
    // First, let's verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { organization: true }
    });
    
    if (!user) {
      console.error(`User with ID ${userId} not found!`);
      return;
    }
    
    console.log(`Creating test data for user: ${user.firstName} ${user.lastName}`);
    
    // Get organization settings to check weekoff days
    const orgSettings = await prisma.organizationSettings.findFirst({
      where: { orgId: user.orgId }
    });
    
    if (!orgSettings || !orgSettings.settings || !orgSettings.settings.weekoff) {
      console.error('Organization settings not found or weekoff not configured!');
      return;
    }
    
    const weekoffDays = orgSettings.settings.weekoff;
    console.log(`Using existing organization weekoff days: ${weekoffDays.join(', ')}`);
    
    // Define our 3 paid leave days (avoiding weekoffs)
    const leaveDays = [
      new Date(year, month - 1, 7),  // April 7, 2025 (Monday)
      new Date(year, month - 1, 15), // April 15, 2025 (Tuesday)
      new Date(year, month - 1, 23)  // April 23, 2025 (Wednesday)
    ];

    // Create individual leave request for each day
    const leaveRequests = [];
    for (const leaveDay of leaveDays) {
      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          userId,
          leaveTypeId,
          startDate: leaveDay,
          endDate: leaveDay, // Same as start date for single day
          status: 'APPROVED',
          reason: `Test leave for ${format(leaveDay, 'MMM d, yyyy')}`,
          numberOfDays: 1, // Single day leave
          approvedAt: new Date(),
          approvedBy: userId // Self-approved for testing
        }
      });
      
      leaveRequests.push(leaveRequest);
      console.log(`Created leave request: ${leaveRequest.id} for ${format(leaveDay, 'MMM d, yyyy')}`);
    }

    // Update leave balance
    let leaveBalance = await prisma.leaveBalance.findFirst({
      where: {
        userId,
        leaveTypeId,
        year
      }
    });
    
    if (leaveBalance) {
      await prisma.leaveBalance.update({
        where: { id: leaveBalance.id },
        data: {
          usedDays: leaveBalance.usedDays + 3,
          remainingDays: leaveBalance.remainingDays - 3
        }
      });
      console.log('Updated leave balance.');
    } else {
      console.log('No leave balance found. Skipping balance update.');
    }
    
    // Now create attendance records for April (skipping weekoffs and leave days)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of April
    
    let currentDate = new Date(startDate);
    
    console.log('Creating attendance records for April...');
    
    while (isBefore(currentDate, endDate) || isEqual(currentDate, endDate)) {
      const dayOfWeek = currentDate.getDay();
      const formattedDate = format(currentDate, 'yyyy-MM-dd');
      
      // Skip if it's a weekoff day
      if (weekoffDays.includes(dayOfWeek)) {
        console.log(`Skipping ${formattedDate} (Day ${dayOfWeek} - weekoff day)`);
        currentDate = addDays(currentDate, 1);
        continue;
      }
      
      // Skip if it's one of our leave days
      const isLeaveDay = leaveDays.some(leaveDate => 
        leaveDate.getDate() === currentDate.getDate() && 
        leaveDate.getMonth() === currentDate.getMonth());
        
      if (isLeaveDay) {
        console.log(`Skipping ${formattedDate} (Paid leave day)`);
        currentDate = addDays(currentDate, 1);
        continue;
      }
      
      // Create attendance record for this day
      const checkInDateTime = new Date(currentDate);
      checkInDateTime.setHours(9, 0, 0);
      
      const checkOutDateTime = new Date(currentDate);
      checkOutDateTime.setHours(18, 0, 0);
      
      // Calculate duration
      const durationHours = 9;
      const durationMinutes = 0;
      
      try {
        const attendance = await prisma.attendanceRecord.create({
          data: {
            userId,
            date: new Date(formattedDate),
            sessionNumber: 1,
            checkInTime: checkInDateTime,
            checkOutTime: checkOutDateTime,
            checkInLocation: { lat: "22.599454255187926", lng: "88.29325246848722" },
            checkOutLocation: { lat: "22.599454255187926", lng: "88.29325246848722" },
            status: "PRESENT",
            notes: "Regular working day",
            duration: {
              hours: durationHours,
              minutes: durationMinutes,
              totalMinutes: durationHours * 60 + durationMinutes
            },
            ipAddress: "127.0.0.1",
            deviceInfo: "Test Seed Script",
            verificationStatus: "VERIFIED"
          }
        });
        
        // Create daily report
        await prisma.userDailyReport.create({
          data: {
            attendanceId: attendance.id,
            reportContent: {
              "Task 1": "Completed assigned tasks",
              "Task 2": "Team meeting",
              "Task 3": "Documentation work"
            }
          }
        });
        
        console.log(`✓ Created attendance for ${formattedDate}`);
      } catch (error) {
        console.error(`✗ Failed to create attendance for ${formattedDate}: ${error.message}`);
      }
      
      currentDate = addDays(currentDate, 1);
    }
    
    console.log('April attendance test data generation completed successfully!');
  } catch (error) {
    console.error('Error in seed script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the seed function
seedAprilAttendance()
  .then(() => console.log('Done!'))
  .catch(err => console.error('Seed script failed:', err));