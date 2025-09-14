import { PrismaClient } from '@prisma/client';
import fs from 'fs';

// Create source and target Prisma clients
const sourceDb = new PrismaClient({
  datasourceUrl: "postgresql://alkaa-prod_owner:npg_pctSUr5ObT1G@ep-wild-pond-a1rxcsqu-pooler.ap-southeast-1.aws.neon.tech/alkaa-prod?sslmode=require"
});

const targetDb = new PrismaClient({
  datasourceUrl: "postgresql://Alkaa-Test-mode_owner:npg_NljT37uaQwLr@ep-wispy-voice-a1eruhup-pooler.ap-southeast-1.aws.neon.tech/Alkaa-Test-mode?sslmode=require"
});

async function migratePermissionData() {
  console.log('Starting permission data migration...');
  
  try {
    // 1. Migrate PermissionCategory
    console.log('Migrating PermissionCategory data...');
    const categories = await sourceDb.permissionCategory.findMany();
    
    for (const category of categories) {
      await targetDb.permissionCategory.upsert({
        where: { id: category.id },
        update: {
          name: category.name,
          description: category.description,
          updatedAt: category.updatedAt
        },
        create: {
          id: category.id,
          name: category.name,
          description: category.description,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        }
      });
    }
    console.log(`Migrated ${categories.length} categories`);
    
    // 2. Migrate PermissionSubcategory
    console.log('Migrating PermissionSubcategory data...');
    const subcategories = await sourceDb.permissionSubcategory.findMany();
    
    for (const subcategory of subcategories) {
      await targetDb.permissionSubcategory.upsert({
        where: { id: subcategory.id },
        update: {
          name: subcategory.name,
          description: subcategory.description,
          categoryId: subcategory.categoryId,
          updatedAt: subcategory.updatedAt
        },
        create: {
          id: subcategory.id,
          name: subcategory.name,
          description: subcategory.description,
          categoryId: subcategory.categoryId,
          createdAt: subcategory.createdAt,
          updatedAt: subcategory.updatedAt
        }
      });
    }
    console.log(`Migrated ${subcategories.length} subcategories`);
    
    // 3. Migrate Permission
    console.log('Migrating Permission data...');
    const permissions = await sourceDb.permission.findMany();

    for (const permission of permissions) {
      const updateData = {
        name: permission.name,
        description: permission.description,
        module: permission.module,
        key: permission.key,
        action: permission.action
        // Remove updatedAt - Prisma will auto-update this field
      };
      
      const createData = {
        id: permission.id,
        name: permission.name,
        description: permission.description,
        module: permission.module,
        key: permission.key,
        action: permission.action,
        createdAt: permission.createdAt || new Date()
      };
      
      // Handle subcategory relation properly
      if (permission.subcategoryId) {
        updateData.subcategory = { connect: { id: permission.subcategoryId } };
        createData.subcategory = { connect: { id: permission.subcategoryId } };
      } else {
        // If no subcategory, disconnect any existing relation in update
        updateData.subcategory = { disconnect: true };
        // For create, no need to specify subcategory if it doesn't exist
      }
      
      await targetDb.permission.upsert({
        where: { id: permission.id },
        update: updateData,
        create: createData
      });
    }
    console.log(`Migrated ${permissions.length} permissions`);
    
    // 4. Migrate PermissionPreset
    console.log('Migrating PermissionPreset data...');
    const presets = await sourceDb.permissionPreset.findMany();
    
    for (const preset of presets) {
      await targetDb.permissionPreset.upsert({
        where: { id: preset.id },
        update: {
          name: preset.name,
          description: preset.description,
          orgId: preset.orgId,
          permissions: preset.permissions,
          updatedAt: preset.updatedAt
        },
        create: {
          id: preset.id,
          name: preset.name,
          description: preset.description,
          orgId: preset.orgId,
          permissions: preset.permissions,
          createdAt: preset.createdAt,
          updatedAt: preset.updatedAt
        }
      });
    }
    console.log(`Migrated ${presets.length} permission presets`);
    
    console.log('Migration completed successfully!');
    
    // Optional: Export the migrated data to JSON files for backup
    fs.writeFileSync('exported-categories.json', JSON.stringify(categories, null, 2));
    fs.writeFileSync('exported-subcategories.json', JSON.stringify(subcategories, null, 2));
    fs.writeFileSync('exported-permissions.json', JSON.stringify(permissions, null, 2));
    fs.writeFileSync('exported-presets.json', JSON.stringify(presets, null, 2));
    console.log('Exported data to JSON files for backup');
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
  }
}

// Run the migration
migratePermissionData();