import prisma from '../../../db/connectDb.js';
import bcrypt from 'bcrypt';
import { generateTokens } from '../../../util/generate.js';
import { sendBillingEmail } from '../../../util/sendEmail.js';

// Get all super admins
export const getSuperAdmins = async (req, res) => {
    try {
        const superAdmins = await prisma.superAdmin.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });
        
        res.status(200).json(superAdmins);
    } catch (error) {
        res.status(500).json({ message: "Error fetching super admins", error: error.message });
    }
};

// Get super admin by ID
export const getSuperAdminById = async (req, res) => {
    try {
        const { id } = req.params;
        const superAdmin = await prisma.superAdmin.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!superAdmin) {
            return res.status(404).json({ message: "Super admin not found" });
        }

        res.status(200).json(superAdmin);
    } catch (error) {
        res.status(500).json({ message: "Error fetching super admin", error: error.message });
    }
};

// Create super admin
export const createSuperAdmin = async (req, res) => {
    try {
        const { email, name, password } = req.body;

        // Validate input
        if (!email || !name || !password) {
            return res.status(400).json({ message: "Email, name and password are required" });
        }

        // Check if super admin already exists
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if (existingSuperAdmin) {
            return res.status(409).json({ message: "Super admin with this email already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create super admin
        const superAdmin = await prisma.superAdmin.create({
            data: {
                email,
                name,
                hashedPassword
            },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(201).json(superAdmin);
    } catch (error) {
        res.status(500).json({ message: "Error creating super admin", error: error.message });
    }
};

// Update super admin
export const updateSuperAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, password } = req.body;

        // Check if super admin exists
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { id }
        });

        if (!existingSuperAdmin) {
            return res.status(404).json({ message: "Super admin not found" });
        }

        // Prepare update data
        const updateData = {};
        if (email) updateData.email = email;
        if (name) updateData.name = name;
        if (password) {
            updateData.hashedPassword = await bcrypt.hash(password, 10);
        }

        // Update super admin
        const updatedSuperAdmin = await prisma.superAdmin.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });

        res.status(200).json(updatedSuperAdmin);
    } catch (error) {
        res.status(500).json({ message: "Error updating super admin", error: error.message });
    }
};

// Delete super admin
export const deleteSuperAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if super admin exists
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
            where: { id }
        });

        if (!existingSuperAdmin) {
            return res.status(404).json({ message: "Super admin not found" });
        }

        // Delete super admin
        await prisma.superAdmin.delete({
            where: { id }
        });

        res.status(200).json({ message: "Super admin deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting super admin", error: error.message });
    }
};

export const loginSuperAdmin = async (req, res) => {
    try {
        console.log("[loginSuperAdmin] Login attempt started");
        const { email, password } = req.body;
        console.log(`[loginSuperAdmin] Login attempt for email: ${email}`);
        
        if (!email || !password) {
            console.log("[loginSuperAdmin] Missing email or password");
            return res.status(400).send({
                message: "Email and password are required",
            });
        }
        
        console.log("[loginSuperAdmin] Finding super admin in database");
        const superAdmin = await prisma.superAdmin.findFirst({
            where: {
                email,
            },
        });
        
        if (!superAdmin) {
            console.log(`[loginSuperAdmin] No super admin found with email: ${email}`);
            return res.status(401).send({
                message: "No super admin exists with this Email",
            });
        }
        
        console.log("[loginSuperAdmin] Validating password");
        const isPasswordValid = await bcrypt.compare(password, superAdmin.hashedPassword);
        
        if (!isPasswordValid) {
            console.log("[loginSuperAdmin] Invalid password provided");
            return res.status(401).send({
                message: "Invalid credentials",
            });
        }
        
        console.log("[loginSuperAdmin] Generating tokens");
        const { accessToken, refreshToken } = generateTokens(
            superAdmin.email,
            superAdmin.id,
            "2d",
            "7d"
        );
        
        console.log("[loginSuperAdmin] Updating refresh token in database");
        const puttoken = await prisma.superAdmin.update({
            where: {
                email: email
            },
            data: {
                refreshToken: refreshToken,
            }
        });
        
        console.log("[loginSuperAdmin] Setting cookies");
        res.cookie("refreshToken", refreshToken, {
            // httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });

        console.log("[loginSuperAdmin] Login successful");
        return res.status(200).send({
            message: "Super Admin logged in successfully",
            userData: {
                id: superAdmin.id,  // Fixed: changed user.id to superAdmin.id
                email: superAdmin.email,  // Fixed: changed user.email to superAdmin.email
                name: superAdmin.name,  // Fixed: changed user.name to superAdmin.name
            },
            refreshToken,
            accessToken,
        });
    } catch (error) {
        console.error("[loginSuperAdmin] Error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const logoutSuperAdmin = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({
                message: "Email is required",
            });
        }
        const superAdmin = await prisma.superAdmin.findFirst({
            where: {
                email,
            },
        });
        if (!superAdmin) {
            return res.status(401).send({
                message: "No super admin exists with this Email",
            });
        }
        const puttoken = await prisma.superAdmin.update({
            where:{
                email: email},
            data:{refreshToken:null,
            }
        });
        
        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
    
        res.clearCookie("accessToken", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
        });
    
        return res.status(200).send({
            message: "Super Admin logged out successfully",
            
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const validateSuperAdminToken = async (req, res) => {
    try {
        const { email } = req.user;
        if (!email) {
            return res.status(400).send({
                message: "Email is required",
            });
        }
        const superAdmin = await prisma.superAdmin.findFirst({
            where: {
                email,
            },
        });
        if (!superAdmin) {
            return res.status(401).send({
                message: "No super admin exists with this Email",
            });
        }
        return res.status(200).send({
            message: "Super Admin token validated successfully",
            
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserInfo = async (req, res) => {
    try {
        const { email } = req.user;
        if (!email) {
            return res.status(400).send({
                message: "Email is required",
            });
        }
        const superAdmin = await prisma.superAdmin.findFirst({
            where: {
                email,
            },
            select: {
                id: true,
                email: true,
                name: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!superAdmin) {
            return res.status(401).send({
                message: "No super admin exists with this Email",
            });
        }
        return res.status(200).send({
            message: "Super Admin token validated successfully",
            userData: {
                id: superAdmin.id,
                email: superAdmin.email,
                name:superAdmin.name,
            },
            
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Organization tracking and billing controllers

/**
 * Get statistics for all organizations
 * - User counts
 * - Subscription details
 * - Billing status
 */
export const getOrganizationsStats = async (req, res) => {
    try {
        const organizations = await prisma.organization.findMany({
            select: {
                id: true,
                name: true,
                subscriptionStart: true,
                subscriptionEnd: true,
                isActive: true,
                subscriptionPlanId: true,
                subscriptionPlan: {
                    select: {
                        id: true,
                        name: true,
                        monthlyPrice: true,
                        annualPrice: true,
                        maxUsers: true,
                        features: true
                    }
                },
                _count: {
                    select: {
                        users: true,
                        departments: true
                    }
                }
            },
            orderBy: {
                subscriptionEnd: 'asc'
            }
        });

        // Calculate days remaining for each subscription
        const orgsWithStats = organizations.map(org => {
            const daysRemaining = org.subscriptionEnd ? 
                Math.ceil((new Date(org.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24)) : 
                null;
            
            return {
                ...org,
                daysRemaining,
                subscriptionStatus: daysRemaining < 0 ? 'Expired' : 
                                    daysRemaining < 7 ? 'Expiring Soon' : 
                                    'Active'
            };
        });

        res.status(200).json(orgsWithStats);
    } catch (error) {
        console.error('Error getting organization stats:', error);
        res.status(500).json({ message: "Error fetching organization statistics", error: error.message });
    }
};

/**
 * Get detailed information for a specific organization
 */
export const getOrganizationDetails = async (req, res) => {
    try {
        const { id } = req.params;
        
        const organization = await prisma.organization.findUnique({
            where: { id },
            include: {
                subscriptionPlan: true,
                _count: {
                    select: {
                        users: true,
                        departments: true,
                        roles: true
                    }
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: {
                                users: true
                            }
                        }
                    }
                },
                roles: {
                    select: {
                        id: true,
                        name: true,
                        isDefault: true,
                        _count: {
                            select: {
                                users: true
                            }
                        }
                    }
                }
            }
        });

        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        // Calculate subscription metrics
        const subscriptionEnd = organization.subscriptionEnd;
        const daysRemaining = subscriptionEnd ? 
            Math.ceil((new Date(subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24)) : 
            null;
        
        const subscriptionStatus = !subscriptionEnd ? 'No End Date' :
                                  daysRemaining < 0 ? 'Expired' : 
                                  daysRemaining < 7 ? 'Expiring Soon' : 
                                  'Active';

        const result = {
            ...organization,
            subscriptionMetrics: {
                daysRemaining,
                subscriptionStatus
            }
        };

        res.status(200).json(result);
    } catch (error) {
        console.error('Error getting organization details:', error);
        res.status(500).json({ message: "Error fetching organization details", error: error.message });
    }
};

/**
 * Get users of a specific organization
 */
export const getOrganizationUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, role, page = 1, limit = 100 } = req.query;
        
        // Construct filter
        const filter = { orgId: id };
        if (status) filter.status = status;
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // First, check if organization exists
        const organization = await prisma.organization.findUnique({
            where: { id }
        });
        
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        
        // Get total count with filters
        const totalUsers = await prisma.user.count({
            where: filter
        });
        
        // Get users with pagination
        const users = await prisma.user.findMany({
            where: filter,
            skip,
            take: parseInt(limit),
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                status: true,
                employeeId: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                roles: {
                    include: {
                        role: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        
        // If role filter is applied, filter users with that role
        let filteredUsers = users;
        if (role) {
            filteredUsers = users.filter(user => 
                user.roles.some(userRole => userRole.role.id === role || userRole.role.name === role)
            );
        }
        
        res.status(200).json({
            users: filteredUsers,
            pagination: {
                total: totalUsers,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalUsers / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error getting organization users:', error);
        res.status(500).json({ message: "Error fetching organization users", error: error.message });
    }
};

/**
 * Get admin users of a specific organization
 */
export const getOrganizationAdmins = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if organization exists
        const organization = await prisma.organization.findUnique({
            where: { id }
        });
        
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        
        // Find users with admin roles (roles that have admin permissions)
        const usersWithRoles = await prisma.user.findMany({
            where: { 
                orgId: id,
                status: 'active',
                roles: {
                    some: {
                        role: {
                            name: 'Org_Admin'
                        }
                    }
                }
            },
            include: {
                roles: {
                    include: {
                        role: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    }
                }
            }
        });
        
        const admins = usersWithRoles.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            employeeId: user.employeeId,
            roles: user.roles.map(r => ({
                id: r.role.id,
                name: r.role.name
            }))
        }));
        
        res.status(200).json(admins);
    } catch (error) {
        console.error('Error getting organization admins:', error);
        res.status(500).json({ message: "Error fetching organization admins", error: error.message });
    }
};

/**
 * Generate a bill for an organization based on user count and subscription plan
 */
export const generateOrganizationBill = async (req, res) => {
    try {
        const { id } = req.params;
        const { month, year } = req.body;
        
        if (!month || !year) {
            return res.status(400).json({ message: "Month and year are required" });
        }
        
        // Get organization with user count
        const organization = await prisma.organization.findUnique({
            where: { id },
            include: {
                subscriptionPlan: true,
                _count: {
                    select: {
                        users: {
                            where: {
                                status: 'active'
                            }
                        }
                    }
                }
            }
        });
        
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        
        // Calculate bill based on subscription plan and user count
        const activeUserCount = organization._count.users;
        let pricePerUser;
        
        // Use pricing from subscription plan if available
        if (organization.subscriptionPlan) {
            // Using monthly price as the per-user price
            pricePerUser = organization.subscriptionPlan.monthlyPrice;
        } else {
            // Fallback pricing if no plan is associated
            pricePerUser = 5; // Default price
        }
        
        const totalAmount = activeUserCount * pricePerUser;
        const billDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 15); // Due in 15 days
        
        // Check if bill already exists for this period
        const existingBill = await prisma.billingRecord.findUnique({
            where: {
                organizationId_month_year: {
                    organizationId: id,
                    month,
                    year
                }
            }
        });
        
        let bill;
        
        if (existingBill) {
            // Update existing bill with new user count and total amount
            bill = await prisma.billingRecord.update({
                where: { id: existingBill.id },
                data: {
                    activeUserCount,
                    pricePerUser,
                    totalAmount,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new bill
            bill = await prisma.billingRecord.create({
                data: {
                    organizationId: id,
                    month,
                    year,
                    activeUserCount,
                    pricePerUser,
                    totalAmount,
                    status: 'UNPAID',
                    billDate,
                    dueDate
                }
            });
        }
        
        // Add organization name for the frontend
        const billWithOrgName = {
            ...bill,
            organizationName: organization.name,
            subscriptionPlan: organization.subscriptionPlan?.name || 'No Plan'
        };
        
        res.status(200).json({ 
            message: "Bill generated successfully", 
            bill: billWithOrgName
        });
    } catch (error) {
        console.error('Error generating organization bill:', error);
        res.status(500).json({ message: "Error generating organization bill", error: error.message });
    }
};

/**
 * Get all bills for an organization
 */
export const getOrganizationBills = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, year, page = 1, limit = 10 } = req.query;
        
        // Check if organization exists
        const organization = await prisma.organization.findUnique({
            where: { id }
        });
        
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        
        // Build filter
        const filter = { organizationId: id };
        if (status) filter.status = status;
        if (year) filter.year = parseInt(year);
        
        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // Get bill count
        const totalBills = await prisma.billingRecord.count({
            where: filter
        });
        
        // Get bills
        const bills = await prisma.billingRecord.findMany({
            where: filter,
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ],
            skip,
            take: parseInt(limit)
        });
        
        res.status(200).json({
            bills,
            pagination: {
                total: totalBills,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalBills / parseInt(limit))
            },
            organizationName: organization.name
        });
    } catch (error) {
        console.error('Error fetching organization bills:', error);
        res.status(500).json({ message: "Error fetching organization bills", error: error.message });
    }
};

/**
 * Send bill email to organization admin
 */
export const sendBillEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { billId, month, year } = req.body;
        
        if ((!billId && (!month || !year))) {
            return res.status(400).json({ message: "Either billId or both month and year are required" });
        }
        
        // Get organization
        const organization = await prisma.organization.findUnique({
            where: { id },
            include: {
                subscriptionPlan: true
            }
        });
        
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        
        // Get organization admins
        const admins = await prisma.user.findMany({
            where: { 
                orgId: id,
                status: 'active',
                roles: {
                    some: {
                        role: {
                            name: 'Org_Admin'
                        }
                    }
                }
            }
        });
        
        if (admins.length === 0) {
            return res.status(404).json({ message: "No admin users found for this organization" });
        }
        
        // Get or create the bill
        let bill;
        
        if (billId) {
            // Find existing bill
            bill = await prisma.billingRecord.findUnique({
                where: { id: billId }
            });
            
            if (!bill) {
                return res.status(404).json({ message: "Bill not found" });
            }
        } else {
            // Find bill by month and year
            bill = await prisma.billingRecord.findUnique({
                where: {
                    organizationId_month_year: {
                        organizationId: id,
                        month,
                        year
                    }
                }
            });
            
            // If bill doesn't exist, create it
            if (!bill) {
                const result = await generateBill(id, month, year);
                bill = result.bill;
            }
        }
        
        // Send email to each admin
        const adminEmails = admins.map(admin => admin.email);
        const emailPromises = [];
        
        for (const email of adminEmails) {
            const emailData = {
                ...bill,
                subscriptionPlan: organization.subscriptionPlan?.name || 'No Plan'
            };
            
            emailPromises.push(sendBillingEmail(email, emailData, organization.name));
        }
        
        // Wait for all emails to be sent
        const emailResults = await Promise.allSettled(emailPromises);
        
        // Count successful emails
        const successCount = emailResults.filter(result => result.status === 'fulfilled').length;
        
        res.status(200).json({ 
            message: `${successCount} out of ${adminEmails.length} emails sent successfully`, 
            recipients: adminEmails,
            bill
        });
    } catch (error) {
        console.error('Error sending bill email:', error);
        res.status(500).json({ message: "Error sending bill email", error: error.message });
    }
};

/**
 * Send bills to all organizations
 */
export const sendBillsToAllOrganizations = async (req, res) => {
    try {
        const { month, year } = req.body;
        
        if (!month || !year) {
            return res.status(400).json({ message: "Month and year are required" });
        }
        
        // Get all active organizations
        const organizations = await prisma.organization.findMany({
            where: { isActive: true },
            include: {
                subscriptionPlan: true
            }
        });
        
        if (organizations.length === 0) {
            return res.status(404).json({ message: "No active organizations found" });
        }
        
        const results = [];
        
        // For each organization, generate bill and send to admins
        for (const organization of organizations) {
            try {
                // Generate or update bill
                const { bill, activeUserCount, pricePerUser, totalAmount } = await generateBill(organization.id, month, year);
                
                // Get organization admins
                const admins = await prisma.user.findMany({
                    where: { 
                        orgId: organization.id,
                        status: 'active',
                        roles: {
                            some: {
                                role: {
                                    name: 'Org_Admin'
                                }
                            }
                        }
                    }
                });
                
                // If there are admins, send emails
                if (admins.length > 0) {
                    const adminEmails = admins.map(admin => admin.email);
                    const emailPromises = [];
                    
                    for (const email of adminEmails) {
                        const emailData = {
                            ...bill,
                            subscriptionPlan: organization.subscriptionPlan?.name || 'No Plan'
                        };
                        
                        emailPromises.push(sendBillingEmail(email, emailData, organization.name));
                    }
                    
                    // Process emails in parallel
                    const emailResults = await Promise.allSettled(emailPromises);
                    const successCount = emailResults.filter(result => result.status === 'fulfilled').length;
                    
                    results.push({
                        organizationId: organization.id,
                        organizationName: organization.name,
                        adminEmails,
                        activeUserCount,
                        totalAmount,
                        emailsSent: successCount,
                        status: 'prepared'
                    });
                } else {
                    results.push({
                        organizationId: organization.id,
                        organizationName: organization.name,
                        activeUserCount,
                        totalAmount,
                        status: 'no_admins'
                    });
                }
            } catch (error) {
                console.error(`Error processing organization ${organization.id}:`, error);
                results.push({
                    organizationId: organization.id,
                    organizationName: organization.name,
                    status: 'error',
                    error: error.message
                });
            }
        }
        
        res.status(200).json({
            message: `Processed billing for ${organizations.length} organizations`,
            results
        });
    } catch (error) {
        console.error('Error sending bills to all organizations:', error);
        res.status(500).json({ message: "Error sending bills", error: error.message });
    }
};

/**
 * Helper function to generate or update a bill
 */
const generateBill = async (organizationId, month, year) => {
    // Get organization with user count
    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
            subscriptionPlan: true,
            _count: {
                select: {
                    users: {
                        where: {
                            status: 'active'
                        }
                    }
                }
            }
        }
    });
    
    if (!organization) {
        throw new Error("Organization not found");
    }
    
    // Calculate bill based on subscription plan and user count
    const activeUserCount = organization._count.users;
    let pricePerUser;
    
    // Use pricing from subscription plan if available
    if (organization.subscriptionPlan) {
        // Using monthly price as the per-user price
        pricePerUser = organization.subscriptionPlan.monthlyPrice;
    } else {
        // Fallback pricing if no plan is associated
        pricePerUser = 5; // Default price
    }
    
    const totalAmount = activeUserCount * pricePerUser;
    const billDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15); // Due in 15 days
    
    // Check if bill already exists for this period
    const existingBill = await prisma.billingRecord.findUnique({
        where: {
            organizationId_month_year: {
                organizationId,
                month,
                year
            }
        }
    });
    
    let bill;
    
    if (existingBill) {
        // Update existing bill with new user count and total amount
        bill = await prisma.billingRecord.update({
            where: { id: existingBill.id },
            data: {
                activeUserCount,
                pricePerUser,
                totalAmount,
                updatedAt: new Date()
            }
        });
    } else {
        // Create new bill
        bill = await prisma.billingRecord.create({
            data: {
                organizationId,
                month,
                year,
                activeUserCount,
                pricePerUser,
                totalAmount,
                status: 'UNPAID',
                billDate,
                dueDate
            }
        });
    }
    
    return { bill, activeUserCount, pricePerUser, totalAmount };
};

/**
 * Update bill status
 */
export const updateBillStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, paymentReference, notes } = req.body;
        
        if (!status) {
            return res.status(400).json({ message: "Status is required" });
        }
        
        // Check if bill exists
        const bill = await prisma.billingRecord.findUnique({
            where: { id }
        });
        
        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }
        
        // Update data
        const updateData = { status };
        
        if (status === 'PAID') {
            updateData.paidDate = new Date();
        }
        
        if (paymentReference) updateData.paymentReference = paymentReference;
        if (notes) updateData.notes = notes;
        
        // Update bill
        const updatedBill = await prisma.billingRecord.update({
            where: { id },
            data: updateData
        });
        
        res.status(200).json({
            message: "Bill status updated successfully",
            bill: updatedBill
        });
    } catch (error) {
        console.error('Error updating bill status:', error);
        res.status(500).json({ message: "Error updating bill status", error: error.message });
    }
};

/**
 * Get billing statistics for dashboard
 */
export const getBillingStatistics = async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        // Get total billing amount this month
        const thisMonthBills = await prisma.billingRecord.findMany({
            where: {
                month: currentMonth,
                year: currentYear
            }
        });
        
        const totalBilledThisMonth = thisMonthBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
        const totalPaidThisMonth = thisMonthBills
            .filter(bill => bill.status === 'PAID')
            .reduce((sum, bill) => sum + bill.totalAmount, 0);
        
        // Get billing status breakdown
        const unpaidBills = await prisma.billingRecord.count({
            where: { status: 'UNPAID' }
        });
        
        const paidBills = await prisma.billingRecord.count({
            where: { status: 'PAID' }
        });
        
        const overdueBills = await prisma.billingRecord.count({
            where: { status: 'OVERDUE' }
        });
        
        // Get organizations with pending bills
        const orgsWithPendingBills = await prisma.billingRecord.findMany({
            where: {
                status: 'UNPAID'
            },
            select: {
                organizationId: true,
                organization: {
                    select: {
                        name: true
                    }
                },
                totalAmount: true,
                dueDate: true
            },
            orderBy: {
                dueDate: 'asc'
            },
            take: 5
        });
        
        res.status(200).json({
            billing: {
                totalBilledThisMonth,
                totalPaidThisMonth,
                collectionRate: totalBilledThisMonth ? (totalPaidThisMonth / totalBilledThisMonth) * 100 : 0
            },
            billStatus: {
                unpaid: unpaidBills,
                paid: paidBills,
                overdue: overdueBills,
                total: unpaidBills + paidBills + overdueBills
            },
            pendingBills: orgsWithPendingBills.map(bill => ({
                organizationId: bill.organizationId,
                organizationName: bill.organization.name,
                amount: bill.totalAmount,
                dueDate: bill.dueDate
            }))
        });
    } catch (error) {
        console.error('Error fetching billing statistics:', error);
        res.status(500).json({ message: "Error fetching billing statistics", error: error.message });
    }
};

/**
 * Get a specific bill by ID
 */
export const getBillById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const bill = await prisma.billingRecord.findUnique({
            where: { id },
            include: {
                organization: {
                    select: {
                        name: true,
                        logo: true,
                        subscriptionPlanId: true,
                        subscriptionPlan: true
                    }
                }
            }
        });
        
        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }
        
        // Format the bill for the frontend
        const subscriptionPlanName = bill.organization.subscriptionPlan?.name || 'No Plan';
        
        const formattedBill = {
            ...bill,
            organizationName: bill.organization.name,
            organizationLogo: bill.organization.logo,
            subscriptionPlan: subscriptionPlanName,
            monthName: new Date(bill.year, bill.month - 1).toLocaleString('default', { month: 'long' }),
        };
        
        res.status(200).json(formattedBill);
    } catch (error) {
        console.error('Error fetching bill details:', error);
        res.status(500).json({ message: "Error fetching bill details", error: error.message });
    }
};

// Add a controller to process payments
export const processBillPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, paymentReference } = req.body;
        
        // Validate input
        if (!paymentMethod) {
            return res.status(400).json({ message: "Payment method is required" });
        }
        
        // Check if bill exists and is unpaid
        const bill = await prisma.billingRecord.findUnique({
            where: { id }
        });
        
        if (!bill) {
            return res.status(404).json({ message: "Bill not found" });
        }
        
        if (bill.status === 'PAID') {
            return res.status(400).json({ message: "Bill is already paid" });
        }
        
        // Update bill status to PAID
        const updatedBill = await prisma.billingRecord.update({
            where: { id },
            data: {
                status: 'PAID',
                paidDate: new Date(),
                paymentReference: paymentReference || `${paymentMethod}-${Date.now()}`
            }
        });
        
        res.status(200).json({
            message: "Payment processed successfully",
            bill: updatedBill
        });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ message: "Error processing payment", error: error.message });
    }
};