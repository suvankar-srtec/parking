"use client";

import { useState } from "react";

type OwnerVehicle = {
  id: string;
  ownerName: string;
  plateNumber: string;
  vehicleType: string;
  rfidCardNo: string | null;
  isInside: boolean;
};

export default function OwnerVehicleDetailsList({ vehicles }: { vehicles: OwnerVehicle[] }) {
  const [selected, setSelected] = useState<OwnerVehicle | null>(null);

  return <>
    <div className="owner-name-list">
      {vehicles.map((vehicle) => <button
        key={vehicle.id}
        type="button"
        className="owner-name-button"
        onClick={() => setSelected(vehicle)}
      >
        {vehicle.ownerName}
      </button>)}
    </div>

    {selected ? <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSelected(null);
      }}
    >
      <section
        className="modal-card small-modal owner-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-details-title"
      >
        <div className="modal-head">
          <div>
            <div className="section-kicker">OWNER PARKING</div>
            <h2 id="owner-details-title">{selected.ownerName}</h2>
            <p>Registered Owner Parking vehicle details.</p>
          </div>
          <button
            type="button"
            className="modal-close"
            aria-label="Close owner details"
            onClick={() => setSelected(null)}
          >
            ×
          </button>
        </div>

        <div className="owner-details-grid">
          <div><span>Owner name</span><strong>{selected.ownerName}</strong></div>
          <div><span>Vehicle number</span><strong>{selected.plateNumber}</strong></div>
          <div><span>Vehicle type</span><strong>{selected.vehicleType}</strong></div>
          <div><span>RFID card number</span><strong>{selected.rfidCardNo || "Not registered"}</strong></div>
          <div><span>Status</span><strong className={selected.isInside ? "owner-status-inside" : "owner-status-outside"}>{selected.isInside ? "Inside" : "Outside"}</strong></div>
        </div>
      </section>
    </div> : null}

    <style>{`
      .owner-name-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
      .owner-name-button{border:1px solid #d5dfda;border-radius:8px;background:#fff;padding:9px 12px;color:#17271f;font-size:12px;font-weight:800;cursor:pointer}
      .owner-name-button:hover{border-color:#b99ace;background:#f6f0fa;color:#6f3d9c}
      .owner-details-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}
      .owner-details-grid>div{padding:12px;border:1px solid #dbe3df;border-radius:8px;background:#f8faf9}
      .owner-details-grid span{display:block;color:#69766f;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.35px}
      .owner-details-grid strong{display:block;margin-top:5px;color:#223129;font-size:13px;overflow-wrap:anywhere}
      .owner-status-inside{color:#16824f!important}
      .owner-status-outside{color:#6f7772!important}
      @media(max-width:560px){.owner-details-grid{grid-template-columns:1fr}}
    `}</style>
  </>;
}
