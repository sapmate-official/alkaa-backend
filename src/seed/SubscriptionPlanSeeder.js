import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Create or update subscription plans
 */
export async function seedSubscriptionPlans() {
  console.log('🚀 Starting subscription plan seeding process...');
  
  try {
    // Define the subscription plans
    const plans = [
      {
        name: "Basic",
        description: "Ideal for small businesses just starting out",
        monthlyPrice: 499,
        annualPrice: 5988, // ₹5,988 billed annually
        maxUsers: 20, // Up to 20 employees
        features: JSON.stringify([
          "Employee Management",
          "Attendance Tracking",
          "Leave Management",
          "Basic Payroll",
          "Mobile App Access",
          "Email Support",
          "Basic Reporting",
          "Data Security"
        ]),
        isActive: true
      },
      {
        name: "Growth",
        description: "Perfect for growing businesses with more complex needs",
        monthlyPrice: 899,
        annualPrice: 10788, // ₹10,788 billed annually
        maxUsers: 100, // Up to 100 employees
        features: JSON.stringify([
          "Everything in Basic",
          "Advanced Payroll",
          "Custom Roles & Permissions",
          "Department Management",
          "Performance Reviews",
          "Advanced Reporting & Analytics",
          "API Access",
          "Priority Support"
        ]),
        isActive: true
      },      {
        name: "Enterprise",
        description: "For large organizations requiring custom solutions",
        monthlyPrice: 0, // Custom pricing
        annualPrice: 0, // Custom pricing
        maxUsers: 9999999, // Effectively unlimited employees
        features: JSON.stringify([
          "Everything in Growth",
          "Custom Integrations",
          "Dedicated Account Manager",
          "Custom Analytics",
          "White Labeling Options",
          "Multi-org Management",
          "24/7 Premium Support",
          "On-premise Option",
          "Advanced Security Features"
        ]),
        isActive: true
      }
    ];
    
    // Upsert each plan (create or update if exists)
    for (const plan of plans) {
      await prisma.subscriptionPlan.upsert({
        where: { name: plan.name },
        update: plan,
        create: plan
      });
      
      console.log(`✅ ${plan.name} plan created/updated successfully`);
    }
    
    console.log('🎉 Subscription plan seeding completed successfully!');
    
    // Display summary of created plans
    console.log('📊 Subscription Plans Summary:');
    console.log('   Basic: Up to 20 employees - ₹499/month or ₹5,988/year');
    console.log('   Growth: Up to 100 employees - ₹899/month or ₹10,788/year');
    console.log('   Enterprise: Unlimited employees - Custom pricing');
    
  } catch (error) {
    console.error('💥 Error during subscription plan seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seeder if this file is executed directly
// if (require.main === module) {
//   seedSubscriptionPlans()
//     .then(() => console.log('Seeding completed.'))
//     .catch(e => {
//       console.error(e);
//       process.exit(1);
//     });
// }
seedSubscriptionPlans();