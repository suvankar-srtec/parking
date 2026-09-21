import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { parseGateConfig } from "@/lib/gate-config";

function canManualExit(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "BUILDING_ADMIN") return true;
  return user.role === "EMPLOYEE" && hasPermission(user, "supervisor.liveDashboard");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!canManualExit(user)) {
    return NextResponse.json({ ok: false, message: "Manual exit is not available for this account." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const id = String(body?.id ?? "").trim();
  const [kind, recordId] = id.split(":");
  if (!["vehicle", "owner"].includes(kind) || !recordId) {
    return NextResponse.json({ ok: false, message: "Invalid active-card selection." }, { status: 400 });
  }

  const buildingId = user!.buildingId;
  if (!buildingId && user!.role !== "SUPER_ADMIN") {
    return NextResponse.json({ ok: false, message: "No building is assigned to this account." }, { status: 403 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let targetBuildingId = buildingId;
      let companyId: string | null = null;
      let cardNo = "";
      let vehicleId: string | null = null;
      let ownerVehicleId: string | null = null;

      if (kind === "vehicle") {
        const vehicle = await tx.vehicle.findUnique({
          where: { id: recordId },
          select: {
            id: true,
            isInside: true,
            rfidCardNo: true,
            companyId: true,
            company: { select: { buildingId: true } },
          },
        });
        if (!vehicle) throw new Error("Vehicle not found.");
        if (!vehicle.isInside) throw new Error("This vehicle is already outside.");
        targetBuildingId = vehicle.company.buildingId;
        companyId = vehicle.companyId;
        cardNo = vehicle.rfidCardNo || "";
        vehicleId = vehicle.id;
      } else {
        const vehicle = await tx.buildingOwnerVehicle.findUnique({
          where: { id: recordId },
          select: { id: true, isInside: true, rfidCardNo: true, buildingId: true },
        });
        if (!vehicle) throw new Error("Owner vehicle not found.");
        if (!vehicle.isInside) throw new Error("This vehicle is already outside.");
        targetBuildingId = vehicle.buildingId;
        cardNo = vehicle.rfidCardNo || "";
        ownerVehicleId = vehicle.id;
      }

      if (!targetBuildingId) throw new Error("Building could not be resolved.");

      if (user!.role === "BUILDING_ADMIN" || user!.role === "EMPLOYEE") {
        if (targetBuildingId !== user!.buildingId) throw new Error("This vehicle is outside your assigned building.");
      } else if (user!.role === "SUPER_ADMIN") {
        const building = await tx.building.findUnique({
          where: { id: targetBuildingId },
          select: { superAdminId: true },
        });
        if (!building) throw new Error("Building not found.");
      }

      const gates = await tx.gate.findMany({
        where: { buildingId: targetBuildingId },
        select: { direction: true },
        orderBy: { gateNumber: "asc" },
      });
      let exitReaderId: string | null = null;
      for (const gate of gates) {
        const config = parseGateConfig(gate.direction);
        if (config.exitReaderId) {
          exitReaderId = config.exitReaderId;
          break;
        }
        if (config.direction === "ENTRY_EXIT" && config.entryReaderId) {
          exitReaderId = config.entryReaderId;
          break;
        }
      }

      if (!exitReaderId) {
        throw new Error("No Exit reader is configured for this building.");
      }

      const exitReader = await tx.rfidReader.findUnique({
        where: { id: exitReaderId },
        select: { id: true, deviceNumber: true, enabled: true, buildingId: true },
      });
      if (!exitReader || !exitReader.enabled || exitReader.buildingId !== targetBuildingId) {
        throw new Error("The configured Exit reader is not available.");
      }

      const now = new Date();

      if (kind === "vehicle") {
        await tx.vehicle.update({
          where: { id: recordId },
          data: { isInside: false, lastAccessAt: now, lastAccessDevice: exitReader.deviceNumber },
        });
      } else {
        await tx.buildingOwnerVehicle.update({
          where: { id: recordId },
          data: { isInside: false, lastAccessAt: now, lastAccessDevice: exitReader.deviceNumber },
        });
      }

      await tx.rfidEvent.create({
        data: {
          readerId: exitReader.id,
          buildingId: targetBuildingId,
          companyId,
          vehicleId,
          ownerVehicleId,
          deviceNumber: exitReader.deviceNumber,
          cardNo: cardNo || "MANUAL",
          action: "EXIT",
          code: "0000",
          message: "Manual exit allowed",
        },
      });

      await tx.rfidReader.update({
        where: { id: exitReader.id },
        data: { pendingSuccessPulse: true },
      });

      return { deviceNumber: exitReader.deviceNumber };
    });

    return NextResponse.json({
      ok: true,
      message: `Manual exit completed. Exit reader ${result.deviceNumber} will flash on its next heartbeat.`,
    });
  } catch (error) {
    console.error("MANUAL_EXIT_FAILED", error);
    return NextResponse.json({
      ok: false,
      message: error instanceof Error ? error.message : "Unable to complete manual exit.",
    }, { status: 400 });
  }
}
