const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { userId: "0909" },
    update: {
      username: "sp0909",
      password: "admin123",
      role: "SUPER_ADMIN",
      buildingId: null,
      companyId: null,
    },
    create: {
      userId: "0909",
      username: "sp0909",
      password: "admin123",
      role: "SUPER_ADMIN"
    }
  });

  console.log("Super Admin ready: 0909 / sp0909 / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
