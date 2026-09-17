import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { effectivePermissions, hasPermission } from "@/lib/permissions";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import SupervisorEmployeeParking from "@/components/SupervisorEmployeeParking";

export default async function SupervisorEmployeeParkingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "EMPLOYEE" || !user.buildingId || !hasPermission(user, "supervisor.employeeParking")) redirect("/dashboard");
  const permissions = effectivePermissions(user);

  return <main className="dashboard-page">
    <Sidebar role={user.role} permissions={permissions} />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">SUPERVISOR</div><h1>Employee Parking Allocation</h1></div>
        <div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div>
      </header>
      <SupervisorEmployeeParking />
    </section>
  </main>;
}
