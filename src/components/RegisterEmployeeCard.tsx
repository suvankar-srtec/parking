import EmployeeCreateModal, { type CreatedEmployee } from "./EmployeeCreateModal";

type Props = {
  companyId: string;
  buildingId: string;
  employee: CreatedEmployee;
  vehicle?: { id: string; plateNumber: string; isInside: boolean };
  departments: { id: string; name: string }[];
  maximumDepartments: number;
  disabled?: boolean;
};

export default function RegisterEmployeeCard({ companyId, buildingId, employee, vehicle, departments, maximumDepartments, disabled }: Props) {
  return <EmployeeCreateModal
    companyId={companyId} departments={departments} maximumDepartments={maximumDepartments}
    registration={{ employee, buildingId, vehicle }} disabled={disabled}
  />;
}
