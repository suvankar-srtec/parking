import EditEmployeeModal from "./EditEmployeeModal";
import RemoveParkingAllocationButton from "./RemoveParkingAllocationButton";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";

type DepartmentOption = { id: string; name: string };
type VehicleSummary = { id: string; plateNumber: string; vehicleType: string; department: string; rfidCardNo: string | null; isInside?: boolean };
type EmployeeSummary = {
  id: string;
  name: string;
  userId: string;
  category: string;
  parkingLimit: number;
  department: string;
  isPlaceholder?: boolean;
  slotNumber?: number | null;
  vehicles: VehicleSummary[];
};

export default async function EmployeeList({
  companyId,
  employees,
  departments,
  canManagePeople,
  canManageVehicles,
}: {
  companyId: string;
  employees: EmployeeSummary[];
  departments: DepartmentOption[];
  canManagePeople?: boolean;
  canManageVehicles?: boolean;
}) {
  const user = await getCurrentUser();
  const companyScoped = user?.role === "COMPANY_ADMIN" || user?.role === "BUILDING_OWNER";
  const managePeople = canManagePeople ?? (companyScoped && user ? hasPermission(user, "company.managePeople") : true);
  const manageVehicles = canManageVehicles ?? (companyScoped && user ? hasPermission(user, "company.manageVehicles") : true);

  if (employees.length === 0) return <p className="muted">No employee roster slots are available yet.</p>;

  const orderedEmployees = [...employees].sort((a, b) => {
    const aSlot = a.slotNumber ?? Number.MAX_SAFE_INTEGER;
    const bSlot = b.slotNumber ?? Number.MAX_SAFE_INTEGER;
    if (aSlot !== bSlot) return aSlot - bSlot;
    return a.name.localeCompare(b.name);
  });

  return <div className="entity-list employee-roster-list">
    {orderedEmployees.map((employee) => {
      const displayName = employee.isPlaceholder && employee.slotNumber ? `EMP-${employee.slotNumber}` : employee.name;
      return <article className={`entity-row employee-row${employee.isPlaceholder ? " employee-slot-placeholder" : ""}`} key={employee.id}>
        <div>
          <strong>{displayName} <span className="tiny-label">{employee.category === "OWNER" ? "Company Owner" : employee.isPlaceholder ? "Employee Slot" : "Employee"}</span></strong>
          <span>{employee.slotNumber ? `Slot: EMP-${employee.slotNumber}` : `User ID: ${employee.userId}`} · Department: {employee.department || "Unassigned"}</span>
          {employee.vehicles.map((vehicle) => <div className="employee-vehicle" key={vehicle.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <small>{vehicle.plateNumber} · {vehicle.vehicleType} · {vehicle.department}{vehicle.rfidCardNo ? ` · RFID ${vehicle.rfidCardNo}` : ""}{vehicle.isInside ? " · Inside" : " · Outside"}</small>
            {manageVehicles ? <RemoveParkingAllocationButton endpoint={`/api/companies/${companyId}/employees/${employee.id}/vehicles/${vehicle.id}`} vehicleLabel={vehicle.plateNumber} disabled={vehicle.isInside === true} /> : null}
          </div>)}
        </div>
        {managePeople ? <div className="employee-row-actions">
          <EditEmployeeModal companyId={companyId} employee={employee} departments={departments} />
        </div> : null}
      </article>;
    })}
    <style>{`
      .employee-slot-placeholder{background:#fbfcfb;border-style:dashed}
      .employee-slot-placeholder>div>strong{color:#59665f}
      .employee-roster-list{max-height:620px;overflow:auto;padding-right:3px}
    `}</style>
  </div>;
}
