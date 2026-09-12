type CompanySummary = {
  id: string;
  name: string;
  parkingAllocation: number;
  vehicles: { id: string }[];
  employees: { id: string; category: string }[];
  users: { userId: string; username: string }[];
};

export default function CompanyList({ companies, companyParking }: { companies: CompanySummary[]; companyParking: number }) {
  if (companies.length === 0) return <p className="muted">No companies created yet.</p>;

  return <div className="entity-list">
    {companies.map((company) => {
      const employeeCount = company.employees.filter((person) => person.category !== "OWNER").length;
      return <article className="entity-row" key={company.id}>
        <div className="entity-company-details">
          <strong>{company.name}</strong>
          <span>User ID: {company.users[0]?.userId || "-"} · Username: {company.users[0]?.username || "-"}</span>
        </div>
        <div className="entity-company-employees">
          <span>Employees</span>
          <strong>{employeeCount}</strong>
        </div>
        <div className="entity-parking">
          <span>Allotted <strong>{company.vehicles.length}</strong></span>
          <span>Unallotted <strong>{Math.max(company.parkingAllocation - company.vehicles.length, 0)}</strong></span>
        </div>
      </article>;
    })}
  </div>;
}
