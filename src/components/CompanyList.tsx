"use client";

import { useMemo, useState, type ReactNode } from "react";
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
  integratedHeader = false,
  headerAction,
}: {
  companies: CompanySummary[];
  companyParking: number;
  showUserId?: boolean;
  showPassword?: boolean;
  canManageStatus?: boolean;
  integratedHeader?: boolean;
  headerAction?: ReactNode;
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

  const searchControl = <div className={styles.searchBar}>
    <div className={styles.searchField}>
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search company or User ID"
        aria-label="Search companies"
      />
    </div>
    <span className={styles.searchCount}>{filteredCompanies.length} of {companies.length}</span>
  </div>;

  return <>
    {integratedHeader ? <>
      <div className={styles.integratedHeader}>
        <div>
          <div className="section-kicker">COMPANIES</div>
          <h2>Companies</h2>
        </div>
        <div className={styles.headerTools}>
          {searchControl}
          {headerAction}
        </div>
      </div>
      <div className="portfolio-divider" />
    </> : searchControl}

    {filteredCompanies.length ? <div className={styles.companyList}>
      {filteredCompanies.map((company, index) => {
        const people = company.employees.filter((person) => !person.isPlaceholder);
        const employeeCount = people.filter((person) => person.category !== "OWNER").length;
        const ownerCount = people.filter((person) => person.category === "OWNER").length;
        const userId = company.users[0]?.userId || "-";
        const password = company.users[0]?.password || "";
        const registeredVehicles = company.vehicles.length;
        const ownerShare = company.parkingAllocation > 0
          ? Math.min(100, Math.max(0, (company.ownerParkingAllocation / company.parkingAllocation) * 100))
          : 0;

        return <article className={`${styles.companyCard} ${index % 2 === 1 ? styles.cardBlue : styles.cardWhite}`} key={company.id}>
          <header className={styles.cardHeader}>
            <div className={styles.companyTitleBlock}>
              <div className={styles.companyAvatar} aria-hidden="true">{company.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <h3>{company.name}</h3>
                <span>Company parking account</span>
              </div>
            </div>

            <div className={styles.headerActions}>
              {canManageStatus
                ? <CompanyStatusControl companyId={company.id} companyName={company.name} enabled={company.enabled !== false} />
                : <span className={`${styles.statusBadge} ${company.enabled === false ? styles.statusDisabled : styles.statusEnabled}`}>
                    {company.enabled === false ? "Disabled" : "Enabled"}
                  </span>}
              {showPassword ? <CompanyAdminSettingsModal companyId={company.id} companyName={company.name} parkingAllocation={company.parkingAllocation} /> : null}
            </div>
          </header>

          <div className={styles.cardBody}>
            <section className={styles.infoSection} aria-label={`${company.name} account information`}>
              <div className={styles.sectionHeading}>
                <span>ACCOUNT</span>
                <small>Login details</small>
              </div>

              {showUserId ? <div className={styles.accountIdRow}>
                <span>User ID</span>
                <strong>{userId}</strong>
              </div> : null}

              {showPassword ? <CompanyPasswordField companyId={company.id} password={password} /> : null}
            </section>

            <section className={styles.infoSection} aria-label={`${company.name} people summary`}>
              <div className={styles.sectionHeading}>
                <span>PEOPLE</span>
                <small>Registered users</small>
              </div>
              <dl className={styles.statList}>
                <div><dt>Total people</dt><dd>{people.length}</dd></div>
                <div><dt>Employees</dt><dd>{employeeCount}</dd></div>
                <div><dt>Company owners</dt><dd>{ownerCount}</dd></div>
              </dl>
            </section>

            <section className={`${styles.infoSection} ${styles.parkingSection}`} aria-label={`${company.name} parking summary`}>
              <div className={styles.sectionHeading}>
                <span>PARKING</span>
                <small>Allocation split</small>
              </div>

              <div className={styles.parkingTotal}>
                <div><span>Total parking</span><strong>{company.parkingAllocation}</strong></div>
                <div className={styles.parkingBar} aria-hidden="true">
                  <span className={styles.ownerBar} style={{ width: `${ownerShare}%` }} />
                  <span className={styles.employeeBar} style={{ width: `${100 - ownerShare}%` }} />
                </div>
              </div>

              <dl className={styles.parkingList}>
                <div><dt>Owner parking</dt><dd>{company.ownerParkingAllocation}</dd></div>
                <div><dt>Employee parking</dt><dd>{company.employeeParkingAllocation}</dd></div>
                <div><dt>Registered vehicles</dt><dd>{registeredVehicles}</dd></div>
              </dl>
            </section>
          </div>
        </article>;
      })}
    </div> : <div className={styles.noResults}>No companies match “{query}”.</div>}
  </>;
}
