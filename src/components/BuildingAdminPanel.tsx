import AdminCompanyModal from "./AdminCompanyModal";

export default function BuildingAdminPanel({ buildingId }: { buildingId: string }) {
  return <div className="detail-actions"><AdminCompanyModal buildingId={buildingId} /></div>;
}
