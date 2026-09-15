import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

process.loadEnvFile(".env");
const prisma = new PrismaClient({ log: [] });
const base = process.env.RFID_TEST_BASE_URL || "http://localhost:3000";

test("HTTP entry never succeeds twice without a recorded exit", { timeout: 180000 }, async () => {
  assert.ok(process.env.RFID_HTTP_TOKEN, "RFID_HTTP_TOKEN must be configured");
  const tag = "RFID-ENTRY-TEST-" + randomBytes(8).toString("hex");
  const number = String(Date.now());
  const deviceNumbers = [number + "01", number + "02", number + "03"];
  const card = randomBytes(8).toString("hex").toUpperCase();
  let building;
  try {
    building = await prisma.building.create({ data: { name: tag, totalParking: 2, ownerParking: 0, companyParking: 2, maximumGate: 3 } });
    const company = await prisma.company.create({ data: { name: tag, buildingId: building.id, parkingAllocation: 2 } });
    const employee = await prisma.employee.create({ data: { name: tag, userId: tag, companyId: company.id, parkingLimit: 1 } });
    const vehicle = await prisma.vehicle.create({ data: { companyId: company.id, employeeId: employee.id, ownerName: tag, plateNumber: tag, vehicleType: "Four wheeler", department: "IT", rfidCardNo: card } });
    for (const [index, deviceNumber] of deviceNumbers.entries()) {
      const reader = await prisma.rfidReader.create({ data: { deviceNumber, name: tag, buildingId: building.id, mode: "ENTRY_EXIT", enabled: true } });
      await prisma.gate.create({ data: { buildingId: building.id, gateNumber: index + 1, direction: (index === 1 ? "EXIT" : "ENTRY") + "::READER::" + reader.id } });
    }
    async function scan(index, firmware = false) {
      const body = firmware ? "vgdecoderesult" + card + "devicenumber" + deviceNumbers[index] + "otherparams"
        : "Vgdecoderresult = " + card + "&& devicenumber = " + deviceNumbers[index];
      const response = await fetch(base + "/test", { method: "POST", headers: { "Content-Type": "text/html; charset=UTF-8", "x-reader-token": process.env.RFID_HTTP_TOKEN }, body, signal: AbortSignal.timeout(30000) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /^text\/plain/);
      const reply = await response.text();
      assert.match(reply, /^code=000[01]$/);
      return reply;
    }
    const stored = () => prisma.vehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
    const clearDebounce = () => prisma.vehicle.update({ where: { id: vehicle.id }, data: { lastAccessAt: new Date(Date.now() - 60000) } });

    assert.equal(await scan(0), "code=0000", "first entry succeeds");
    const entered = await stored();
    assert.equal(entered.isInside, true);
    assert.equal(await scan(0), "code=0001", "immediate repeat must not trigger success");
    assert.equal((await stored()).lastAccessAt.getTime(), entered.lastAccessAt.getTime());

    await clearDebounce();
    const beforeRepeatedEntry = await stored();
    assert.equal(await scan(0, true), "code=0001", "a repeat after debounce still fails");
    assert.equal(await scan(2), "code=0001", "another entry gate cannot admit the card again");
    const afterRepeatedEntry = await stored();
    assert.equal(afterRepeatedEntry.isInside, true);
    assert.equal(afterRepeatedEntry.lastAccessAt.getTime(), beforeRepeatedEntry.lastAccessAt.getTime());
    assert.equal(afterRepeatedEntry.lastAccessDevice, beforeRepeatedEntry.lastAccessDevice);
    assert.equal(await prisma.rfidEvent.count({ where: { vehicleId: vehicle.id, action: "EXIT" } }), 0, "repeat entries never manufacture an exit");

    assert.equal(await scan(1), "code=0000", "an exit must be recorded");
    assert.equal((await stored()).isInside, false);
    await clearDebounce();
    assert.equal(await scan(1), "code=0001", "a repeated exit is not successful");
    const simultaneous = await Promise.all([scan(0), scan(2)]);
    assert.deepEqual(simultaneous.sort(), ["code=0000", "code=0001"], "only one concurrent re-entry succeeds");
    assert.equal((await stored()).isInside, true);

    const events = await prisma.rfidEvent.findMany({ where: { vehicleId: vehicle.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(events.filter(event => event.code === "0000").map(event => event.action), ["ENTRY", "EXIT", "ENTRY"]);
    assert.ok(events.filter(event => ["DENIED", "IGNORED"].includes(event.action)).every(event => event.code === "0001"));
    console.log("Verified exact HTTP replies: entry 0000, repeated entry 0001, exit 0000, re-entry 0000. No physical reader commands sent.");
  } finally {
    await prisma.rfidEvent.deleteMany({ where: { deviceNumber: { in: deviceNumbers } } });
    await prisma.rfidReader.deleteMany({ where: { deviceNumber: { in: deviceNumbers } } });
    if (building) await prisma.building.delete({ where: { id: building.id } });
    await prisma.$disconnect();
  }
});
