import prisma from '../../../db/connectDb.js';
import bcrypt from 'bcrypt';
import { generateTokens } from '../../../util/generate.js';

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
            httpOnly: true,
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
                subscriptionPlan: true,
                subscriptionStart: true,
                subscriptionEnd: true,
                isActive: true,
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
                            permissions: {
                                some: {
                                    permission: {
                                        key: {
                                            contains: "admin"
                                        }
                                    }
                                }
                            }
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
        
        switch(organization.subscriptionPlan) {
            case 'BASIC':
                pricePerUser = 5; // $5 per user
                break;
            case 'STANDARD':
                pricePerUser = 10; // $10 per user
                break;
            case 'PREMIUM':
                pricePerUser = 15; // $15 per user
                break;
            default:
                pricePerUser = 5; // Default price
        }
        
        const totalAmount = activeUserCount * pricePerUser;
        const billDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 15); // Due in 15 days
        
        // Create or update bill in database (you would need to create a billing model in schema)
        // For now, we'll just return the calculated bill
        
        const bill = {
            organizationId: id,
            organizationName: organization.name,
            month,
            year,
            activeUserCount,
            pricePerUser,
            totalAmount,
            subscriptionPlan: organization.subscriptionPlan,
            status: 'UNPAID',
            billDate: billDate.toISOString(),
            dueDate: dueDate.toISOString()
        };
        
        // In a real implementation, you would save this bill to the database
        
        res.status(200).json({ 
            message: "Bill generated successfully", 
            bill 
        });
    } catch (error) {
        console.error('Error generating organization bill:', error);
        res.status(500).json({ message: "Error generating organization bill", error: error.message });
    }
};

/**
 * Send bill email to organization admin
 */
export const sendBillEmail = async (req, res) => {
    try {
        const { id } = req.params;
        const { billId, month, year } = req.body;
        
        if (!month || !year) {
            return res.status(400).json({ message: "Month and year are required" });
        }
        
        // Get organization
        const organization = await prisma.organization.findUnique({
            where: { id }
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
                            permissions: {
                                some: {
                                    permission: {
                                        key: {
                                            contains: "admin"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        
        if (admins.length === 0) {
            return res.status(404).json({ message: "No admin users found for this organization" });
        }
        
        // Generate the bill if not already provided
        let bill;
        if (!billId) {
            // Logic to generate bill (similar to the generateOrganizationBill function)
            const activeUserCount = await prisma.user.count({
                where: {
                    orgId: id,
                    status: 'active'
                }
            });
            
            let pricePerUser;
            switch(organization.subscriptionPlan) {
                case 'BASIC':
                    pricePerUser = 5;
                    break;
                case 'STANDARD':
                    pricePerUser = 10;
                    break;
                case 'PREMIUM':
                    pricePerUser = 15;
                    break;
                default:
                    pricePerUser = 5;
            }
            
            const totalAmount = activeUserCount * pricePerUser;
            
            bill = {
                organizationId: id,
                organizationName: organization.name,
                month,
                year,
                activeUserCount,
                pricePerUser,
                totalAmount,
                subscriptionPlan: organization.subscriptionPlan
            };
        } else {
            // In a real implementation, you would fetch the bill from the database
            // For now, we'll just create a dummy bill
            bill = {
                id: billId,
                organizationId: id,
                organizationName: organization.name,
                month,
                year,
                // Other bill details would be fetched from the database
            };
        }
        
        // Send email to each admin
        // This is a placeholder - in a real implementation, you would use your email sending function
        // For example, you could use the sendPasswordResetEmail function from src/util/sendEmail.js
        // and modify it to send billing information
        
        const adminEmails = admins.map(admin => admin.email);
        
        // Construct email content
        const emailSubject = `${organization.name} - Billing Statement for ${month}/${year}`;
        const emailContent = `
            <div>
                <h2>Billing Statement</h2>
                <p>Organization: ${organization.name}</p>
                <p>Period: ${month}/${year}</p>
                <p>Total Amount: $${bill.totalAmount}</p>
                <p>Active Users: ${bill.activeUserCount}</p>
                <p>Subscription Plan: ${bill.subscriptionPlan}</p>
                <p>Please process this payment within 15 days.</p>
            </div>
        `;
        
        // In a real implementation, you would call your email sending function here
        // For now, we'll just log the emails that would be sent
        console.log(`Would send billing email to: ${adminEmails.join(', ')}`);
        console.log(`Email subject: ${emailSubject}`);
        console.log(`Email content: ${emailContent}`);
        
        res.status(200).json({ 
            message: "Bill email would be sent successfully", 
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
            where: { isActive: true }
        });
        
        if (organizations.length === 0) {
            return res.status(404).json({ message: "No active organizations found" });
        }
        
        const results = [];
        
        // For each organization, generate bill and send to admins
        for (const organization of organizations) {
            try {
                // Get active user count
                const activeUserCount = await prisma.user.count({
                    where: {
                        orgId: organization.id,
                        status: 'active'
                    }
                });
                
                // Get organization admins
                const admins = await prisma.user.findMany({
                    where: { 
                        orgId: organization.id,
                        status: 'active',
                        roles: {
                            some: {
                                role: {
                                    permissions: {
                                        some: {
                                            permission: {
                                                key: {
                                                    contains: "admin"
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
                
                // Calculate bill
                let pricePerUser;
                switch(organization.subscriptionPlan) {
                    case 'BASIC':
                        pricePerUser = 5;
                        break;
                    case 'STANDARD':
                        pricePerUser = 10;
                        break;
                    case 'PREMIUM':
                        pricePerUser = 15;
                        break;
                    default:
                        pricePerUser = 5;
                }
                
                const totalAmount = activeUserCount * pricePerUser;
                
                // In a real implementation, save the bill to database
                
                // If there are admins, prepare to send emails
                if (admins.length > 0) {
                    const adminEmails = admins.map(admin => admin.email);
                    
                    // In a real implementation, send the emails
                    // For now, just track what would be sent
                    
                    results.push({
                        organizationId: organization.id,
                        organizationName: organization.name,
                        adminEmails,
                        activeUserCount,
                        totalAmount,
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
            message: `Prepared billing for ${organizations.length} organizations`,
            results
        });
    } catch (error) {
        console.error('Error sending bills to all organizations:', error);
        res.status(500).json({ message: "Error sending bills", error: error.message });
    }
};