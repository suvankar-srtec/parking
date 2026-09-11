const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: [] });
const config = JSON.parse(fs.readFileSync("config/readers.json", "utf8"));
(async () => {
  for (const reader of config) {
    await prisma.rfidReader.upsert({
      where: { deviceNumber: reader.deviceNumber },
      create: { ...reader, connectionType: "TCP", enabled: true },
      update: { name: reader.name, readerIp: reader.readerIp, connectionType: "TCP" },
    });
  }
  console.log("Configured approved TCP readers. Assign their building in Device settings.");
})().catch(() => { console.error("Reader configuration failed"); process.exitCode = 1; }).finally(() => prisma.$disconnect());
