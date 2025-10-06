import prisma from "../../../db/connectDb.js";

export const getBank = async (req, res) => {
    try {
        // Check if user has permission to view all bank details
        const currentUserId = req.user.id;
        
        const hasViewAllPermission = await prisma.rolePermission.findFirst({
            where: {
                permission: {
                    key: "view_bank_all_user"
                },
                role: {
                    users: {
                        some: {
                            userId: currentUserId
                        }
                    }
                }
            }
        });

        if (!hasViewAllPermission) {
            return res.status(403).json({ error: 'You do not have permission to view all bank details' });
        }
        
        const banks = await prisma.bankDetails.findMany();
        
        // Transform accountHolder to accountHolderName for frontend compatibility
        const transformedBanks = banks.map(bank => ({
            ...bank,
            accountHolderName: bank.accountHolder,
            accountHolder: undefined
        }));
        
        res.status(200).json(transformedBanks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bank details' });
    }
};

export const getBankById = async (req, res) => {
    const { id } = req.params;
    try {
        const currentUserId = req.user.id;
        
        // Check if the user is viewing their own bank details
        const isSelf = id === currentUserId;
        
        if (!isSelf) {
            // Check if user has permission to view all bank details
            const hasViewAllPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_bank_all_user"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });
            
            // Check if user has permission to view subordinates' bank details
            const hasViewSubordinatesPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_bank_subordinates"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });
            
            // If they have subordinates permission, check if requested user is a subordinate
            let isSubordinate = false;
            if (hasViewSubordinatesPermission) {
                const subordinate = await prisma.user.findFirst({
                    where: {
                        id: id,
                        managerId: currentUserId
                    }
                });
                isSubordinate = !!subordinate;
            }
            
            // Deny if they don't have appropriate permissions
            if (!hasViewAllPermission && !isSubordinate) {
                return res.status(403).json({ 
                    error: 'You do not have permission to view this user\'s bank details' 
                });
            }
        }
        
        const bank = await prisma.bankDetails.findUnique({
            where: { userId:id },
        });
        
        if (bank) {
            // Transform accountHolder to accountHolderName for frontend compatibility
            const transformedBank = {
                ...bank,
                accountHolderName: bank.accountHolder,
                accountHolder: undefined
            };
            res.status(200).json(transformedBank);
        } else {
            res.status(204  ).json({ message: 'Bank not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bank details' });
    }
};

export const createBank = async (req, res) => {
    const { userId, accountHolderName, accountNumber, ifscCode, bankName } = req.body;

    try {
        // Use upsert to either create or update bank details
        const bankDetails = await prisma.bankDetails.upsert({
            where: { userId },
            update: {
                accountHolder: accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
            },
            create: {
                userId,
                accountHolder: accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
            },
        });
        
        // Transform accountHolder to accountHolderName for frontend compatibility
        const transformedBank = {
            ...bankDetails,
            accountHolderName: bankDetails.accountHolder,
            accountHolder: undefined
        };
        
        res.status(201).json({
            success: true,
            data: transformedBank,
            message: 'Bank details saved successfully'
        });
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ 
            success: false,
            message: 'Failed to save bank details',
            error: error.message
        });
    }
};

export const updateBank = async (req, res) => {
    const { userId, accountHolderName, accountNumber, ifscCode, bankName } = req.body;
    
    // Validation
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!accountHolderName || accountHolderName.trim() === '') {
        return res.status(400).json({ error: 'Account holder name is required' });
    }
    
    if (!accountNumber || !/^\d{9,18}$/.test(accountNumber)) {
        return res.status(400).json({ error: 'Valid account number is required (9-18 digits)' });
    }
    
    if (!ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
        return res.status(400).json({ error: 'Valid IFSC code is required (format: ABCD0XXXXXX)' });
    }
    
    if (!bankName || bankName.trim() === '') {
        return res.status(400).json({ error: 'Bank name is required' });
    }
    
    try {
        // First check if bank details exist for this user
        const existingBank = await prisma.bankDetails.findUnique({
            where: { userId }
        });
        
        let result;
        
        if (existingBank) {
            // Update if exists
            result = await prisma.bankDetails.update({
                where: { userId },
                data: {
                    accountHolder: accountHolderName,
                    accountNumber,
                    ifscCode,
                    bankName,
                }
            });
        } else {
            // Create if doesn't exist
            result = await prisma.bankDetails.create({
                data: {
                    userId,
                    accountHolder: accountHolderName,
                    accountNumber,
                    ifscCode,
                    bankName,
                }
            });
        }
        
        // Transform accountHolder to accountHolderName for frontend compatibility
        const transformedResult = {
            ...result,
            accountHolderName: result.accountHolder,
            accountHolder: undefined
        };
        
        res.status(200).json(transformedResult);
    } catch (error) {
        console.log(error);
        
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Bank details not found for this user' });
        }
        
        res.status(500).json({ error: 'Failed to update bank details' });
    }
};

export const deleteBank = async (req, res) => {
    const { id } = req.body;
    try {
        await prisma.bankDetails.delete({
            where: { id },
        });
        res.status(200).json({ message: 'Bank details deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete bank details' });
    }
};

export const getBankByUserId = async (req, res) => {
    const { userId } = req.params;
    try {
        const currentUserId = req.user.id;
        
        // Check if the user is viewing their own bank details
        const isSelf = userId === currentUserId;
        
        if (!isSelf) {
            // Check if user has permission to view all bank details
            const hasViewAllPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_bank_all_user"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });
            
            // Check if user has permission to view subordinates' bank details
            const hasViewSubordinatesPermission = await prisma.rolePermission.findFirst({
                where: {
                    permission: {
                        key: "view_bank_subordinates"
                    },
                    role: {
                        users: {
                            some: {
                                userId: currentUserId
                            }
                        }
                    }
                }
            });
            
            // If they have subordinates permission, check if requested user is a subordinate
            let isSubordinate = false;
            if (hasViewSubordinatesPermission) {
                const subordinate = await prisma.user.findFirst({
                    where: {
                        id: userId,
                        managerId: currentUserId
                    }
                });
                isSubordinate = !!subordinate;
            }
            
            // Deny if they don't have appropriate permissions
            if (!hasViewAllPermission && !isSubordinate) {
                return res.status(403).json({ 
                    success: false,
                    message: 'You do not have permission to view this user\'s bank details'
                });
            }
        }
        
        const bank = await prisma.bankDetails.findFirst({
            where: { userId },
        });
        if (!bank) {
            return res.status(200).json({
                success: true,
                data: null,
                message: "We couldn't find bank details for this user yet."
            });
        }

        // Transform accountHolder to accountHolderName for frontend compatibility
        const transformedBank = bank ? {
            ...bank,
            accountHolderName: bank.accountHolder,
            accountHolder: undefined
        } : null;

        return res.status(200).json({
            success: true,
            data: transformedBank
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bank details'
        });
    }
}