import VehicleModal from "./VehicleModal";
import EditEmployeeModal from "./EditEmployeeModal";
import RemoveParkingAllocationButton from "./RemoveParkingAllocationButton";

type DepartmentOption = { id: string; name: string };
type VehicleSummary = { id: string; plateNumber: string; vehicleType: string; department: string; rfidCardNo: string | null; isInside?: boolean };
type EmployeeSummary = { id: string; name: string; userId: string; category: string; parkingLimit: number; department: string; vehicles: VehicleSummary[] };

export default function EmployeeList({ companyId, employees, departments }: { companyId: string; employees: EmployeeSummary[]; departments: DepartmentOption[] }) {
  if (employees.length === 0) return <p className="muted">No employees or company owners created yet.</p>;
  return <div className="entity-list">
    {employees.map((employee) => {
      const used = employee.vehicles.length;
      const available = Math.max(employee.parkingLimit - used, 0);
      const parkingFull = used >= employee.parkingLimit;
      return <article className="entity-row employee-row" key={employee.id}>
        <div>
          <strong>{employee.name} <span className="tiny-label">{employee.category === "OWNER" ? "Company Owner" : "Employee"}</span></strong>
          <span>User ID: {employee.userId} · Department: {employee.department} · Parking limit: {employee.parkingLimit} · Used: {used} · Available: {available}</span>
          {employee.vehicles.map((vehicle) => <div className="employee-vehicle" key={vehicle.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <small>{vehicle.plateNumber} · {vehicle.vehicleType} · {vehicle.department}{vehicle.rfidCardNo ? ` · RFID ${vehicle.rfidCardNo}` : ""}{vehicle.isInside ? " · Inside" : " · Outside"}</small>
            <RemoveParkingAllocationButton
              endpoint={`/api/companies/${companyId}/employees/${employee.id}/vehicles/${vehicle.id}`}
              vehicleLabel={vehicle.plateNumber}
              disabled={vehicle.isInside === true}
            />
          </div>)}
        </div>
        <div className="employee-row-actions">
          <EditEmployeeModal companyId={companyId} employee={employee} departments={departments} />
          {parkingFull ? <button type="button" className="secondary-button vehicle-add-button" disabled>Vehicle Added</button> : <VehicleModal companyId={companyId} employeeId={employee.id} ownerName={employee.name} departments={departments} defaultDepartment={employee.department} />}
        </div>
      </article>;
    })}
  </div>;
}
