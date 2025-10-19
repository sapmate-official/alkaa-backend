import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import prisma from "../db/connectDb.js";

dotenv.config();

// Permission definitions extracted from payrollValidators.js
const PAYROLL_PERMISSIONS = [
    // Core access
    {
        name: "Access Payroll",
        key: "access_payroll",
        action: "read",
        description: "Baseline access to payroll dashboards and data.",
        module: "payroll"
    },
    {
        name: "Admin Access",
        key: "admin_access",
        action: "admin",
        description: "Full administrative control across the platform.",
        module: "system"
    },
    // Payslip visibility
    {
        name: "View Self Salary Slip",
        key: "view_salary_slip_to_myself",
        action: "read",
        description: "Allow users to view their own salary slips.",
        module: "payroll"
    },
    {
        name: "View Subordinate Salary Slip",
        key: "view_salary_slip_of_subordinates",
        action: "read",
        description: "Allow managers to view salary slips of direct reports.",
        module: "payroll"
    },
    {
        name: "View All Salary Slips",
        key: "view_salary_slip_of_all",
        action: "read",
        description: "Allow viewing salary slips for every employee in the organization.",
        module: "payroll"
    },
    // Salary generation and payouts
    {
        name: "Generate Self Salary",
        key: "generate_salary_to_myself",
        action: "generate",
        description: "Allow users to generate their own salary records.",
        module: "payroll"
    },
    {
        name: "Generate All Salaries",
        key: "generate_salary_of_all",
        action: "generate",
        description: "Allow bulk salary generation for the entire organization.",
        module: "payroll"
    },
    {
        name: "Bulk Generate Salaries",
        key: "bulk_generate_salaries",
        action: "execute",
        description: "Allow operating the bulk salary generation workflow.",
        module: "payroll"
    },
    {
        name: "Send Self Salary",
        key: "send_salary_to_myself",
        action: "execute",
        description: "Allow initiating payout for personal salary records.",
        module: "payroll"
    },
    {
        name: "Send Subordinate Salaries",
        key: "send_salary_to_subordinates",
        action: "execute",
        description: "Allow initiating payouts for direct reports.",
        module: "payroll"
    },
    {
        name: "Send All Salaries",
        key: "send_salary_to_all",
        action: "execute",
        description: "Allow initiating payouts for every employee salary.",
        module: "payroll"
    },
    // Payroll cycle lifecycle
    {
        name: "Create Payroll Cycle",
        key: "create_payroll_cycle",
        action: "create",
        description: "Allow creating new payroll cycles.",
        module: "payroll"
    },
    {
        name: "Start Payroll Cycle",
        key: "start_payroll_cycle",
        action: "execute",
        description: "Allow kicking off payroll cycle processing.",
        module: "payroll"
    },
    {
        name: "Submit Payroll Cycle",
        key: "submit_payroll_cycle",
        action: "submit",
        description: "Allow submitting payroll cycles for approval.",
        module: "payroll"
    },
    {
        name: "Approve Payroll Cycle",
        key: "approve_payroll_cycle",
        action: "approve",
        description: "Allow approving completed payroll cycles.",
        module: "payroll"
    },
    {
        name: "Delete Payroll Cycle",
        key: "delete_payroll_cycle",
        action: "delete",
        description: "Allow deleting existing payroll cycles.",
        module: "payroll"
    },
    {
        name: "Review Payroll Cycle",
        key: "review_payroll_cycles",
        action: "review",
        description: "Allow reviewing payroll cycles before approval.",
        module: "payroll"
    },
    {
        name: "View Payroll Cycles",
        key: "view_payroll_cycles",
        action: "read",
        description: "Allow viewing list and status of payroll cycles.",
        module: "payroll"
    },
    {
        name: "View Payroll Statistics",
        key: "view_payroll_statistics",
        action: "read",
        description: "Allow accessing payroll level analytics and statistics.",
        module: "payroll"
    },
    {
        name: "View All Payroll Records",
        key: "view_all_payroll",
        action: "read",
        description: "Allow viewing every payroll record for the organization.",
        module: "payroll"
    },
    {
        name: "Manage Payroll",
        key: "manage_payroll",
        action: "manage",
        description: "Allow managing payroll configurations and records.",
        module: "payroll"
    },
    {
        name: "Edit Payroll",
        key: "edit_payroll",
        action: "update",
        description: "Allow editing generated payroll data before approval.",
        module: "payroll"
    },
    // Payroll disputes
    {
        name: "View Team Salary Disputes",
        key: "view_salary_disputes_team",
        action: "read",
        description: "Allow viewing salary disputes raised within managed teams.",
        module: "payroll"
    },
    {
        name: "Manage Team Salary Disputes",
        key: "manage_salary_disputes_team",
        action: "manage",
        description: "Allow managing salary disputes for managed teams.",
        module: "payroll"
    },
    {
        name: "Resolve Team Salary Disputes",
        key: "resolve_salary_disputes_team",
        action: "resolve",
        description: "Allow resolving salary disputes within managed teams.",
        module: "payroll"
    },
    {
        name: "View Organization Salary Disputes",
        key: "view_salary_disputes_all",
        action: "read",
        description: "Allow viewing all salary disputes across the organization.",
        module: "payroll"
    },
    {
        name: "Manage Organization Salary Disputes",
        key: "manage_salary_disputes_all",
        action: "manage",
        description: "Allow managing salary disputes raised by any employee.",
        module: "payroll"
    },
    {
        name: "Resolve Organization Salary Disputes",
        key: "resolve_salary_disputes_all",
        action: "resolve",
        description: "Allow resolving salary disputes raised by any employee.",
        module: "payroll"
    }
];

async function loadSubcategories() {
    return prisma.permissionSubcategory.findMany({
        include: {
            category: true
        }
    });
}

function findSubcategoryForPermission(permission, subcategories) {
    const targetTokens = new Set([
        permission.module?.toLowerCase(),
        ...permission.key.split("_")
    ].filter(Boolean));

    for (const subcategory of subcategories) {
        const name = subcategory.name?.toLowerCase() || "";
        const categoryName = subcategory.category?.name?.toLowerCase() || "";

        if (name.includes("payroll") || categoryName.includes("payroll")) {
            if (permission.module === "payroll" || permission.key.includes("payroll")) {
                return subcategory.id;
            }
        }

        if (permission.key.includes("disputes") && (name.includes("dispute") || categoryName.includes("dispute"))) {
            return subcategory.id;
        }

        if (["salary", "payout", "cycle"].some(token => name.includes(token) || categoryName.includes(token))) {
            if (permission.key.includes("salary") || permission.key.includes("cycle")) {
                return subcategory.id;
            }
        }

        for (const token of targetTokens) {
            if (!token) continue;
            if (name.includes(token) || categoryName.includes(token)) {
                return subcategory.id;
            }
        }
    }

    return null;
}

export async function seedPayrollPermissions() {
    const summary = {
        created: 0,
        skipped: 0,
        errors: 0,
        missingSubcategory: new Set()
    };

    const subcategories = await loadSubcategories();

    for (const permission of PAYROLL_PERMISSIONS) {
        try {
            const existing = await prisma.permission.findFirst({
                where: { key: permission.key }
            });

            if (existing) {
                summary.skipped += 1;
                continue;
            }

            const subcategoryId = findSubcategoryForPermission(permission, subcategories);
            if (!subcategoryId) {
                summary.missingSubcategory.add(permission.key);
            }

            await prisma.permission.create({
                data: {
                    name: permission.name,
                    key: permission.key,
                    action: permission.action,
                    description: permission.description,
                    module: permission.module,
                    subcategoryId: subcategoryId || undefined
                }
            });

            summary.created += 1;
        } catch (error) {
            summary.errors += 1;
            console.error(`Failed to seed permission ${permission.key}:`, error.message);
        }
    }

    if (summary.missingSubcategory.size > 0) {
        console.warn("Permissions seeded without a matching subcategory:", [...summary.missingSubcategory]);
    }

    return summary;
}

async function run() {
    console.log("Starting payroll permission seeding...");
    const result = await seedPayrollPermissions();
    console.log(`Created: ${result.created}, Skipped: ${result.skipped}, Errors: ${result.errors}`);
}

const currentFile = fileURLToPath(import.meta.url);
const executedDirectly = path.resolve(process.argv[1] || "") === currentFile;

if (executedDirectly) {
    run()
        .catch(error => {
            console.error("Seeding process failed:", error);
            process.exitCode = 1;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
