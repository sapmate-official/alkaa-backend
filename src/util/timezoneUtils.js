import prisma from "../db/connectDb.js";

/**
 * Get organization timezone from settings
 * @param {string} orgId - Organization ID
 * @returns {Promise<string>} - Timezone string (defaults to 'Asia/Kolkata')
 */
export const getOrganizationTimezone = async (orgId) => {
    try {
        const orgSettings = await prisma.organizationSettings.findFirst({
            where: { orgId },
            select: { settings: true }
        });

        if (orgSettings?.settings?.timezone) {
            return orgSettings.settings.timezone;
        }

        // Default timezone
        return 'Asia/Kolkata';
    } catch (error) {
        console.error('Error fetching organization timezone:', error);
        return 'Asia/Kolkata'; // Fallback to default
    }
};

/**
 * Get organization working hours from settings
 * @param {string} orgId - Organization ID
 * @returns {Promise<string>} - Working hours string (defaults to '9:00 AM - 6:00 PM')
 */
export const getOrganizationWorkingHours = async (orgId) => {
    try {
        const orgSettings = await prisma.organizationSettings.findFirst({
            where: { orgId },
            select: { settings: true }
        });

        if (orgSettings?.settings?.workingHours) {
            return orgSettings.settings.workingHours;
        }

        // Default working hours
        return '9:00 AM - 6:00 PM';
    } catch (error) {
        console.error('Error fetching organization working hours:', error);
        return '9:00 AM - 6:00 PM'; // Fallback to default
    }
};

/**
 * Get organization weekend days from settings
 * @param {string} orgId - Organization ID
 * @returns {Promise<number[]>} - Array of weekend day numbers (defaults to [0, 6] for Sunday and Saturday)
 */
export const getOrganizationWeekends = async (orgId) => {
    try {
        const orgSettings = await prisma.organizationSettings.findFirst({
            where: { orgId },
            select: { settings: true }
        });

        if (orgSettings?.settings?.weekoff && Array.isArray(orgSettings.settings.weekoff)) {
            return orgSettings.settings.weekoff;
        }

        // Default weekends (Sunday = 0, Saturday = 6)
        return [0, 6];
    } catch (error) {
        console.error('Error fetching organization weekends:', error);
        return [0, 6]; // Fallback to default
    }
};

/**
 * Convert UTC timestamp to organization timezone
 * @param {string} utcTimestamp - UTC timestamp string
 * @param {string} orgTimezone - Organization timezone
 * @returns {Date} - Date object
 */
export const convertToOrgTimezone = (utcTimestamp, orgTimezone) => {
    return new Date(utcTimestamp);
};

/**
 * Format timestamp in organization timezone
 * @param {string} utcTimestamp - UTC timestamp string
 * @param {string} orgTimezone - Organization timezone
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} - Formatted date string
 */
export const formatInOrgTimezone = (utcTimestamp, orgTimezone, options = {}) => {
    const date = new Date(utcTimestamp);
    return date.toLocaleString('en-US', {
        timeZone: orgTimezone,
        ...options
    });
};

/**
 * Get current timestamp in organization timezone for display
 * @param {string} orgTimezone - Organization timezone
 * @returns {string} - Formatted current time string
 */
export const getCurrentOrgTime = (orgTimezone) => {
    return new Date().toLocaleString('en-US', {
        timeZone: orgTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

/**
 * Convert local timestamp to UTC for database storage
 * @param {Date|string} localTimestamp - Local timestamp
 * @param {string} orgTimezone - Organization timezone
 * @returns {Date} UTC Date object
 */
export const convertToUTC = (localTimestamp, orgTimezone) => {
    const date = new Date(localTimestamp);
    return new Date(date.toISOString());
};

/**
 * Format date for display in organization timezone
 * @param {Date|string} utcTimestamp - UTC timestamp
 * @param {string} orgTimezone - Organization timezone
 * @param {object} options - Formatting options
 * @returns {string} Formatted date string
 */
export const formatDateInOrgTimezone = (utcTimestamp, orgTimezone, options = {}) => {
    const date = new Date(utcTimestamp);
    const defaultOptions = {
        timeZone: orgTimezone,
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    
    return date.toLocaleString('en-US', { ...defaultOptions, ...options });
};

/**
 * Check if a date is within organization working hours
 * @param {Date|string} timestamp - Timestamp to check
 * @param {string} orgTimezone - Organization timezone
 * @param {string} workingHours - Working hours string (e.g., "9:00 AM - 6:00 PM")
 * @returns {boolean} True if within working hours
 */
export const isWithinWorkingHours = (timestamp, orgTimezone, workingHours = "9:00 AM - 6:00 PM") => {
    try {
        const date = new Date(timestamp);
        const timeInOrgTz = date.toLocaleTimeString('en-US', {
            timeZone: orgTimezone,
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
        });

        // Parse working hours (simple implementation)
        const [startTime, endTime] = workingHours.split(' - ');
        
        // Convert times to 24-hour format for comparison
        const parseTime = (timeStr) => {
            const [time, period] = timeStr.split(' ');
            const [hours, minutes] = time.split(':').map(Number);
            let hour24 = hours;
            
            if (period === 'PM' && hours !== 12) hour24 += 12;
            if (period === 'AM' && hours === 12) hour24 = 0;
            
            return hour24 * 60 + minutes; // Convert to minutes since midnight
        };

        const currentMinutes = (() => {
            const [time, period] = timeInOrgTz.split(' ');
            const [hours, minutes] = time.split(':').map(Number);
            let hour24 = hours;
            
            if (period === 'PM' && hours !== 12) hour24 += 12;
            if (period === 'AM' && hours === 12) hour24 = 0;
            
            return hour24 * 60 + minutes;
        })();

        const startMinutes = parseTime(startTime);
        const endMinutes = parseTime(endTime);

        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } catch (error) {
        console.error('Error checking working hours:', error);
        return true; // Default to true if parsing fails
    }
};
