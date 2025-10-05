import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import {
    sendOnboardingInvitationEmail,
    sendOnboardingChangeRequestEmail,
    sendEmployeeWelcomeEmail,
    sendEmployeeOnboardingSubmissionEmailToManager,
    sendNewEmployeeWelcomeEmail
} from '../../../util/sendEmail.js';
import { logUserActivity } from '../../../util/activityLogger.js';

const prisma = new PrismaClient();

// Create Initial Candidate
export const createCandidate = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').optional(),
    body('mobileNumber').optional(),
    body('departmentId').optional(),
    body('annualPackage').optional().isNumeric(),
    body('monthlySalary').optional().isNumeric(),
    body('managerId').optional(), // Add manager assignment
    body('hiredDate').optional().isISO8601(),

    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { 
                email, 
                firstName, 
                lastName, 
                mobileNumber, 
                departmentId, 
                annualPackage, 
                monthlySalary,
                managerId,
                hiredDate 
            } = req.body;

            const normalizeRelationId = (value) => {
                if (value === undefined || value === null) return null;
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    return trimmed.length ? trimmed : null;
                }
                return value || null;
            };

            const sanitizedDepartmentId = normalizeRelationId(departmentId);
            const sanitizedManagerId = normalizeRelationId(managerId);

            // Calculate annual/monthly salary if one is provided
            let calculatedAnnualPackage = annualPackage;
            let calculatedMonthlySalary = monthlySalary;

            if (annualPackage && !monthlySalary) {
                calculatedMonthlySalary = parseFloat((annualPackage / 12).toFixed(2));
            } else if (monthlySalary && !annualPackage) {
                calculatedAnnualPackage = parseFloat((monthlySalary * 12).toFixed(2));
            }

            // Check if email exists in users or candidates
            const existingUser = await prisma.user.findUnique({
                where: {
                    orgId_email: {
                        orgId: req.user.orgId,
                        email: email
                    }
                }
            });
            const existingCandidate = await prisma.onboardingCandidate.findUnique({
                where: { email }
            });

            if (existingUser) {
                return res.status(409).json({ error: 'Email already exists in this organization' });
            }
            
            // Validate manager exists if provided
            if (sanitizedManagerId) {
                const manager = await prisma.user.findFirst({
                    where: {
                        id: sanitizedManagerId,
                        orgId: req.user.orgId
                    }
                });
                if (!manager) {
                    return res.status(400).json({ error: 'Selected manager not found in organization' });
                }
            }

            // Validate department exists if provided
            if (sanitizedDepartmentId) {
                const department = await prisma.department.findFirst({
                    where: {
                        id: sanitizedDepartmentId,
                        orgId: req.user.orgId
                    }
                });
                if (!department) {
                    return res.status(400).json({ error: 'Selected department not found in organization' });
                }
            }
            
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
            
            if (existingCandidate) {
                const updatedCandidate = await prisma.onboardingCandidate.update({
                    where: { email },
                    data: {
                        firstName,
                        lastName,
                        mobileNumber,
                        status: 'INVITED',
                        verificationToken,
                        tokenExpiry,
                        orgId: req.user.orgId,
                        createdById: req.user.id,
                        departmentId: sanitizedDepartmentId,
                        managerId: sanitizedManagerId, // Add manager assignment
                        annualPackage: calculatedAnnualPackage,
                        monthlySalary: calculatedMonthlySalary,
                        hiredDate: hiredDate ? new Date(hiredDate) : null,
                        formData: {
                            initialData: {
                                departmentId: sanitizedDepartmentId,
                                managerId: sanitizedManagerId,
                                annualPackage: calculatedAnnualPackage,
                                monthlySalary: calculatedMonthlySalary,
                                hiredDate
                            }
                        }
                    }
                });
                return res.status(201).json({ message: 'Candidate updated successfully', candidate: updatedCandidate });
            }

            const candidate = await prisma.onboardingCandidate.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    mobileNumber,
                    status: 'INVITED',
                    verificationToken,
                    tokenExpiry,
                    orgId: req.user.orgId,
                    createdById: req.user.id,
                    departmentId: sanitizedDepartmentId,
                    managerId: sanitizedManagerId, // Add manager assignment
                    annualPackage: calculatedAnnualPackage,
                    monthlySalary: calculatedMonthlySalary,
                    hiredDate: hiredDate ? new Date(hiredDate) : null,
                    formData: {
                        initialData: {
                            departmentId: sanitizedDepartmentId,
                            managerId: sanitizedManagerId,
                            annualPackage: calculatedAnnualPackage,
                            monthlySalary: calculatedMonthlySalary,
                            hiredDate
                        }
                    }
                }
            });

            // Log activity
            await logUserActivity(
                req.user.id,
                req.user.orgId,
                'CREATE',
                'ONBOARDING_CANDIDATE',
                candidate.id,
                `Created onboarding candidate for ${firstName} ${lastName} (${email})`,
                null,
                req
            );

            res.status(201).json({
                message: 'Candidate created successfully',
                candidate: {
                    id: candidate.id,
                    email: candidate.email,
                    firstName: candidate.firstName,
                    lastName: candidate.lastName,
                    status: candidate.status,
                    managerId: candidate.managerId,
                    departmentId: candidate.departmentId,
                    annualPackage: candidate.annualPackage,
                    monthlySalary: candidate.monthlySalary
                }
            });
        } catch (error) {
            console.error('Error creating candidate:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

// Get All Candidates
export const getCandidates = async (req, res) => {
    try {
        const { status } = req.query;

        const whereClause = {
            orgId: req.user.orgId,
            ...(status ? { status } : {})
        };

        const candidates = await prisma.onboardingCandidate.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        res.status(200).json(candidates);
    } catch (error) {
        console.error('Error fetching candidates:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get Candidate by ID
export const getCandidateById = async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await prisma.onboardingCandidate.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                reviewedBy: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                manager: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                organization: {
                    select: {
                        name: true,
                        industry: true,
                        logo: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true
                    }
                }
            }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        if (candidate.orgId !== req.user.orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.status(200).json(candidate);
    } catch (error) {
        console.error('Error fetching candidate:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Get Candidate Review Data (Enhanced for detailed review)
export const getCandidateReviewData = async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await prisma.onboardingCandidate.findUnique({
            where: { id },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        mobileNumber: true
                    }
                },
                reviewedBy: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true
                    }
                },
                organization: {
                    select: {
                        name: true,
                        industry: true,
                        logo: true,
                        settings: true
                    }
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        description: true
                    }
                }
            }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        if (candidate.orgId !== req.user.orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Extract and structure form data for better review
        const formData = candidate.formData || {};
        
        // Structure the complete candidate profile for review
        const reviewData = {
            candidateInfo: {
                id: candidate.id,
                email: candidate.email,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                mobileNumber: candidate.mobileNumber,
                status: candidate.status,
                createdAt: candidate.createdAt,
                formSubmittedAt: candidate.formSubmittedAt
            },
            initialData: {
                annualPackage: candidate.annualPackage,
                hiredDate: candidate.hiredDate,
                departmentId: candidate.departmentId,
                department: candidate.department
            },
            submittedData: {
                personalInfo: {
                    firstName: formData.firstName || candidate.firstName,
                    lastName: formData.lastName || candidate.lastName,
                    mobileNumber: formData.mobileNumber || candidate.mobileNumber,
                    emergencyContact: formData.emergencyContact,
                    dateOfBirth: formData.dateOfBirth,
                    address: formData.address,
                    adharNumber: formData.adharNumber,
                    panNumber: formData.panNumber
                },
                bankDetails: formData.bankDetails || {},
                documents: formData.documents || {},
                additionalInfo: formData.additionalInfo || {}
            },
            reviewHistory: {
                reviewedBy: candidate.reviewedBy,
                reviewedAt: candidate.reviewedAt,
                rejectionReason: candidate.rejectionReason
            },
            metadata: {
                createdBy: candidate.createdBy,
                organization: candidate.organization,
                tokenExpiry: candidate.tokenExpiry,
                verificationToken: candidate.verificationToken ? 'Token exists' : 'No token'
            },
            // Add comprehensive validation status
            validationStatus: {
                personalInfoComplete: !!(
                    (formData.firstName || candidate.firstName) &&
                    (formData.lastName || candidate.lastName) &&
                    (formData.mobileNumber || candidate.mobileNumber) &&
                    formData.emergencyContact &&
                    formData.dateOfBirth &&
                    formData.address
                ),
                bankDetailsComplete: !!(
                    formData.bankDetails?.accountNumber &&
                    formData.bankDetails?.ifscCode &&
                    formData.bankDetails?.bankName &&
                    formData.bankDetails?.accountHolderName
                ),
                documentsProvided: !!(
                    formData.adharNumber || formData.panNumber
                ),
                readyForApproval: candidate.status === 'FORM_SUBMITTED'
            },
            // Add comparison between initial and submitted data
            dataComparison: {
                firstName: {
                    initial: candidate.firstName,
                    submitted: formData.firstName,
                    changed: formData.firstName && formData.firstName !== candidate.firstName
                },
                lastName: {
                    initial: candidate.lastName,
                    submitted: formData.lastName,
                    changed: formData.lastName && formData.lastName !== candidate.lastName
                },
                mobileNumber: {
                    initial: candidate.mobileNumber,
                    submitted: formData.mobileNumber,
                    changed: formData.mobileNumber && formData.mobileNumber !== candidate.mobileNumber
                }
            }
        };

        res.status(200).json({
            success: true,
            data: reviewData
        });
    } catch (error) {
        console.error('Error fetching candidate review data:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update Candidate Data (Allow editing of submitted information)
export const updateCandidateData = [
    body('firstName').optional().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').optional().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('mobileNumber').optional().isMobilePhone().withMessage('Invalid mobile number'),
    body('annualPackage').optional().isNumeric().withMessage('Annual package must be a number'),
    body('monthlySalary').optional().isNumeric().withMessage('Monthly salary must be a number'),
    body('departmentId').optional().isString(),
    body('managerId').optional().isString(),
    body('hiredDate').optional().isISO8601(),
    body('formData').optional().isObject(),

    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { id } = req.params;
            const updateData = req.body;

            const candidate = await prisma.onboardingCandidate.findUnique({
                where: { id },
                include: {
                    department: true
                }
            });

            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            if (candidate.orgId !== req.user.orgId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Prepare update object
            const updateObject = {};
            
            // Update basic fields if provided
            if (updateData.firstName) updateObject.firstName = updateData.firstName;
            if (updateData.lastName) updateObject.lastName = updateData.lastName;
            if (updateData.mobileNumber) updateObject.mobileNumber = updateData.mobileNumber;
            if (updateData.email) updateObject.email = updateData.email;
            if (updateData.departmentId) updateObject.departmentId = updateData.departmentId;
            if (updateData.managerId) updateObject.managerId = updateData.managerId;
            if (updateData.hiredDate) updateObject.hiredDate = new Date(updateData.hiredDate);

            // Handle salary calculations
            if (updateData.annualPackage !== undefined) {
                updateObject.annualPackage = updateData.annualPackage;
                if (!updateData.monthlySalary) {
                    updateObject.monthlySalary = updateData.annualPackage / 12;
                }
            }
            if (updateData.monthlySalary !== undefined) {
                updateObject.monthlySalary = updateData.monthlySalary;
                if (!updateData.annualPackage) {
                    updateObject.annualPackage = updateData.monthlySalary * 12;
                }
            }

            // Handle comprehensive form data updates
            if (updateData.formData) {
                const existingFormData = candidate.formData || {};
                updateObject.formData = {
                    ...existingFormData,
                    ...updateData.formData,
                    // Handle nested objects properly
                    bankDetails: updateData.formData.bankDetails ? {
                        ...existingFormData.bankDetails,
                        ...updateData.formData.bankDetails
                    } : existingFormData.bankDetails,
                    personalInfo: updateData.formData.personalInfo ? {
                        ...existingFormData.personalInfo,
                        ...updateData.formData.personalInfo
                    } : existingFormData.personalInfo
                };
            }

            // Handle individual field updates for easier API usage
            if (updateData.emergencyContact || updateData.dateOfBirth || updateData.address || 
                updateData.adharNumber || updateData.panNumber) {
                const existingFormData = candidate.formData || {};
                updateObject.formData = {
                    ...existingFormData,
                    ...updateData.emergencyContact && { emergencyContact: updateData.emergencyContact },
                    ...updateData.dateOfBirth && { dateOfBirth: updateData.dateOfBirth },
                    ...updateData.address && { address: updateData.address },
                    ...updateData.adharNumber && { adharNumber: updateData.adharNumber },
                    ...updateData.panNumber && { panNumber: updateData.panNumber }
                };
            }

            // Handle bank details updates with proper structure
            if (updateData.bankAccountNumber || updateData.bankIFSC || updateData.bankName || 
                updateData.accountHolderName || updateData.bankBranch) {
                const existingFormData = candidate.formData || {};
                const existingBankDetails = existingFormData.bankDetails || {};
                
                updateObject.formData = {
                    ...existingFormData,
                    bankDetails: {
                        ...existingBankDetails,
                        ...updateData.bankAccountNumber && { accountNumber: updateData.bankAccountNumber },
                        ...updateData.bankIFSC && { ifscCode: updateData.bankIFSC },
                        ...updateData.bankName && { bankName: updateData.bankName },
                        ...updateData.accountHolderName && { accountHolderName: updateData.accountHolderName }
                    }
                };
            }

            // Update the candidate
            const updatedCandidate = await prisma.onboardingCandidate.update({
                where: { id },
                data: updateObject,
                include: {
                    department: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    manager: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    createdBy: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });

            // Log activity
            await logUserActivity(
                req.user.id,
                req.user.orgId,
                'UPDATE',
                'ONBOARDING_CANDIDATE',
                candidate.id,
                `Updated onboarding data for ${candidate.firstName} ${candidate.lastName} (${candidate.email})`,
                {
                    updatedFields: Object.keys(updateObject),
                    updatedBy: `${req.user.firstName} ${req.user.lastName}`
                },
                req
            );

            res.status(200).json({
                success: true,
                message: 'Candidate data updated successfully',
                data: updatedCandidate
            });
        } catch (error) {
            console.error('Error updating candidate data:', error);
            res.status(500).json({ 
                success: false,
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
];

// Send Invitation Email
export const sendInvitation = async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await prisma.onboardingCandidate.findUnique({
            where: { id },
            include: {
                organization: true
            }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        if (candidate.orgId !== req.user.orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Regenerate token if needed
        let verificationToken = candidate.verificationToken;
        let tokenExpiry = candidate.tokenExpiry;

        if (!verificationToken || new Date(tokenExpiry) < new Date()) {
            verificationToken = crypto.randomBytes(32).toString('hex');
            tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await prisma.onboardingCandidate.update({
                where: { id },
                data: { verificationToken, tokenExpiry }
            });
        }

        // Send invitation email
        const onboardingUrl = `${process.env.CLIENT_URL}/onboarding/${verificationToken}`;

        console.log('=== ONBOARDING INVITATION DEBUG ===');
        console.log('Candidate ID:', candidate.id);
        console.log('Candidate Email:', candidate.email);
        console.log('Verification Token from DB:', candidate.verificationToken);
        console.log('New Verification Token:', verificationToken);
        console.log('Onboarding URL:', onboardingUrl);
        console.log('=====================================');

        await sendOnboardingInvitationEmail(
            candidate.email,
            candidate.firstName,
            onboardingUrl,
            candidate.organization.name
        );

        // Update candidate status if needed
        if (candidate.status !== 'INVITED') {
            await prisma.onboardingCandidate.update({
                where: { id },
                data: { status: 'INVITED' }
            });
        }

        // Log activity
        await logUserActivity(
            req.user.id,
            req.user.orgId,
            'UPDATE',
            'ONBOARDING_CANDIDATE',
            candidate.id,
            `Sent onboarding invitation to ${candidate.firstName} ${candidate.lastName} (${candidate.email})`,
            null,
            req
        );

        res.status(200).json({ message: 'Invitation sent successfully' });
    } catch (error) {
        console.error('Error sending invitation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Verify Token & Get Candidate Form (Public endpoint)
export const verifyOnboardingToken = async (req, res) => {
    try {
        const { token } = req.params;

        const candidate = await prisma.onboardingCandidate.findFirst({
            where: {
                verificationToken: token
            },
            include: {
                organization: {
                    select: {
                        name: true,
                        industry: true,
                        logo: true
                    }
                }
            }
        });

        if (!candidate) {
            return res.status(410).json({
                error: 'This onboarding process has been aborted. Please refer to a new email or contact your HR department.',
                aborted: true
            });
        }

        // Check if the onboarding process has been aborted
        if (candidate.status === 'ABORTED') {
            return res.status(410).json({
                error: 'This onboarding process has been aborted. Please refer to a new email or contact your HR department.',
                aborted: true
            });
        }

        // Check if token is expired
        if (new Date(candidate.tokenExpiry) < new Date()) {
            return res.status(410).json({
                error: 'This onboarding invitation has expired. Please contact your HR department for a new invitation.',
                expired: true
            });
        }

        res.status(200).json({
            candidateId: candidate.id,
            email: candidate.email,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            mobileNumber: candidate.mobileNumber,
            organizationName: candidate.organization.name,
            organizationIndustry: candidate.organization.industry,
            organizationLogo: candidate.organization.logo,
            formData: candidate.formData || null,
            status: candidate.status
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Submit Candidate Form (Public endpoint)
export const submitCandidateForm = [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),  
    body('mobileNumber').isMobilePhone().withMessage('Valid mobile number required'),
    body('emergencyContact').isMobilePhone().withMessage('Valid emergency contact required'),
    body('dateOfBirth').isISO8601().withMessage('Valid date of birth required'),
    body('address').isLength({ min: 10 }).withMessage('Complete address required'),
    body('bankDetails.accountNumber').isLength({ min: 8 }).withMessage('Valid account number required'),
    body('bankDetails.ifscCode').isLength({ min: 11, max: 11 }).withMessage('Valid IFSC code required'),
    body('bankDetails.bankName').notEmpty().withMessage('Bank name is required'),
    body('bankDetails.accountHolderName').notEmpty().withMessage('Account holder name required'),

    async (req, res) => {
        try {
            // Validate input
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { token } = req.params;
            const formData = req.body;

            const candidate = await prisma.onboardingCandidate.findFirst({
                where: {
                    verificationToken: token
                },
                include: {
                    organization: true,
                    createdBy: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                }
            });

            if (!candidate) {
                return res.status(410).json({
                    error: 'This onboarding process has been aborted. Please refer to a new email or contact your HR department.',
                    aborted: true
                });
            }

            // Check if the onboarding process has been aborted
            if (candidate.status === 'ABORTED') {
                return res.status(410).json({
                    error: 'This onboarding process has been aborted. Please refer to a new email or contact your HR department.',
                    aborted: true
                });
            }

            // Check if token is expired
            if (new Date(candidate.tokenExpiry) < new Date()) {
                return res.status(410).json({
                    error: 'This onboarding invitation has expired. Please contact your HR department for a new invitation.',
                    expired: true
                });
            }

            // Extract and structure the submitted data properly
            const structuredFormData = {
                ...formData,
                // Ensure mobile number is properly stored
                mobileNumber: formData.mobileNumber,
                // Ensure bank details are properly structured
                bankDetails: {
                    accountNumber: formData.bankDetails?.accountNumber,
                    ifscCode: formData.bankDetails?.ifscCode,
                    bankName: formData.bankDetails?.bankName,
                    accountHolderName: formData.bankDetails?.accountHolderName
                }
            };

            // Update candidate with form data and mobile number
            const updatedCandidate = await prisma.onboardingCandidate.update({
                where: { id: candidate.id },
                data: {
                    formData: structuredFormData,
                    mobileNumber: formData.mobileNumber, // Store mobile number at candidate level too
                    status: 'FORM_SUBMITTED',
                    formSubmittedAt: new Date()
                }
            });

            await sendEmployeeOnboardingSubmissionEmailToManager(
                candidate.email, 
                candidate.firstName, 
                candidate.createdBy.email, 
                candidate.createdBy.firstName, 
                candidate.organization.name
            );

            res.status(200).json({
                message: 'Form submitted successfully',
                status: updatedCandidate.status
            });
        } catch (error) {
            console.error('Error submitting form:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

// Approve Candidate Form
export const approveCandidate = [
    body('departmentId').optional(),
    body('managerId').optional(),
    body('roleId').optional(),
    body('annualPackage').optional().isNumeric(),
    body('monthlySalary').optional().isNumeric(),
    
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { id } = req.params;
            const { departmentId, managerId, roleId, annualPackage, monthlySalary } = req.body;

            const candidate = await prisma.onboardingCandidate.findUnique({
                where: { id },
                include: {
                    organization: true
                }
            });

            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            if (candidate.orgId !== req.user.orgId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            if (candidate.status !== 'FORM_SUBMITTED' && candidate.status !== 'UNDER_REVIEW') {
                return res.status(400).json({ error: 'Candidate is not in reviewable state' });
            }

            // Validate department if provided
            if (departmentId) {
                const department = await prisma.department.findFirst({
                    where: { id: departmentId, orgId: candidate.orgId }
                });
                if (!department) {
                    return res.status(400).json({ error: 'Invalid department specified' });
                }
            }

            // Validate manager if provided
            if (managerId) {
                const manager = await prisma.user.findFirst({
                    where: { id: managerId, orgId: candidate.orgId }
                });
                if (!manager) {
                    return res.status(400).json({ error: 'Invalid manager specified' });
                }
            }

            // Validate role if provided
            if (roleId) {
                const role = await prisma.role.findFirst({
                    where: { id: roleId, orgId: candidate.orgId }
                });
                if (!role) {
                    return res.status(400).json({ error: 'Invalid role specified' });
                }
            }

            // Calculate salary if provided
            let calculatedAnnualPackage = annualPackage || candidate.annualPackage;
            let calculatedMonthlySalary = monthlySalary || candidate.monthlySalary;

            if (annualPackage && !monthlySalary) {
                calculatedMonthlySalary = parseFloat((annualPackage / 12).toFixed(2));
            } else if (monthlySalary && !annualPackage) {
                calculatedAnnualPackage = parseFloat((monthlySalary * 12).toFixed(2));
            }

            // Update candidate with approval details
            const updateData = {
                status: 'APPROVED',
                reviewedById: req.user.id,
                reviewedAt: new Date()
            };

            // Update department if provided
            if (departmentId !== undefined) {
                updateData.departmentId = departmentId;
            }

            // Update manager if provided
            if (managerId !== undefined) {
                updateData.managerId = managerId;
            }

            // Update salary details if provided
            if (calculatedAnnualPackage !== undefined) {
                updateData.annualPackage = calculatedAnnualPackage;
            }
            if (calculatedMonthlySalary !== undefined) {
                updateData.monthlySalary = calculatedMonthlySalary;
            }

            // Store role in formData for later use during completion
            if (roleId) {
                const existingFormData = candidate.formData || {};
                updateData.formData = {
                    ...existingFormData,
                    approvalData: {
                        ...existingFormData.approvalData,
                        roleId: roleId,
                        departmentId: departmentId || candidate.departmentId,
                        managerId: managerId || candidate.managerId,
                        annualPackage: calculatedAnnualPackage,
                        monthlySalary: calculatedMonthlySalary
                    }
                };
            }

            await prisma.onboardingCandidate.update({
                where: { id },
                data: updateData
            });

            // Log activity
            await logUserActivity(
                req.user.id,
                req.user.orgId,
                'APPROVE',
                'ONBOARDING_CANDIDATE',
                candidate.id,
                `Approved onboarding for ${candidate.firstName} ${candidate.lastName} (${candidate.email})`,
                {
                    updatedFields: Object.keys(updateData),
                    approvedBy: `${req.user.firstName} ${req.user.lastName}`
                },
                req
            );

            res.status(200).json({ 
                message: 'Candidate approved successfully',
                data: {
                    status: 'APPROVED',
                    departmentId: departmentId || candidate.departmentId,
                    managerId: managerId || candidate.managerId,
                    annualPackage: calculatedAnnualPackage,
                    monthlySalary: calculatedMonthlySalary
                }
            });
        } catch (error) {
            console.error('Error approving candidate:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

// Request Changes from Candidate
export const requestChanges = [
    body('feedback').notEmpty().withMessage('Feedback is required'),

    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { id } = req.params;
            const { feedback } = req.body;

            const candidate = await prisma.onboardingCandidate.findUnique({
                where: { id },
                include: {
                    organization: true
                }
            });

            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            if (candidate.orgId !== req.user.orgId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Regenerate token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            // Update candidate status
            await prisma.onboardingCandidate.update({
                where: { id },
                data: {
                    status: 'INVITED',
                    verificationToken,
                    tokenExpiry,
                    reviewedById: req.user.id,
                    reviewedAt: new Date(),
                    rejectionReason: feedback
                }
            });

            // Send feedback email with new token
            const onboardingUrl = `${process.env.CLIENT_URL}/onboarding/${verificationToken}`;

            await sendOnboardingChangeRequestEmail(
                candidate.email,
                candidate.firstName,
                onboardingUrl,
                feedback,
                candidate.organization.name,
                `${req.user.firstName} ${req.user.lastName}`
            );

            // Log activity
            await logUserActivity(
                req.user.id,
                req.user.orgId,
                'UPDATE',
                'ONBOARDING_CANDIDATE',
                candidate.id,
                `Requested changes from ${candidate.firstName} ${candidate.lastName} (${candidate.email}): ${feedback}`,
                null,
                req
            );

            res.status(200).json({ message: 'Change request sent successfully' });
        } catch (error) {
            console.error('Error requesting changes:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

// Mark Candidate Under Review
export const markUnderReview = async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await prisma.onboardingCandidate.findUnique({
            where: { id }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        if (candidate.orgId !== req.user.orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (candidate.status !== 'FORM_SUBMITTED') {
            return res.status(400).json({ error: 'Candidate has not submitted the form yet' });
        }

        // Update candidate status
        await prisma.onboardingCandidate.update({
            where: { id },
            data: {
                status: 'UNDER_REVIEW',
                reviewedById: req.user.id,
                reviewedAt: new Date()
            }
        });

        // Log activity
        await logUserActivity(
            req.user.id,
            req.user.orgId,
            'UPDATE',
            'ONBOARDING_CANDIDATE',
            candidate.id,
            `Marked ${candidate.firstName} ${candidate.lastName} (${candidate.email}) under review`,
            null,
            req
        );

        res.status(200).json({ 
            success: true, 
            message: 'Candidate marked under review successfully' 
        });
    } catch (error) {
        console.error('Error marking candidate under review:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Reject Candidate
export const rejectCandidate = [
    body('reason').notEmpty().withMessage('Rejection reason is required'),

    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { id } = req.params;
            const { reason } = req.body;

            const candidate = await prisma.onboardingCandidate.findUnique({
                where: { id }
            });

            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            if (candidate.orgId !== req.user.orgId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Update candidate status
            await prisma.onboardingCandidate.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    reviewedById: req.user.id,
                    reviewedAt: new Date(),
                    rejectionReason: reason
                }
            });

            // Log activity
            await logUserActivity(
                req.user.id,
                req.user.orgId,
                'REJECT',
                'ONBOARDING_CANDIDATE',
                candidate.id,
                `Rejected onboarding for ${candidate.firstName} ${candidate.lastName} (${candidate.email}): ${reason}`,
                null,
                req
            );

            res.status(200).json({ message: 'Candidate rejected successfully' });
        } catch (error) {
            console.error('Error rejecting candidate:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

// Complete Onboarding
export const completeOnboarding = [
    body('departmentId').optional(),
    body('roleId').notEmpty().withMessage('Role is required'),
    body('managerId').optional(),
    body('monthlySalary').optional().isNumeric().withMessage('Monthly salary must be a number'),
    body('annualPackage').optional().isNumeric().withMessage('Annual package must be a number'),
    body('salaryTemplateId').optional().isString().withMessage('Salary template must be a string'),

    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            const { id } = req.params;
            let { 
                departmentId, 
                roleId, 
                managerId, 
                monthlySalary, 
                annualPackage,
                salaryTemplateId
            } = req.body;

            const candidate = await prisma.onboardingCandidate.findUnique({
                where: { id },
                include: {
                    organization: true
                }
            });

            if (!candidate) {
                return res.status(404).json({ error: 'Candidate not found' });
            }

            if (candidate.orgId !== req.user.orgId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            if (candidate.status !== 'APPROVED') {
                return res.status(400).json({ error: 'Candidate is not approved yet' });
            }

            // Extract required fields from candidate and formData
            const formData = candidate.formData || {};
            const approvalData = formData.approvalData || {};
            
            // Use department from request, approval data, candidate, or initial form data
            if (!departmentId) {
                departmentId = approvalData.departmentId || candidate.departmentId || formData.departmentId;
            }
            
            // Use manager from request, approval data, candidate, or initial form data
            if (!managerId) {
                managerId = approvalData.managerId || candidate.managerId || formData.managerId;
            }

            // Use role from approval data if not provided in request
            if (!roleId && approvalData.roleId) {
                roleId = approvalData.roleId;
            }

            // Handle salary calculations - prioritize request data, then approval data, then candidate data
            if (!monthlySalary && !annualPackage) {
                if (approvalData.monthlySalary) {
                    monthlySalary = parseFloat(approvalData.monthlySalary.toFixed(2));
                    annualPackage = parseFloat((approvalData.monthlySalary * 12).toFixed(2));
                } else if (approvalData.annualPackage) {
                    annualPackage = parseFloat(approvalData.annualPackage.toFixed(2));
                    monthlySalary = parseFloat((approvalData.annualPackage / 12).toFixed(2));
                } else if (candidate.monthlySalary) {
                    monthlySalary = parseFloat(candidate.monthlySalary.toFixed(2));
                    annualPackage = parseFloat((candidate.monthlySalary * 12).toFixed(2));
                } else if (candidate.annualPackage) {
                    annualPackage = parseFloat(candidate.annualPackage.toFixed(2));
                    monthlySalary = parseFloat((candidate.annualPackage / 12).toFixed(2));
                }
            } else if (monthlySalary && !annualPackage) {
                annualPackage = parseFloat((monthlySalary * 12).toFixed(2));
            } else if (annualPackage && !monthlySalary) {
                monthlySalary = parseFloat((annualPackage / 12).toFixed(2));
            }

            // Validate that the role exists and belongs to the organization
            const role = await prisma.role.findFirst({
                where: { id: roleId, orgId: candidate.orgId }
            });

            if (!role) {
                return res.status(400).json({ error: 'Invalid role specified' });
            }

            if (salaryTemplateId) {
                const salaryTemplate = await prisma.salaryTemplate.findFirst({
                    where: {
                        id: salaryTemplateId,
                        orgId: candidate.orgId,
                        isActive: true
                    }
                });

                if (!salaryTemplate) {
                    return res.status(400).json({ error: 'Invalid salary template specified' });
                }
            }

            // Validate department if provided
            if (departmentId) {
                const department = await prisma.department.findFirst({
                    where: { id: departmentId, orgId: candidate.orgId }
                });

                if (!department) {
                    return res.status(400).json({ error: 'Invalid department specified' });
                }
            }

            // Validate manager if provided
            if (managerId) {
                const manager = await prisma.user.findFirst({
                    where: { id: managerId, orgId: candidate.orgId }
                });

                if (!manager) {
                    return res.status(400).json({ error: 'Invalid manager specified' });
                }
            }

            // Check if employee ID or email already exists
            const existingUser = await prisma.user.findFirst({
                where: {
                    orgId: candidate.orgId,
                    email: candidate.email
                }
            });

            if (existingUser) {
                return res.status(400).json({ 
                    error: 'An employee with this email already exists in your organization' 
                });
            }

            // Generate employee ID (same logic as in createEmployee)
            const organization = candidate.organization;
            const date = new Date();
            const nameInitials = organization.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
            let employeeId = nameInitials +
                date.getFullYear().toString().slice(-2) +
                (date.getMonth() + 1).toString().padStart(2, '0') +
                Math.floor(Math.random() * 1000).toString().padStart(3, '0');

            // Check if generated employeeId exists
            const existingEmployeeId = await prisma.user.findFirst({
                where: {
                    orgId: candidate.orgId,
                    employeeId
                }
            });
            
            if (existingEmployeeId) {
                // Generate a new one with random suffix
                employeeId = nameInitials +
                    date.getFullYear().toString().slice(-2) +
                    (date.getMonth() + 1).toString().padStart(2, '0') +
                    Math.floor(Math.random() * 9000 + 1000).toString();
            }

            // Create user from candidate (matching the createEmployee logic exactly)
            const user = await prisma.user.create({
                data: {
                    orgId: candidate.orgId,
                    departmentId: departmentId || null,
                    managerId: managerId || null,
                    email: candidate.email,
                    firstName: formData.firstName || candidate.firstName,
                    lastName: formData.lastName || candidate.lastName,
                    employeeId,
                    mobileNumber: formData.mobileNumber || candidate.mobileNumber,
                    hiredDate: candidate.hiredDate || new Date(),
                    dateOfBirth: formData.dateOfBirth ? new Date(formData.dateOfBirth) : null,
                    address: formData.address,
                    adharNumber: formData.adharNumber,
                    emergencyContact: formData.emergencyContact,
                    panNumber: formData.panNumber,
                    status: 'inactive', // Same as createEmployee
                    annualPackage: annualPackage || 0,
                    monthlySalary: monthlySalary || 0,
                    salaryTemplateId: salaryTemplateId || null,
                    roles: {
                        create: [{
                            role: { connect: { id: roleId } }
                        }]
                    },
                    // Create bank details if provided (same structure as createEmployee)
                    ...(formData?.bankDetails?.accountNumber && formData?.bankDetails?.ifscCode && 
                        formData?.bankDetails?.bankName && formData?.bankDetails?.accountHolderName ? {
                        bankDetails: {
                            create: {
                                accountHolder: formData.bankDetails.accountHolderName,
                                accountNumber: formData.bankDetails.accountNumber,
                                ifscCode: formData.bankDetails.ifscCode,
                                bankName: formData.bankDetails.bankName
                            }
                        }
                    } : {}),
                    // Create salary parameters if salary is provided (same as createEmployee)
                    ...(!salaryTemplateId && (annualPackage || monthlySalary) ? {
                        salaryParameter: {
                            create: {
                                hraPercentage: 40,
                                daPercentage: 10,
                                taPercentage: 10,
                                pfPercentage: 12,
                                taxPercentage: 10,
                                insuranceFixed: 1000
                            }
                        }
                    } : {})
                },
                include: {
                    department: {
                        include: {
                            departmentHead: {
                                select: {
                                    firstName: true,
                                    lastName: true,
                                    email: true
                                }
                            }
                        }
                    },
                    roles: {
                        include: {
                            role: true
                        }
                    },
                    bankDetails: true,
                    salaryParameter: true,
                    manager: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });

            // Generate verification token (same as createEmployee)
            const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            // Create leave balances (same as createEmployee)
            const leaveTypes = await prisma.leaveType.findMany({
                where: { orgId: candidate.orgId },
            });
            
            if (leaveTypes.length > 0) {
                await prisma.leaveBalance.createMany({
                    data: leaveTypes.map(leaveType => ({
                        userId: user.id,
                        leaveTypeId: leaveType.id,
                        usedDays: 0,
                        remainingDays: leaveType.annualLimit,
                        year: new Date().getFullYear()
                    }))
                });
            }

            // Update candidate status
            await prisma.onboardingCandidate.update({
                where: { id },
                data: {
                    status: 'ONBOARDED'
                }
            });

            // Send welcome email (similar to createEmployee)
            if (user.manager && user.manager.email) {
                // Fetch team members from the same department
                const teamMembers = await prisma.user.findMany({
                    where: {
                        departmentId: user.departmentId,
                        id: { not: user.id }
                    },
                    take: 5,
                    select: {
                        firstName: true,
                        lastName: true,
                        roles: {
                            include: {
                                role: true
                            }
                        }
                    }
                });

                const formattedTeamMembers = teamMembers.map(member => ({
                    name: `${member.firstName} ${member.lastName}`,
                    role: member.roles.length > 0 ? member.roles[0].role.name : 'Team Member'
                }));

                await sendNewEmployeeWelcomeEmail(
                    user.email,
                    `${user.firstName} ${user.lastName}`,
                    user.manager.email,
                    user.manager.firstName + ' ' + user.manager.lastName,
                    user.department?.departmentHead ? {
                        email: user.department.departmentHead.email,
                        name: user.department.departmentHead.firstName + ' ' + user.department.departmentHead.lastName
                    } : null,
                    formattedTeamMembers,
                    {
                        employeeId: user.employeeId,
                        department: user.department?.name || 'Not Assigned',
                        hiredDate: user.hiredDate,
                        verificationToken: verificationToken
                    },
                    organization.name
                );
            }

            // Update user with verification token
            await prisma.user.update({
                where: { id: user.id },
                data: { verificationToken },
            });

            // Log activity
            await logUserActivity(
                req.user.id,
                req.user.orgId,
                'CREATE',
                'USER',
                user.id,
                `Completed onboarding for ${candidate.firstName} ${candidate.lastName} (${candidate.email}) - Employee ID: ${employeeId}`,
                null,
                req
            );

            res.status(200).json({
                message: 'Onboarding completed successfully',
                user: {
                    id: user.id,
                    email: user.email,
                    employeeId: user.employeeId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    department: user.department?.name,
                    manager: user.manager ? `${user.manager.firstName} ${user.manager.lastName}` : null
                }
            });
        } catch (error) {
            console.error('Error completing onboarding:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
];

// Delete Candidate (Mark as Aborted)
export const deleteCandidate = async (req, res) => {
    try {
        const { id } = req.params;

        const candidate = await prisma.onboardingCandidate.findUnique({
            where: { id }
        });

        if (!candidate) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        if (candidate.orgId !== req.user.orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Only allow deletion if candidate hasn't responded yet (status = 'INVITED')
        if (candidate.status !== 'INVITED') {
            return res.status(400).json({
                error: `Cannot delete candidate. Candidate has already ${candidate.status.toLowerCase().replace('_', ' ')}.`
            });
        }

        // Mark as aborted instead of deleting (for audit trail)
        await prisma.onboardingCandidate.update({
            where: { id },
            data: {
                status: 'ABORTED',
                reviewedById: req.user.id,
                reviewedAt: new Date(),
                verificationToken: null, // Invalidate the token
                tokenExpiry: null
            }
        });

        // Log activity
        await logUserActivity(
            req.user.id,
            req.user.orgId,
            'ABORT',
            'ONBOARDING_CANDIDATE',
            candidate.id,
            `Aborted onboarding process for unresponsive candidate ${candidate.firstName} ${candidate.lastName} (${candidate.email})`,
            null,
            req
        );

        res.status(200).json({ message: 'Candidate onboarding process aborted successfully. Their invitation link has been invalidated.' });
    } catch (error) {
        console.error('Error aborting candidate onboarding:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
