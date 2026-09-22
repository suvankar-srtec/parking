"use client";

import { useState } from "react";
import Link from "@/components/AppLink";
import BuildingStatusControl from "./BuildingStatusControl";
import AddBuildingModal from "@/components/AddBuildingModal";

type Building = {
  enabled: boolean;
  id: string;
  name: string;
  totalParking: number;
  ownerParking: number;
  companyParking: number;
  _count: { companies: number };
  users: { userId: string; username: string }[];
};

export default function BuildingPortfolio({ buildings }: { buildings: Building[] }) {
  const [query, setQuery] = useState("");
  const normalizedSearch = query.trim().toLowerCase();

  const filteredBuildings = normalizedSearch
    ? buildings.filter((building) => {
      const account = building.users[0];
      return building.name.toLowerCase().includes(normalizedSearch)
        || account?.userId.toLowerCase().includes(normalizedSearch);
    })
    : buildings;

  return <section className="portfolio-card">
    <div className="portfolio-header portfolio-header-search">
      <div>
        <div className="section-kicker">SUPER ADMIN</div>
        <h2>Building portfolio</h2>
        <p>Open a building to view its details, companies, and parking allocation.</p>
      </div>

      <div className="building-search" role="search">
        <label htmlFor="building-search-input" className="sr-only">Building name or User ID</label>
        <div className="building-search-field">
          <span className="building-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            id="building-search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Building name or User ID"
            autoComplete="off"
          />
        </div>
      </div>
    </div>

    <div className="portfolio-divider" />

    {filteredBuildings.length === 0
      ? <p className="muted">No buildings match “{query}”.</p>
      : null}

    <div className="building-grid">
      {filteredBuildings.map((building) => {
        const account = building.users[0];

        return <article className="building-card" key={building.id}>
          <div className="building-card-top">
            <div>
              <span className="tiny-label">Building</span>
              <h3>{building.name}</h3>
            </div>
            <span className="building-code">{account?.userId || "No login"}</span>
          </div>

          <div className="stats-grid">
            <div className="stat-box"><span>Total parking</span><strong>{building.totalParking}</strong></div>
            <div className="stat-box"><span>Owner reserve</span><strong>{building.ownerParking}</strong></div>
            <div className="stat-box"><span>Company parking</span><strong>{building.companyParking}</strong></div>
          </div>

          <BuildingStatusControl
            buildingId={building.id}
            buildingName={building.name}
            enabled={building.enabled}
          />

          <div className="building-footer">
            <span>{building._count.companies} {building._count.companies === 1 ? "company" : "companies"}</span>
            <Link href={`/dashboard/buildings/${building.id}`}>Manage</Link>
          </div>
        </article>;
      })}

      {!normalizedSearch && <AddBuildingModal />}
    </div>

    <style>{`
      .building-search-field{
        position:relative;
        width:min(290px,46vw);
      }

      .building-search-field input{
        width:100%;
        min-width:0;
        height:40px;
        padding:0 38px 0 38px;
        border:1px solid #ccd8d1;
        border-radius:8px;
        background:#fff;
        color:#213128;
        outline:0;
        font-size:12px;
        transition:border-color .15s ease,box-shadow .15s ease;
      }

      .building-search-field input:focus{
        border-color:#7c46ac;
        box-shadow:0 0 0 3px rgba(124,70,172,.10);
      }

      .building-search-field input::placeholder{
        color:#89958e;
      }

      .building-search-icon{
        position:absolute;
        left:12px;
        top:50%;
        transform:translateY(-50%);
        z-index:1;
        display:grid;
        place-items:center;
        color:#7c46ac;
        pointer-events:none;
      }

      .building-search-field input::-webkit-search-cancel-button{
        cursor:pointer;
      }

      @media(max-width:640px){
        .building-search{width:100%}
        .building-search-field{width:100%}
      }
    `}</style>
  </section>;
}
