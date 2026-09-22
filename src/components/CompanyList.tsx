"use client";

import { useMemo, useState } from "react";
import styles from "./CompanyList.module.css";
import CompanyPasswordField from "@/components/CompanyPasswordField";
import CompanyAdminSettingsModal from "@/components/CompanyAdminSettingsModal";
import CompanyStatusControl from "@/components/CompanyStatusControl";

type CompanySummary = {
  id: string;
  name: string;
  parkingAllocation: number;
  enabled?: boolean;
  ownerParkingAllocation: number;
  employeeParkingAllocation: number;
  vehicles: { id: string }[];
  employees: { id: string; category: string; isPlaceholder?: boolean }[];
  users: { userId: string; username: string; password?: string }[];
};

export default function CompanyList({
  companies,
  companyParking,
  showUserId = false,
  showPassword = false,
  canManageStatus = false,
}: {
  companies: CompanySummary[];
  companyParking: number;
  showUserId?: boolean;
  showPassword?: boolean;
  canManageStatus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filteredCompanies = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return companies;
    return companies.filter((company) => {
      const account = company.users[0];
      return [
        company.name,
        account?.userId || "",
        account?.username || "",
      ].some((value) => value.toLowerCase().includes(search));
    });
  }, [companies, query]);

  if (companies.length === 0) return <p className="muted">No companies created yet.</p>;

  return <>
    <div className={styles.searchBar}>
      <div className={styles.searchField}>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search company name or User ID"
          aria-label="Search companies"
        />
      </div>
      <span className={styles.searchCount}>{filteredCompanies.length} of {companies.length}</span>
    </div>

    {filteredCompanies.length ? <div className="entity-list">
    {filteredCompanies.map((company) => {
      const people = company.employees.filter((person) => !person.isPlaceholder);
      const employeeCount = people.filter((person) => person.category !== "OWNER").length;
      const ownerCount = people.filter((person) => person.category === "OWNER").length;
      const userId = company.users[0]?.userId || "-";
      const password = company.users[0]?.password || "";
      const registeredVehicles = company.vehicles.length;

      return <article className={`entity-row ${styles.row}`} key={company.id}>
        <div className={styles.companyIdentity}>
          <div className="entity-company-details">
            <strong>{company.name}</strong>
            <span>Company account and allocation summary</span>
          </div>
          {showUserId ? <div className={styles.companyUserId}>
            <span>User ID</span>
            <strong>{userId}</strong>
          </div> : null}
          {showPassword ? <CompanyPasswordField companyId={company.id} password={password} /> : null}
          <div className={styles.companyActions}>
            {canManageStatus ? <CompanyStatusControl companyId={company.id} companyName={company.name} enabled={company.enabled !== false} /> : null}
            {showPassword ? <CompanyAdminSettingsModal companyId={company.id} companyName={company.name} parkingAllocation={company.parkingAllocation} /> : null}
          </div>
        </div>

        <div className={styles.summaryPanel}>
          <section className={styles.summaryGroup} aria-label={`${company.name} people summary`}>
            <div className={styles.groupTitle}>
              <span>PEOPLE</span>
              <small>Registered people and current roles</small>
            </div>
            <div className={styles.peopleGrid}>
              <div className={styles.metricCard}>
                <span>Total People</span>
                <strong>{people.length}</strong>
                <small>Registered people</small>
              </div>
              <div className={styles.metricCard}>
                <span>Employees</span>
                <strong>{employeeCount}</strong>
                <small>Employee roster</small>
              </div>
              <div className={styles.metricCard}>
                <span>Company Owners</span>
                <strong>{ownerCount}</strong>
                <small>Owner roster</small>
              </div>
            </div>
          </section>

          <section className={styles.summaryGroup} aria-label={`${company.name} parking summary`}>
            <div className={styles.groupTitle}>
              <span>PARKING</span>
              <small>Admin allocation and Company/User split</small>
            </div>
            <div className={styles.parkingGrid}>
              <div className={`${styles.metricCard} ${styles.primaryMetric}`}>
                <span>Total Parking</span>
                <strong>{company.parkingAllocation}</strong>
                <small>Assigned by Admin</small>
              </div>
              <div className={styles.metricCard}>
                <span>Owner Parking</span>
                <strong>{company.ownerParkingAllocation}</strong>
                <small>For Company Owners</small>
              </div>
              <div className={styles.metricCard}>
                <span>Employee Parking</span>
                <strong>{company.employeeParkingAllocation}</strong>
                <small>For Employees</small>
              </div>
              <div className={styles.metricCard}>
                <span>Registered Vehicles</span>
                <strong>{registeredVehicles}</strong>
                <small>Vehicles with allocation</small>
              </div>
            </div>
          </section>
        </div>
      </article>;
    })}
  </div> : <div className={styles.noResults}>No companies match “{query}”.</div>}
  </>;
}
