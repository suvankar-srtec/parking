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
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filteredBuildings = normalizedSearch
    ? buildings.filter((building) => {
      const account = building.users[0];
      return building.name.toLowerCase().includes(normalizedSearch) || account?.userId.toLowerCase().includes(normalizedSearch);
    })
    : buildings;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(query);
  }

  function clearSearch() {
    setQuery("");
    setSearch("");
  }

  return <section className="portfolio-card">
    <div className="portfolio-header portfolio-header-search">
      <div>
        <div className="section-kicker">SUPER ADMIN</div>
        <h2>Building portfolio</h2>
        <p>Open a building to view its details, companies, and parking allocation.</p>
      </div>
      <form className="building-search" onSubmit={submit} role="search">
        <label htmlFor="building-search-input" className="sr-only">Building name or User ID</label>
        <input id="building-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Building name or User ID" />
        <button type="submit" className="primary-button">Search</button>
        {search && <button type="button" className="secondary-button" onClick={clearSearch}>Clear</button>}
      </form>
    </div>
    <div className="portfolio-divider" />
    {filteredBuildings.length === 0 ? <p className="muted">No buildings match “{search}”.</p> : null}
    <div className="building-grid">
      {filteredBuildings.map((building) => {
        const account = building.users[0];
        return <article className="building-card" key={building.id}>
          <div className="building-card-top">
            <div><span className="tiny-label">Building</span><h3>{building.name}</h3></div>
            <span className="building-code">{account?.userId || "No login"}</span>
          </div>
          <div className="stats-grid">
            <div className="stat-box"><span>Total parking</span><strong>{building.totalParking}</strong></div>
            <div className="stat-box"><span>Owner reserve</span><strong>{building.ownerParking}</strong></div>
            <div className="stat-box"><span>Company parking</span><strong>{building.companyParking}</strong></div>
          </div>
          <BuildingStatusControl buildingId={building.id} buildingName={building.name} enabled={building.enabled} />
          <div className="building-footer">
            <span>{building._count.companies} {building._count.companies === 1 ? "company" : "companies"}</span>
            <Link href={`/dashboard/buildings/${building.id}`}>Manage</Link>
          </div>
        </article>;
      })}
      {!normalizedSearch && <AddBuildingModal />}
    </div>
  </section>;
}
