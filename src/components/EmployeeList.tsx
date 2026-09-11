import VehicleModal from "./VehicleModal";
import RegisterCardButton from "./RegisterCardButton";

type VehicleSummary = { id: string; plateNumber: string; vehicleType: string; department: string; rfidCardNo: string | null };
type EmployeeSummary = { id: string; name: string; userId: string; category: string; parkingLimit: number; vehicles: VehicleSummary[] };

export default function EmployeeList({ companyId, employees }: { companyId: string; employees: EmployeeSummary[] }) {
  if (employees.length === 0) return <p className="muted">No employees or company owners created yet.</p>;
  return <div className="entity-list">
    {employees.map((employee) => <article className="entity-row employee-row" key={employee.id}>
      <div>
        <strong>{employee.name} <span className="tiny-label">{employee.category === "OWNER" ? "Company Owner" : "Employee"}</span></strong>
        <span>User ID: {employee.userId} · Parking limit: {employee.parkingLimit} · Used: {employee.vehicles.length} · Available: {Math.max(employee.parkingLimit - employee.vehicles.length, 0)}</span>
        {employee.vehicles.map((vehicle) => <div className="employee-vehicle" key={vehicle.id}><small>{vehicle.plateNumber} · {vehicle.vehicleType} · {vehicle.department}{vehicle.rfidCardNo ? ` · RFID ${vehicle.rfidCardNo}` : ""}</small><RegisterCardButton employeeId={employee.id} vehicleId={vehicle.id} plateNumber={vehicle.plateNumber} /></div>)}
      </div>
      <VehicleModal companyId={companyId} employeeId={employee.id} ownerName={employee.name} />
    </article>)}
  </div>;
}
