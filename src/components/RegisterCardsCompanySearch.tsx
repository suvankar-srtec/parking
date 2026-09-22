"use client";

import { useMemo, useState } from "react";
import AppLink from "@/components/AppLink";

type Company = {
  id: string;
  name: string;
  parkingAllocation: number;
  building: { name: string };
  users: { userId: string }[];
  vehicles: { id: string; rfidCardNo: string | null }[];
};

export default function RegisterCardsCompanySearch({ companies }: { companies: Company[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return companies;
    return companies.filter((company) => [
      company.name,
      company.building.name,
      company.users[0]?.userId || "",
    ].some((value) => value.toLowerCase().includes(search)));
  }, [companies, query]);

  return <>
    <div className="rfid-auto-search">
      <div className="rfid-auto-search-field">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search company, building or User ID"
          aria-label="Search companies"
        />
      </div>
      <span>{filtered.length} of {companies.length}</span>
    </div>

    {filtered.length ? <div className="rfid-company-grid">
      {filtered.map((company) => {
        const companyRegistered = company.vehicles.filter((vehicle) => Boolean(vehicle.rfidCardNo)).length;
        return <AppLink className="rfid-company-card" key={company.id} href={`/access-control/register-cards/${company.id}`}>
          <div className="rfid-company-card-head">
            <div>
              <span>{company.building.name}</span>
              <strong>{company.name}</strong>
            </div>
            <span className="rfid-company-user-id">{company.users[0]?.userId || "No user"}</span>
          </div>
          <div className="rfid-company-stats">
            <div><span>Parking allotted</span><strong>{company.parkingAllocation}</strong></div>
            <div><span>Vehicles</span><strong>{company.vehicles.length}</strong></div>
            <div><span>RFID registered</span><strong>{companyRegistered}</strong></div>
          </div>
          <span className="rfid-company-open">View employees &amp; register cards <span aria-hidden="true">→</span></span>
        </AppLink>;
      })}
    </div> : <div className="rfid-company-empty">No companies match “{query}”.</div>}
  </>;
}
