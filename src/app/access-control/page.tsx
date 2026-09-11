import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import ReaderConsole from "@/components/ReaderConsole";
import SignOutButton from "@/components/SignOutButton";
export default async function AccessControlPage() {
  const user = await getCurrentUser();
  if (!user || !["SUPER_ADMIN","BUILDING_ADMIN","COMPANY_ADMIN"].includes(user.role)) redirect("/");
  return <main className="dashboard-page"><Sidebar roleLabel={user.role.replaceAll("_", " ")} dashboardHref={user.role === "SUPER_ADMIN" ? "/dashboard" : "/account"} dashboardLabel={user.role === "SUPER_ADMIN" ? "Buildings" : "My account"} />
    <section className="dashboard-main"><header className="topbar"><div><div className="section-kicker">BUILDING PARKING</div><h1>RFID access</h1></div><SignOutButton /></header><ReaderConsole /></section></main>;
}
