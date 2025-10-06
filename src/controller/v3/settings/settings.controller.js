import prisma from "../../../db/connectDb.js";

const DEFAULT_ORG_SETTINGS = Object.freeze({
    weekoff: [0, 6],
    timezone: "Asia/Kolkata",
    workingHours: "9:00 AM - 6:00 PM",
});

const isPlainObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const sanitizeWeekoff = (value) => {
    if (!Array.isArray(value)) {
        return [...DEFAULT_ORG_SETTINGS.weekoff];
    }

    const sanitized = Array.from(new Set(value.map(Number))).filter(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6,
    );

    return sanitized.length ? sanitized : [...DEFAULT_ORG_SETTINGS.weekoff];
};

const sanitizeTimezone = (value, fallback = DEFAULT_ORG_SETTINGS.timezone) => {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    if (typeof fallback === "string" && fallback.trim()) {
        return fallback.trim();
    }
    return DEFAULT_ORG_SETTINGS.timezone;
};

const sanitizeWorkingHours = (value) => {
    if (typeof value === "string" && value.trim()) {
        return value.trim();
    }
    return DEFAULT_ORG_SETTINGS.workingHours;
};

const mergeSettings = ({ base = {}, overrides = {}, fallbackTimezone } = {}) => {
    const baseObject = isPlainObject(base) ? base : {};
    const overridesObject = isPlainObject(overrides) ? overrides : {};

    const merged = {
        ...DEFAULT_ORG_SETTINGS,
        ...baseObject,
        ...overridesObject,
    };

    return {
        ...merged,
        weekoff: sanitizeWeekoff(
            overridesObject.weekoff ?? baseObject.weekoff ?? merged.weekoff,
        ),
        timezone: sanitizeTimezone(
            overridesObject.timezone ?? baseObject.timezone ?? merged.timezone,
            fallbackTimezone,
        ),
        workingHours: sanitizeWorkingHours(
            overridesObject.workingHours ?? baseObject.workingHours ?? merged.workingHours,
        ),
    };
};

const fetchSettings = async (req, res) => {
    try {
        const { orgId } = req.params;
        if (!orgId) {
            return res.status(400).json({ message: "Organization ID is required" });
        }
        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            select: {
                id: true,
                timezone: true,
                OrganizationSettings: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        orgId: true,
                        settings: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }
        const settingsRecord = organization.OrganizationSettings?.[0] ?? null;
        const normalized = mergeSettings({
            base: settingsRecord?.settings,
            fallbackTimezone: organization.timezone,
        });

        if (organization.timezone) {
            normalized.timezone = sanitizeTimezone(organization.timezone);
        }

        return res.status(200).json({
            id: settingsRecord?.id ?? null,
            orgId: organization.id,
            createdAt: settingsRecord?.createdAt ?? null,
            updatedAt: settingsRecord?.updatedAt ?? null,
            settings: normalized,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const updateSettings = async (req, res) => {
    try {
        const { orgId } = req.params;
        const { settings } = req.body;

        if (!orgId) {
            return res.status(400).json({ message: "Organization ID is required" });
        }
        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true, timezone: true },
        });

        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const settingsRecord = await prisma.organizationSettings.findFirst({
            where: { orgId },
        });

        const normalized = mergeSettings({
            base: settingsRecord?.settings,
            overrides: settings,
            fallbackTimezone: organization.timezone,
        });

        const updatedRecord = await prisma.$transaction(async (tx) => {
            const record = settingsRecord
                ? await tx.organizationSettings.update({
                      where: { id: settingsRecord.id },
                      data: { settings: normalized },
                  })
                : await tx.organizationSettings.create({
                      data: {
                          orgId,
                          settings: normalized,
                      },
                  });

            await tx.organization.update({
                where: { id: orgId },
                data: { timezone: normalized.timezone },
            });

            return record;
        });

        return res.status(200).json({
            id: updatedRecord.id,
            orgId,
            createdAt: updatedRecord.createdAt,
            updatedAt: updatedRecord.updatedAt,
            settings: normalized,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const resetSettings = async (req, res) => {
    try {
        const { orgId } = req.params;

        if (!orgId) {
            return res.status(400).json({ message: "Organization ID is required" });
        }

        const organization = await prisma.organization.findUnique({
            where: { id: orgId },
            select: { id: true },
        });
        if (!organization) {
            return res.status(404).json({ message: "Organization not found" });
        }

        const normalizedDefaults = { ...DEFAULT_ORG_SETTINGS };

        const updatedRecord = await prisma.$transaction(async (tx) => {
            const existingSettings = await tx.organizationSettings.findFirst({
                where: { orgId },
            });

            const record = existingSettings
                ? await tx.organizationSettings.update({
                      where: { id: existingSettings.id },
                      data: { settings: normalizedDefaults },
                  })
                : await tx.organizationSettings.create({
                      data: {
                          orgId,
                          settings: normalizedDefaults,
                      },
                  });

            await tx.organization.update({
                where: { id: orgId },
                data: { timezone: normalizedDefaults.timezone },
            });

            return record;
        });

        return res.status(200).json({
            message: "Settings reset successfully",
            id: updatedRecord.id,
            orgId,
            createdAt: updatedRecord.createdAt,
            updatedAt: updatedRecord.updatedAt,
            settings: normalizedDefaults,
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export { fetchSettings, updateSettings, resetSettings };