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
    const { id, accountHolder, accountNumber, ifscCode, bankName } = req.body;
    try {
        const updatedBank = await prisma.bankDetails.update({
            where: { id },
            data: {
                accountHolder,
                accountNumber,
                ifscCode,
                bankName,
            },
        });
        res.status(200).json(updatedBank);
    } catch (error) {
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