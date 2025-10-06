const ACCESS_TOKEN_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const getCookieDomain = () => {
    if (process.env.NODE_ENV === "production") {
        return process.env.COOKIE_DOMAIN || ".alkaa.online";
    }
    return undefined;
};

const createCookieOptions = (maxAgeMs) => {
    const isProduction = process.env.NODE_ENV === "production";

    const options = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: maxAgeMs,
        expires: new Date(Date.now() + maxAgeMs),
        path: "/"
    };

    const domain = getCookieDomain();
    if (domain) {
        options.domain = domain;
    }

    return options;
};

const getAuthCookieOptions = () => ({
    access: createCookieOptions(ACCESS_TOKEN_MAX_AGE_MS),
    refresh: createCookieOptions(REFRESH_TOKEN_MAX_AGE_MS)
});

export const setAuthCookies = (res, accessToken, refreshToken) => {
    const options = getAuthCookieOptions();
    res.cookie("accessToken", accessToken, options.access);
    res.cookie("refreshToken", refreshToken, options.refresh);
};

export const clearAuthCookies = (res) => {
    const options = getAuthCookieOptions();
    const clearAccessOptions = { ...options.access };
    const clearRefreshOptions = { ...options.refresh };

    delete clearAccessOptions.maxAge;
    delete clearAccessOptions.expires;
    delete clearRefreshOptions.maxAge;
    delete clearRefreshOptions.expires;

    res.clearCookie("accessToken", clearAccessOptions);
    res.clearCookie("refreshToken", clearRefreshOptions);
};

export const buildAccessCookieOptions = () => createCookieOptions(ACCESS_TOKEN_MAX_AGE_MS);

export { ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS };
