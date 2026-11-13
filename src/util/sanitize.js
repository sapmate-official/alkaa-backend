// Central helpers to strip sensitive auth fields from any user-like object
// before it is serialized into an HTTP response.
export const SECRET_USER_FIELDS = [
    'hashedPassword',
    'refreshToken',
    'verificationToken',
    'verificationTokenExpiry'
];

export const stripSecrets = (record) => {
    if (!record || typeof record !== 'object') return record;
    const clean = { ...record };
    for (const field of SECRET_USER_FIELDS) {
        delete clean[field];
    }
    return clean;
};

export const sanitizeUser = (u) => {
    if (!u || typeof u !== 'object') return u;
    const rest = stripSecrets(u);
    return {
        ...rest,
        personalEmail: u.personalEmail || u.email,
        businessEmail: u.businessEmail || null,
        ...(u.manager !== undefined ? { manager: sanitizeUser(u.manager) } : {})
    };
};
