import VehicleModal from "./VehicleModal";
import RegisterCardButton from "./RegisterCardButton";

type VehicleSummary = { id: string; plateNumber: string; vehicleType: string; department: string; rfidCardNo: string | null };
type EmployeeSummary = { id: string; name: string; userId: string; vehicles: VehicleSummary[] };

export default function EmployeeList({ companyId, employees }: { companyId: string; employees: EmployeeSummary[] }) {
  if (employees.length === 0) return <p className="muted">No employees created yet.</p>;
  return <div className="entity-list">
    {employees.map((employee) => <article className="entity-row employee-row" key={employee.id}>
      <div><strong>{employee.name}</strong><span>User ID: {employee.userId} · Parking allotted: {employee.vehicles.length} · {employee.vehicles.length} vehicle{employee.vehicles.length === 1 ? "" : "s"}</span>
        {employee.vehicles.map((vehicle) => <div className="employee-vehicle" key={vehicle.id}><small>{vehicle.plateNumber} · {vehicle.vehicleType} · {vehicle.department}{vehicle.rfidCardNo ? ` · RFID ${vehicle.rfidCardNo}` : ""}</small><RegisterCardButton employeeId={employee.id} vehicleId={vehicle.id} plateNumber={vehicle.plateNumber} /></div>)}
      </div>
      <VehicleModal companyId={companyId} employeeId={employee.id} ownerName={employee.name} />
    </article>)}
  </div>;
}
