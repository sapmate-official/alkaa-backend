import prisma from "../../../db/connectDb.js";
export const getSalaries = async (req, res) => {
    try {
        const salaries = await prisma.salaryRecord.findMany();
        res.status(200).json(salaries);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch salaries' });
    }
};

export const getSalaryById = async (req, res) => {
    const { id } = req.params;
    try {
        const salary = await prisma.salaryRecord.findUnique({ where: { id } });
        if (!salary) {
            return res.status(404).json({ error: 'Salary not found' });
        }
        res.status(200).json(salary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch salary' });
    }
};

export const createSalary = async (req, res) => {
    const { userId, month, year, basicSalary, deductions, tax, netSalary, status } = req.body;
    try {
        const newSalary = await prisma.salaryRecord.create({
            data: { userId, month, year, basicSalary, deductions, tax, netSalary, status }
        });
        res.status(201).json(newSalary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create salary' });
    }
};

export const updateSalary = async (req, res) => {
    const { id } = req.params;
    const { userId, month, year, basicSalary, deductions, tax, netSalary, status } = req.body;
    try {
        const existingSalary = await prisma.salaryRecord.findUnique({ where: { id } });
        if (!existingSalary) {
            return res.status(404).json({ error: 'Salary not found' });
        }

        const updatedSalary = await prisma.salaryRecord.update({
            where: { id },
            data: {
                userId: userId !== undefined ? userId : existingSalary.userId,
                month: month !== undefined ? month : existingSalary.month,
                year: year !== undefined ? year : existingSalary.year,
                basicSalary: basicSalary !== undefined ? basicSalary : existingSalary.basicSalary,
                deductions: deductions !== undefined ? deductions : existingSalary.deductions,
                tax: tax !== undefined ? tax : existingSalary.tax,
                netSalary: netSalary !== undefined ? netSalary : existingSalary.netSalary,
                status: status !== undefined ? status : existingSalary.status
            }
        });
        res.status(200).json(updatedSalary);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update salary' });
    }
};

export const deleteSalary = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.salaryRecord.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete salary' });
    }
};
export const getExistenceOfSalaryRecordBasedOnMonthAndYearForUserID = async (req, res) => {
    const { userId, month, year } = req.params;
    try {
        const salaryRecord = await prisma.salaryRecord.findFirst({
            where: {
                userId: userId,
                month: parseInt(month),
                year: parseInt(year)
            }
        });
        if (salaryRecord) {
            res.status(200).json({ exists: true });
        } else {
            res.status(200).json({ exists: false });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to check salary record existence' });
    }
}
