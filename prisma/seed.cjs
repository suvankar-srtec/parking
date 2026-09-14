const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const accounts = [
  { userId: "sa03", username: "sp0909", password: "admin123", role: "SUPER_ADMIN" },
  { userId: "sa01", username: "sa01", password: "sa01", role: "SUPER_ADMIN" },
  { userId: "sa02", username: "sa02", password: "sa02", role: "SUPER_ADMIN" },
  { userId: "admin1", username: "admin1", password: "admin1", role: "BUILDING_ADMIN" },
  { userId: "admin2", username: "admin2", password: "admin2", role: "BUILDING_ADMIN" },
  { userId: "user1", username: "user1", password: "user1", role: "COMPANY_ADMIN" },
  { userId: "user2", username: "user2", password: "user2", role: "COMPANY_ADMIN" },
  { userId: "sup1", username: "sup1", password: "sup1", role: "EMPLOYEE" },
  { userId: "sup2", username: "sup2", password: "sup2", role: "EMPLOYEE" },
];

async function main() {
  for (const account of accounts) {
    await prisma.user.upsert({
      where: { userId: account.userId },
      update: {
        username: account.username,
        password: account.password,
        role: account.role,
      },
      create: account,
    });
  }

  console.log("Role login accounts are ready.");
  console.log("Super Admin: sa01/sa01, sa02/sa02, sa03/sp0909");
  console.log("Admin: admin1/admin1, admin2/admin2");
  console.log("Company/User: user1/user1, user2/user2");
  console.log("Supervisor: sup1/sup1, sup2/sup2");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
