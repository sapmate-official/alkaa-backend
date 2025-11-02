import prisma from "../db/connectDb.js"

async function main() {
  const permissions = [
    {
      key: 'change_user_status',
      name: 'Change User Status',
      description: 'Activate, suspend, or terminate users',
      module: 'user_management',
      action: 'UPDATE',
    },
    {
      key: 'change_employment_type',
      name: 'Change Employment Type',
      description: 'Promote or demote employment types',
      module: 'user_management',
      action: 'UPDATE',
    },
    {
      key: 'reactivate_terminated_users',
      name: 'Reactivate Terminated Users',
      description: 'Reactivate users who were terminated',
      module: 'user_management',
      action: 'UPDATE',
    },
  ];

  const subcategory = await prisma.permissionSubcategory.findFirst({
    where: { name: 'User Management' }, // adjust if your naming differs
  });

  if (!subcategory) {
    throw new Error('Permission subcategory "User Management" not found');
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: {
        ...permission,
        subcategoryId: subcategory.id,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });