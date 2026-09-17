"use client";

import type { UserRole } from "@prisma/client";
import { permissionOptionsForRole, type PermissionKey } from "@/lib/permissions";

export default function PermissionChecklist({
  role,
  value,
  onChange,
  disabled = false,
  title,
}: {
  role: UserRole;
  value: PermissionKey[];
  onChange: (value: PermissionKey[]) => void;
  disabled?: boolean;
  title?: string;
}) {
  const options = permissionOptionsForRole(role);

  function toggle(key: PermissionKey, checked: boolean) {
    if (checked) onChange(Array.from(new Set([...value, key])));
    else onChange(value.filter((item) => item !== key));
  }

  return <section className="permission-panel" aria-label={`${title || "Feature access"} permissions`}>
    <div className="permission-panel-head">
      <div>
        <div className="section-kicker">FEATURE ACCESS</div>
        <h3>{title || "Permissions"}</h3>
      </div>
      <span>{value.length}/{options.length} enabled</span>
    </div>
    <p className="permission-scope-note">Scope is fixed by the account role. Unchecking a feature removes access for this user only.</p>
    <div className="permission-list">
      {options.map((option) => {
        const checked = value.includes(option.key);
        return <label className={`permission-row${checked ? " checked" : ""}`} key={option.key}>
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => toggle(option.key, event.target.checked)}
          />
          <span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </span>
        </label>;
      })}
    </div>
    <style>{`
      .permission-panel{min-width:0;border:1px solid #d9e1dd;border-radius:9px;background:#f9fbfa;padding:12px}
      .permission-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding-bottom:8px;border-bottom:1px solid #e2e8e4}
      .permission-panel-head h3{margin:3px 0 0;font-size:14px}
      .permission-panel-head>span{padding:4px 7px;border-radius:999px;background:#efe7f5;color:#6d3998;font-size:9px;font-weight:800;white-space:nowrap}
      .permission-scope-note{margin:8px 0;color:#6b7770;font-size:9.5px;line-height:1.4}
      .permission-list{display:grid;gap:5px}
      .permission-row{display:grid!important;grid-template-columns:18px minmax(0,1fr);gap:7px!important;align-items:start;padding:7px 8px;border:1px solid #e0e7e3;border-radius:7px;background:#fff;cursor:pointer}
      .permission-row.checked{border-color:#d6c2e5;background:#fcf9fe}
      .permission-row input{width:15px!important;height:15px;margin:1px 0 0;padding:0!important;accent-color:#7c46ac;box-shadow:none!important}
      .permission-row span{display:block;min-width:0}
      .permission-row strong{display:block;color:#26382f;font-size:10.5px;line-height:1.2}
      .permission-row small{display:block;margin-top:2px;color:#738078;font-size:8.5px;font-weight:500;line-height:1.3}
    `}</style>
  </section>;
}
