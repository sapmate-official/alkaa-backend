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

const checkUserRoles = async (req, res, next) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Get the user with their roles
        const userWithRoles = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                roles: {
                    include: {
                        role: true
                    }
                }
            }
        });

        if (!userWithRoles) {
            return res.status(404).json({ error: "User not found" });
        }

        // Add roles to the request object for easy access
        req.userRoles = userWithRoles.roles.map(ur => ur.role.name);
        
        // Check if the user is an org admin based on role permissions
        const isOrgAdmin = userWithRoles.roles.some(userRole => 
            userRole.role.permissions.some(perm => 
                perm.permission?.key === "view_salary_slip_of_all"
            )
        );
        
        // Check if the user is a manager by seeing if they have subordinates
        const isManager = await prisma.user.findFirst({
            where: { 
                managerId: user.id 
            }
        });

        req.isOrgAdmin = isOrgAdmin;
        req.isManager = !!isManager;
        
        next();
    } catch (error) {
        console.error("Error in checkUserRoles middleware:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export { roleCheckManager, roleCheckEmployee, checkUserRoles }