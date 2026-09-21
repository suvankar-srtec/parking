import { notFound, redirect } from "next/navigation";
import AppLink from "@/components/AppLink";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import RegisterEmployeeCard from "@/components/RegisterEmployeeCard";
import EmployeeCreateModal from "@/components/EmployeeCreateModal";
import { getCurrentUser } from "@/lib/session";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import { companyCardScope } from "@/lib/company-card-access";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

export default async function CompanyCardsPage({ params }: { params: Promise<{ companyId: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN", "BUILDING_ADMIN"].includes(user.role)) redirect("/dashboard");
  if (user.role === "BUILDING_ADMIN" && !hasPermission(user, "building.configureReaders")) redirect("/dashboard");
  const { companyId } = await params;
  const company = await prisma.company.findFirst({
    where: { AND: [{ id: companyId }, companyCardScope(user)] },
    select: {
      id: true, name: true, buildingId: true, maximumDepartments: true,
      building: { select: { name: true, enabled: true } },
      departments: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      employees: {
        where: { isPlaceholder: false }, orderBy: [{ name: "asc" }, { id: "asc" }],
        select: {
          id: true, name: true, userId: true, category: true, department: true, parkingLimit: true,
          vehicles: { orderBy: { createdAt: "asc" }, select: { id: true, plateNumber: true, rfidCardNo: true, isInside: true } },
        },
      },
    },
  });
  if (!company) notFound();
  const registered = company.employees.filter(person => person.vehicles.some(vehicle => vehicle.rfidCardNo)).length;

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={effectivePermissions(user)} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">REGISTER RFID CARDS</div><h1>{company.name}</h1><p className={styles.building}>{company.building.name}</p></div>
        <div className="topbar-right"><AppLink href="/access-control/register-cards" className="secondary-button">← All companies</AppLink>
          {user.role === "BUILDING_ADMIN" ? <EmployeeCreateModal
            companyId={company.id}
            departments={company.departments}
            maximumDepartments={company.maximumDepartments}
            canManageVehicles
            canRegisterRfid
            disabled={!company.building.enabled}
          /> : null}
          <SignOutButton /></div>
      </header>
      <section className="portfolio-card building-management">
        <div className="portfolio-header">
          <div><div className="section-kicker">COMPANY EMPLOYEES</div><h2>Employees &amp; RFID cards</h2><p>Use Register card to open the employee/company-owner setup flow and continue to vehicle and RFID registration.</p></div>
          <div className={styles.summary}><span><strong>{company.employees.length}</strong> Employees</span><span><strong>{registered}</strong> With cards</span></div>
        </div>
        <div className="portfolio-divider" />
        {!company.building.enabled && <p className={styles.notice}>This building is disabled. Enable it before registering cards.</p>}
        {company.employees.length ? <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">Employees and RFID cards for {company.name}</caption>
            <thead><tr><th scope="col">Employee</th><th scope="col">Vehicle</th><th scope="col">RFID card number</th><th scope="col">Registration</th></tr></thead>
            <tbody>{company.employees.flatMap(employee => {
              const vehicles = employee.vehicles.length ? employee.vehicles : [null];
              return vehicles.map((vehicle, index) => <tr key={vehicle?.id || employee.id}>
                {index === 0 && <th scope="row" rowSpan={vehicles.length} className={styles.person}>
                  <strong>{employee.name}</strong><span>{employee.userId} · {employee.category === "OWNER" ? "Company owner" : "Employee"}</span><span>{employee.department}</span>
                </th>}
                <td>{vehicle?.plateNumber || <span className={styles.muted}>No vehicle added</span>}</td>
                <td>{vehicle?.rfidCardNo ? <code className={styles.cardNumber}>{vehicle.rfidCardNo}</code> : <span className={styles.missing}>Not registered</span>}</td>
                <td>{vehicle?.rfidCardNo ? <span className={styles.registered}>Registered</span> : <RegisterEmployeeCard
                  companyId={company.id} buildingId={company.buildingId} employee={employee}
                  vehicle={vehicle || undefined} departments={company.departments} maximumDepartments={company.maximumDepartments} disabled={!company.building.enabled}
                />}</td>
              </tr>);
            })}</tbody>
          </table>
        </div> : <div className={styles.empty}>No employees have been added to this company yet. Use Add Employee above to get started.</div>}
      </section>
    </section>
  </main>;
}
