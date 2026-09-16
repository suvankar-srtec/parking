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
      return <article className={`entity-row ${styles.row}`} key={company.id}>
        <div className="entity-company-details">
          <strong>{company.name}</strong>
        </div>
        {showUserId ? <div className={styles.companyUserId}>
          <span>User ID</span>
          <strong>{userId}</strong>
        </div> : null}
        {showPassword ? <CompanyPasswordField password={password} /> : null}
        <div className={`entity-parking ${styles.metrics}`}>
          <span>Employees <strong>{employeeCount}</strong></span>
          <span>Allotted <strong>{company.vehicles.length}</strong></span>
          <span>Unallotted <strong>{Math.max(company.parkingAllocation - company.vehicles.length, 0)}</strong></span>
        </div>
      </article>;
    })}
  </div>;
}
