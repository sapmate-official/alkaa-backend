import prisma from "../../../db/connectDb.js";

export const getBank = async (req, res) => {
    try {
        const banks = await prisma.bankDetails.findMany();
        res.status(200).json(banks);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bank details' });
    }
};

export const getBankById = async (req, res) => {
    const { id } = req.params;
    try {
        const bank = await prisma.bankDetails.findUnique({
            where: { userId:id },
        });
        if (bank) {
            res.status(200).json(bank);
        } else {
            res.status(404).json({ error: 'Bank not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bank details' });
    }
};

export const createBank = async (req, res) => {
    const { userId, accountHolder, accountNumber, ifscCode, bankName } = req.body;

    try {
        const newBank = await prisma.bankDetails.create({
            data: {
                userId,
                accountHolder,
                accountNumber,
                ifscCode,
                bankName,
            },
        });
        res.status(201).json(newBank);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: 'Failed to create bank details' });
    }
};

export const updateBank = async (req, res) => {
    const { userId, accountHolder, accountNumber, ifscCode, bankName } = req.body;
    
    // Validation
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    
    if (!accountHolder || accountHolder.trim() === '') {
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
                    accountHolder,
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
                    accountHolder,
                    accountNumber,
                    ifscCode,
                    bankName,
                }
            });
        }
        
        res.status(200).json(result);
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
    const { Userid } = req.params;
    try {
        const bank = await prisma.bankDetails.findFirst({
            where: { userId: Userid },
        });
        if (bank) {
            res.status(200).json(bank);
        } else {
            res.status(404).json({ error: 'Bank not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bank details' });
    }
}