type CompanySummary = {
  id: string;
  name: string;
  parkingAllocation: number;
  vehicles: { id: string }[];
  users: { userId: string; username: string }[];
};

export default function CompanyList({ companies, companyParking }: { companies: CompanySummary[]; companyParking: number }) {
  if (companies.length === 0) return <p className="muted">No companies created yet.</p>;

  return <div className="entity-list">
    {companies.map((company) => <article className="entity-row" key={company.id}>
      <div>
        <strong>{company.name}</strong>
        <span>User ID: {company.users[0]?.userId || "-"} · Username: {company.users[0]?.username || "-"}</span>
      </div>
      <div className="entity-parking">
        <span>Allotted <strong>{company.vehicles.length}</strong></span>
        <span>Unallotted <strong>{Math.max(company.parkingAllocation - company.vehicles.length, 0)}</strong></span>
      </div>
    </article>)}
  </div>;
}
