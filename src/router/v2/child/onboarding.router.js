import express from "express";
import {
    createCandidate,
    getCandidates,
    getCandidateById,
    getCandidateReviewData,
    updateCandidateData,
    sendInvitation,
    verifyOnboardingToken,
    submitCandidateForm,
    approveCandidate,
    requestChanges,
    rejectCandidate,
    completeOnboarding,
    deleteCandidate,
    markUnderReview
} from "../../../controller/v2/onboarding/onboarding.controller.js";
import validateToken from "../../../middleware/validateToken.js";

const router = express.Router();

// Public routes (no authentication required)
router.get("/verify/:token", verifyOnboardingToken);
router.post("/submit/:token", submitCandidateForm);

// Protected routes (authentication required)
router.use(validateToken); // Apply authentication middleware to all routes below

// Candidate management routes
router.get("/", getCandidates);
router.get("/:id", getCandidateById);
router.get("/:id/review", getCandidateReviewData); // NEW: Enhanced review data
router.post("/", createCandidate);
router.put("/:id", updateCandidateData); // NEW: Update candidate data
router.delete("/:id", deleteCandidate);

// Invitation management
router.post("/:id/invite", sendInvitation);

// Review and approval routes
router.post("/:id/mark-review", markUnderReview); // NEW: Mark under review
router.post("/:id/approve", approveCandidate);
router.post("/:id/request-changes", requestChanges);
router.post("/:id/reject", rejectCandidate);

// Complete onboarding
router.post("/:id/complete", completeOnboarding);

export default router;
