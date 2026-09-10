import Sidebar from "@/components/Sidebar";
import LoadingIndicator from "@/components/LoadingIndicator";

export default function DashboardLoading() {
  return <main className="dashboard-page"><Sidebar /><section className="dashboard-main"><LoadingIndicator /></section></main>;
}
