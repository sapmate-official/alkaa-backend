const roleCheckManager = (req, res, next) => {
    const user = req.user;
    if(user.role !== "MANAGER"){
        return res.status(403).json({ error: "You are not authorized" });
    }else if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    next();
}
const roleCheckEmployee= (req, res, next) => {
    const user = req.user;
    if(user.role !== "EMPLOYEE"){
        return res.status(403).json({ error: "You are not authorized" });
    }else if (!user) {
        return res.status(404).json({ error: "User not found" });
    }
    next();
}
export { roleCheckManager,roleCheckEmployee }