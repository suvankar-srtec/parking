import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isPrimarySuperAdmin } from "@/lib/super-admin-scope";
import Sidebar from "@/components/Sidebar";
import SignOutButton from "@/components/SignOutButton";
import SuperAdminManager from "@/components/SuperAdminManager";

export default async function SuperAdminsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (!isPrimarySuperAdmin(user)) redirect("/dashboard");

  return <main className="dashboard-page">
    <Sidebar role={user.role} canCreateSuperAdmins />
    <section className="dashboard-main">
      <header className="topbar">
        <div><div className="section-kicker">SUPER ADMIN</div><h1>Super Admin accounts</h1></div>
        <div className="topbar-right"><div className="summary-card"><span>User ID</span><strong>{user.userId}</strong></div><SignOutButton /></div>
      </header>
      <SuperAdminManager />
    </section>
  </main>;
}
