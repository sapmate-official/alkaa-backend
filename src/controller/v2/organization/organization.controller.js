import prisma from '../../../db/connectDb.js';
import { body, validationResult } from 'express-validator';

// Get all organizations
const getOrganization = async (req, res) => {
    try {
        const organizations = await prisma.organization.findMany({
            include: {
                users: {
                    select:{
                        firstName: true,
                        lastName: true,
                    }
                }
            }
        });
        res.status(200).json(organizations);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: error.message });
    }
};
//get organisation by id
const getOrganizationById = async (req, res) => {
    try {
        const id = req.params.id;
        const organization = await prisma.organization.findUnique({
            where: {
                id: id
            },
            include: {
                users: true
            }
        });
        res.status(200).json(organization);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Create a new organization
const createOrganization = [
    body('name').notEmpty().withMessage('Name is required'),
    body('industry').optional().notEmpty().withMessage('Industry is required'),
    body('subscriptionPlan').notEmpty().withMessage('Subscription Plan is required'),
    body('subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),
    body('settings').optional().isJSON().withMessage('Settings must be a valid JSON'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, industry, subscriptionPlan, subscriptionEnd, isActive, settings } = req.body;
        try {
            const newOrganization = await prisma.organization.create({
                data: {
                    name,
                    industry,
                    subscriptionPlan,
                    subscriptionEnd,
                    isActive,
                    settings
                }
            });
            console.log(newOrganization);
            
            res.status(201).json(newOrganization);
        } catch (error) {
            console.log(error);
            
            res.status(500).json({ error: error.message });
        }
    }
];

// Update an organization
const updateOrganization = [
    body('id').notEmpty().withMessage('ID is required'),
    body('name').optional().notEmpty().withMessage('Name is required'),
    body('industry').optional().notEmpty().withMessage('Industry is required'),
    body('subscriptionPlan').optional().notEmpty().withMessage('Subscription Plan is required'),
    body('subscriptionEnd').optional().isISO8601().withMessage('Subscription End must be a valid date'),
    body('isActive').optional().isBoolean().withMessage('IsActive must be a boolean'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id, name, industry, subscriptionPlan, subscriptionEnd, isActive, settings } = req.body;
        try {
            const updatedOrganization = await prisma.organization.update({
                where: { id },
                data: {
                    ...(name && { name }),
                    ...(industry && { industry }),
                    ...(subscriptionPlan && { subscriptionPlan }),
                    ...(subscriptionEnd && { subscriptionEnd }),
                    ...(isActive !== undefined && { isActive }),
                    ...(settings && { settings })
                }
            });
            res.status(200).json(updatedOrganization);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
];

// Delete an organization
const deleteOrganization = [
    body('id').notEmpty().withMessage('ID is required'),

    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.body;
        try {
            await prisma.organization.delete({
                where: { id }
            });
            res.status(204).end();
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
];

export {
    getOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationById
};