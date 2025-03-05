import prisma from "../../../db/connectDb.js";
export const getPermissions = async (req, res) => {
    try {
        const permissions = await prisma.permission.findMany();
        res.status(200).json(permissions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
};

export const getPermissionById = async (req, res) => {
    const { id } = req.params;
    try {
        const permission = await prisma.permission.findUnique({ where: { id } });
        if (!permission) {
            return res.status(404).json({ error: 'Permission not found' });
        }
        res.status(200).json(permission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch permission' });
    }
};

export const createPermission = async (req, res) => {
    const { name, description, module, action } = req.body;
    try {
        const newPermission = await prisma.permission.create({
            data: {  name, description, module, action },
        });
        res.status(201).json(newPermission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create permission' });
    }
};

export const updatePermission = async (req, res) => {
    const { id } = req.params;
    const { name, description, module, action } = req.body;
    try {
        const updatedPermission = await prisma.permission.update({
            where: { id },
            data: { name, description, module, action },
        });
        res.status(200).json(updatedPermission);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update permission' });
    }
};

export const deletePermission = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.permission.delete({ where: { id } });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete permission' });
    }
};
export const getPermissionsByOrgId = async (req, res) => {
    const { orgId } = req.params;
    try {
        const permissions = await prisma.permission.findMany({
            
        });
        res.status(200).json(permissions);
    } catch (error) {
        console.log(error);
        
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
}

// const fetchallPermission =async ()=>{
//     const data = await prisma.permission.findMany()
//     console.log(data)
// }
// // console.log(
// fetchallPermission()
// const seedPermissions = async () => {

// const permissions = [
//     {
//       id: 'cm6vx9jvs0000tla4r1awtxeb',
//       name: 'Create User/Employee',
//       description: 'This permission will allow you to create user like employee manager.',
//       module: 'user',
//       action: 'create',
      
//     },
//     {
//       id: 'cm6vyaw940001tla42zcmd50g',
//       name: 'Read User Details',
//       description: "This permission will allow to see any user's profile info.",
//       module: 'user',
//       action: 'read',
      
//     },
//     {
//       id: 'cm6vyfdw20002tla4o5redit7',
//       name: 'Update User Details',
//       description: "This permission will allow to update other user's details.",
//       module: 'user',
//       action: 'update',
      
//     },
//     {
//       id: 'cm6vygfxr0003tla4brxyqhmt',
//       name: 'Delete User',
//       description: 'This permission will allow to delete user from database.',
//       module: 'user',
//       action: 'delete',
      
//     },
//     {
//       id: 'cm6vyhhjq0004tla4kc2g2ork',
//       name: 'Manage User Roles',
//       description: "This permission will allow to manage existing user's roles.",
//       module: 'user',
//       action: 'manage_roles',
      
//     },
//     {
//       id: 'cm6vyi8o30005tla4762qrdoe',
//       name: 'View Subordinates',
//       description: 'This permission allows viewing subordinates in the organization.',
//       module: 'user',
//       action: 'view_subordinates',
      
//     },
//     {
//       id: 'cm6vz3n6g0006tla4a2o49i8d',
//       name: 'department.create',
//       description: 'Create departments',
//       module: 'Department',
//       action: 'Create',
      
//     },
//     {
//       id: 'cm6vz3naw0007tla4hqzpc6qf',
//       name: 'department.read',
//       description: 'View departments',
//       module: 'Department',
//       action: 'Read',
      
//     },
//     {
//       id: 'cm6vz3ndq0008tla431k1qall',
//       name: 'department.update',
//       description: 'Update departments',
//       module: 'Department',
//       action: 'Update',
      
//     },
//     {
//       id: 'cm6vz3nfr0009tla4mxrt7n7h',
//       name: 'department.delete',
//       description: 'Delete departments',
//       module: 'Department',
//       action: 'Delete',
      
//     },
//     {
//       id: 'cm6vz3nhs000atla4kpkg2ljz',
//       name: 'department.assign_users',
//       description: 'Assign users to departments',
//       module: 'Department',
//       action: 'Assign',
      
//     },
//     {
//       id: 'cm6vz3nju000btla4oq7zmbkz',
//       name: 'leave.create_types',
//       description: 'Create leave types',
//       module: 'Leave',
//       action: 'Create Types',
      
//     },
//     {
//       id: 'cm6vz3nlv000ctla4t1xuq7z8',
//       name: 'leave.read_types',
//       description: 'View leave types',
//       module: 'Leave',
//       action: 'Read Types',
      
//     },
//     {
//       id: 'cm6vz3no4000dtla40hisib9a',
//       name: 'leave.update_types',
//       description: 'Update leave types',
//       module: 'Leave',
//       action: 'Update Types',
      
//     },
//     {
//       id: 'cm6vz3nqq000etla4sjjwgy04',
//       name: 'leave.delete_types',
//       description: 'Delete leave types',
//       module: 'Leave',
//       action: 'Delete Types',
      
//     },
//     {
//       id: 'cm6vz3nsq000ftla4p83v5wea',
//       name: 'leave.request',
//       description: 'Request leave',
//       module: 'Leave',
//       action: 'Request',
      
//     },
//     {
//       id: 'cm6vz3nur000gtla4rs6ckecf',
//       name: 'leave.approve',
//       description: 'Approve leave requests',
//       module: 'Leave',
//       action: 'Approve',
      
//     },
//     {
//       id: 'cm6vz3nwv000htla4t8fd22w7',
//       name: 'leave.reject',
//       description: 'Reject leave requests',
//       module: 'Leave',
//       action: 'Reject',
      
//     },
//     {
//       id: 'cm6vz3nzz000itla4a1gfg9qd',
//       name: 'leave.view_team_leaves',
//       description: 'View team leave requests',
//       module: 'Leave',
//       action: 'View Team',
      
//     },
//     {
//       id: 'cm6vz3o22000jtla4kca2szpq',
//       name: 'leave.view_all_leaves',
//       description: 'View all leave requests',
//       module: 'Leave',
//       action: 'View All',
      
//     },
//     {
//       id: 'cm6vz3o43000ktla4vnj7539b',
//       name: 'leave.manage_balances',
//       description: 'Manage leave balances',
//       module: 'Leave',
//       action: 'Manage Balances',
      
//     },
//     {
//       id: 'cm6vz3o64000ltla4gw3xr7s8',
//       name: 'attendance.mark',
//       description: 'Mark attendance',
//       module: 'Attendance',
//       action: 'Mark',
      
//     },
//     {
//       id: 'cm6vz3o8h000mtla4dgmw25ip',
//       name: 'attendance.view_own',
//       description: 'View own attendance',
//       module: 'Attendance',
//       action: 'View Own',
      
//     },
//     {
//       id: 'cm6vz3ob4000ntla4ybisiv6j',
//       name: 'attendance.view_team',
//       description: 'View team attendance',
//       module: 'Attendance',
//       action: 'View Team',
      
//     },
//     {
//       id: 'cm6vz3od5000otla4uyw4pdcb',
//       name: 'attendance.view_all',
//       description: 'View all attendance records',
//       module: 'Attendance',
//       action: 'View All',
      
//     },
//     {
//       id: 'cm6vz3of8000ptla4wysv6omw',
//       name: 'attendance.modify',
//       description: 'Modify attendance records',
//       module: 'Attendance',
//       action: 'Modify',
      
//     },
//     {
//       id: 'cm6vz3oh9000qtla4u5am0mnx',
//       name: 'attendance.generate_reports',
//       description: 'Generate attendance reports',
//       module: 'Attendance',
//       action: 'Reports',
      
//     },
//     {
//       id: 'cm6vz3oke000rtla43q099hme',
//       name: 'payroll.view_own',
//       description: 'View own payroll',
//       module: 'Payroll',
//       action: 'View Own',
      
//     },
//     {
//       id: 'cm6vz3omi000stla47yivbbjt',
//       name: 'payroll.view_team',
//       description: 'View team payroll',
//       module: 'Payroll',
//       action: 'View Team',
      
//     },
//     {
//       id: 'cm6vz3ool000ttla4zhwivxt1',
//       name: 'payroll.view_all',
//       description: 'View all payroll records',
//       module: 'Payroll',
//       action: 'View All',
      
//     },
//     {
//       id: 'cm6vz3oqp000utla45pbrm1so',
//       name: 'payroll.process',
//       description: 'Process payroll',
//       module: 'Payroll',
//       action: 'Process',
      
//     },
//     {
//       id: 'cm6vz3otn000vtla4fiiiv2k4',
//       name: 'payroll.approve',
//       description: 'Approve payroll',
//       module: 'Payroll',
//       action: 'Approve',
      
//     },
//     {
//       id: 'cm6vz3ovn000wtla454ugaa13',
//       name: 'payroll.generate_reports',
//       description: 'Generate payroll reports',
//       module: 'Payroll',
//       action: 'Reports',
      
//     },
//     {
//       id: 'cm6vz3oxo000xtla4238layw3',
//       name: 'bank.create',
//       description: 'Create bank details',
//       module: 'Bank',
//       action: 'Create',
      
//     },
//     {
//       id: 'cm6vz3ozq000ytla4oabpqzbn',
//       name: 'bank.read_own',
//       description: 'View own bank details',
//       module: 'Bank',
//       action: 'Read Own',
      
//     },
//     {
//       id: 'cm6vz3p2z000ztla4mkhr5ljq',
//       name: 'bank.read_all',
//       description: 'View all bank details',
//       module: 'Bank',
//       action: 'Read All',
      
//     },
//     {
//       id: 'cm6vz3p500010tla41j23vakl',
//       name: 'bank.update',
//       description: 'Update bank details',
//       module: 'Bank',
//       action: 'Update',
      
//     },
//     {
//       id: 'cm6vz3p720011tla421tmn8gu',
//       name: 'bank.delete',
//       description: 'Delete bank details',
//       module: 'Bank',
//       action: 'Delete',
      
//     },
//     {
//       id: 'cm6vz3p930012tla462y56l8y',
//       name: 'holiday.create',
//       description: 'Create holidays',
//       module: 'Holiday',
//       action: 'Create',
      
//     },
//     {
//       id: 'cm6vz3pb30013tla4tzuzy88j',
//       name: 'holiday.read',
//       description: 'View holidays',
//       module: 'Holiday',
//       action: 'Read',
      
//     },
//     {
//       id: 'cm6vz3pe10014tla43r8jgn2d',
//       name: 'holiday.update',
//       description: 'Update holidays',
//       module: 'Holiday',
//       action: 'Update',
      
//     },
//     {
//       id: 'cm6vz3pg20015tla4fvxbyq7o',
//       name: 'holiday.delete',
//       description: 'Delete holidays',
//       module: 'Holiday',
//       action: 'Delete',
      
//     },
//     {
//       id: 'cm6vz3pia0016tla4voayc10j',
//       name: 'notification.create_template',
//       description: 'Create notification templates',
//       module: 'Notification',
//       action: 'Create Template',
      
//     },
//     {
//       id: 'cm6vz3pkb0017tla4svggps4l',
//       name: 'notification.read_template',
//       description: 'View notification templates',
//       module: 'Notification',
//       action: 'Read Template',
      
//     },
//     {
//       id: 'cm6vz3pnd0018tla4puyya95t',
//       name: 'notification.update_template',
//       description: 'Update notification templates',
//       module: 'Notification',
//       action: 'Update Template',
      
//     },
//     {
//       id: 'cm6vz3ppd0019tla4d3zezn69',
//       name: 'notification.delete_template',
//       description: 'Delete notification templates',
//       module: 'Notification',
//       action: 'Delete Template',
      
//     },
//     {
//       id: 'cm6vz3prf001atla4x4z69d0h',
//       name: 'notification.send',
//       description: 'Send notifications',
//       module: 'Notification',
//       action: 'Send',
      
//     },
//     {
//       id: 'cm6vz3ptg001btla4e9ecv5sr',
//       name: 'org.manage_settings',
//       description: 'Manage organization settings',
//       module: 'Organization',
//       action: 'Manage Settings',
      
//     },
//     {
//       id: 'cm6vz3pvh001ctla4tn9649l6',
//       name: 'org.view_settings',
//       description: 'View organization settings',
//       module: 'Organization',
//       action: 'View Settings',
      
//     },
//     {
//       id: 'cm6vz3pye001dtla4x1c3a9e4',
//       name: 'org.manage_subscription',
//       description: 'Manage organization subscription',
//       module: 'Organization',
//       action: 'Manage Subscription',
      
//     }
//   ]

    
//     try {
//         // Create all permissions in a transaction
//         const result = await prisma.$transaction(
//             permissions.map(permission => 
//                 prisma.permission.create({
                    
//                     data: {
//                         id: permission.id,
//                         name: permission.name,
//                         description: permission.description,
//                         module: permission.module,
//                         action: permission.action
//                     }
//                 })
//             )
//         );

//         return result;
//     } catch (error) {
//         console.error('Seeding error:', error);
        
//     }
// };
// seedPermissions()