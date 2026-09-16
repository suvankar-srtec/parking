import styles from "./CompanyList.module.css";
import CompanyPasswordField from "@/components/CompanyPasswordField";

type CompanySummary = {
  id: string;
  name: string;
  parkingAllocation: number;
  vehicles: { id: string }[];
  employees: { id: string; category: string }[];
  users: { userId: string; username: string; password?: string }[];
};

export default function CompanyList({
  companies,
  companyParking,
  showUserId = false,
  showPassword = false,
}: {
  companies: CompanySummary[];
  companyParking: number;
  showUserId?: boolean;
  showPassword?: boolean;
}) {
  if (companies.length === 0) return <p className="muted">No companies created yet.</p>;

  return <div className="entity-list">
    {companies.map((company) => {
      const employeeCount = company.employees.filter((person) => person.category !== "OWNER").length;
      const userId = company.users[0]?.userId || "-";
      const password = company.users[0]?.password || "";
      const registeredVehicles = company.vehicles.length;
      const availableParking = Math.max(company.parkingAllocation - registeredVehicles, 0);

      return <article className={`entity-row ${styles.row}`} key={company.id}>
        <div className="entity-company-details">
          <strong>{company.name}</strong>
        </div>
        {showUserId ? <div className={styles.companyUserId}>
          <span>User ID</span>
          <strong>{userId}</strong>
        </div> : null}
        {showPassword ? <CompanyPasswordField companyId={company.id} password={password} /> : null}
        <div className={`entity-parking ${styles.metrics}`}>
          <span>Employees <strong>{employeeCount}</strong></span>
          <span>Company Parking <strong>{company.parkingAllocation}</strong></span>
          <span>Registered <strong>{registeredVehicles}</strong></span>
          <span>Available <strong>{availableParking}</strong></span>
        </div>
      </article>;
    })}
  </div>;
}
