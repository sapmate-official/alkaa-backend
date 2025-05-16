import prisma from '../../../db/connectDb.js';

/**
 * Get all subscription plans
 */
export const getSubscriptionPlans = async (req, res) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            orderBy: {
                monthlyPrice: 'asc'
            }
        });
        
        res.status(200).json(plans);
    } catch (error) {
        console.error('Error fetching subscription plans:', error);
        res.status(500).json({ message: "Error fetching subscription plans", error: error.message });
    }
};

/**
 * Get subscription plan by ID
 */
export const getSubscriptionPlanById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        organizations: true
                    }
                }
            }
        });
        
        if (!plan) {
            return res.status(404).json({ message: "Subscription plan not found" });
        }
        
        res.status(200).json(plan);
    } catch (error) {
        console.error('Error fetching subscription plan:', error);
        res.status(500).json({ message: "Error fetching subscription plan", error: error.message });
    }
};

/**
 * Create a new subscription plan
 */
export const createSubscriptionPlan = async (req, res) => {
    try {
        const { name, description, monthlyPrice, annualPrice, maxUsers, features } = req.body;
        
        // Validate required fields
        if (!name || !monthlyPrice || !annualPrice) {
            return res.status(400).json({ message: "Name, monthlyPrice, and annualPrice are required" });
        }
        
        // Check for existing plan with same name
        const existingPlan = await prisma.subscriptionPlan.findUnique({
            where: { name }
        });
        
        if (existingPlan) {
            return res.status(409).json({ message: "A subscription plan with this name already exists" });
        }
        
        // Create the plan
        const newPlan = await prisma.subscriptionPlan.create({
            data: {
                name,
                description,
                monthlyPrice: parseFloat(monthlyPrice),
                annualPrice: parseFloat(annualPrice),
                maxUsers: maxUsers ? parseInt(maxUsers) : null,
                features: features ? JSON.parse(JSON.stringify(features)) : null,
                isActive: true
            }
        });
        
        res.status(201).json(newPlan);
    } catch (error) {
        console.error('Error creating subscription plan:', error);
        res.status(500).json({ message: "Error creating subscription plan", error: error.message });
    }
};

/**
 * Update a subscription plan
 */
export const updateSubscriptionPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, monthlyPrice, annualPrice, maxUsers, features, isActive } = req.body;
        
        // Check if plan exists
        const existingPlan = await prisma.subscriptionPlan.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        organizations: true
                    }
                }
            }
        });
        
        if (!existingPlan) {
            return res.status(404).json({ message: "Subscription plan not found" });
        }
        
        // If name is being updated, check for duplicates
        if (name && name !== existingPlan.name) {
            const duplicateName = await prisma.subscriptionPlan.findUnique({
                where: { name }
            });
            
            if (duplicateName) {
                return res.status(409).json({ message: "A subscription plan with this name already exists" });
            }
        }
        
        // Prepare update data
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (monthlyPrice !== undefined) updateData.monthlyPrice = parseFloat(monthlyPrice);
        if (annualPrice !== undefined) updateData.annualPrice = parseFloat(annualPrice);
        if (maxUsers !== undefined) updateData.maxUsers = maxUsers ? parseInt(maxUsers) : null;
        if (features !== undefined) updateData.features = JSON.parse(JSON.stringify(features));
        if (isActive !== undefined) updateData.isActive = isActive;
        
        // Update the plan
        const updatedPlan = await prisma.subscriptionPlan.update({
            where: { id },
            data: updateData
        });
        
        res.status(200).json({
            ...updatedPlan,
            organizationCount: existingPlan._count.organizations
        });
    } catch (error) {
        console.error('Error updating subscription plan:', error);
        res.status(500).json({ message: "Error updating subscription plan", error: error.message });
    }
};

/**
 * Delete a subscription plan
 */
export const deleteSubscriptionPlan = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if plan exists
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        organizations: true
                    }
                }
            }
        });
        
        if (!plan) {
            return res.status(404).json({ message: "Subscription plan not found" });
        }
        
        // Check if plan is in use by organizations
        if (plan._count.organizations > 0) {
            return res.status(400).json({ 
                message: "Cannot delete a subscription plan that is in use", 
                organizationCount: plan._count.organizations 
            });
        }
        
        // Delete the plan
        await prisma.subscriptionPlan.delete({
            where: { id }
        });
        
        res.status(200).json({ message: "Subscription plan deleted successfully" });
    } catch (error) {
        console.error('Error deleting subscription plan:', error);
        res.status(500).json({ message: "Error deleting subscription plan", error: error.message });
    }
};

/**
 * Toggle subscription plan status (active/inactive)
 */
export const toggleSubscriptionPlanStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check if plan exists
        const plan = await prisma.subscriptionPlan.findUnique({
            where: { id }
        });
        
        if (!plan) {
            return res.status(404).json({ message: "Subscription plan not found" });
        }
        
        // Toggle isActive status
        const updatedPlan = await prisma.subscriptionPlan.update({
            where: { id },
            data: {
                isActive: !plan.isActive
            }
        });
        
        res.status(200).json({
            message: `Subscription plan ${updatedPlan.isActive ? 'activated' : 'deactivated'} successfully`,
            plan: updatedPlan
        });
    } catch (error) {
        console.error('Error toggling subscription plan status:', error);
        res.status(500).json({ message: "Error toggling subscription plan status", error: error.message });
    }
};
