import CreateEntityModal from "./CreateEntityModal";

export default function BuildingAdminPanel({ buildingId }: { buildingId: string }) {
  return <div className="detail-actions"><CreateEntityModal kind="company" buildingId={buildingId} /></div>;
}
