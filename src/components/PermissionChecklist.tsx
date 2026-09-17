"use client";

import type { UserRole } from "@prisma/client";
import { permissionOptionsForRole, type PermissionKey } from "@/lib/permissions";

function rolePermissionLabel(role: UserRole) {
  if (role === "BUILDING_ADMIN") return "Building Admin Permissions";
  if (role === "COMPANY_ADMIN" || role === "BUILDING_OWNER") return "Company / User Permissions";
  if (role === "EMPLOYEE") return "Supervisor Permissions";
  return "Permissions";
}

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
  const allSelected = options.length > 0 && value.length === options.length;

  function toggle(key: PermissionKey, checked: boolean) {
    if (checked) onChange(Array.from(new Set([...value, key])));
    else onChange(value.filter((item) => item !== key));
  }

  function selectAll() {
    if (disabled) return;
    onChange(options.map((option) => option.key));
  }

  function deselectAll() {
    if (disabled) return;
    onChange([]);
  }

  return <section className="permission-panel" aria-label={`${title || "Feature access"} permissions`}>
    <div className="permission-title-row">
      <label>{title || "Permissions Allowed"}</label>
      <span>{value.length}/{options.length}</span>
    </div>

    <div className="permission-tree" role="group" aria-label={rolePermissionLabel(role)}>
      <div className="permission-tree-root">
        <span className="permission-tree-branch" aria-hidden="true">−</span>
        <input
          type="checkbox"
          checked={allSelected}
          disabled={disabled}
          aria-label={`Select all ${rolePermissionLabel(role)}`}
          onChange={(event) => event.target.checked ? selectAll() : deselectAll()}
        />
        <strong>{rolePermissionLabel(role)}</strong>
      </div>

      <div className="permission-tree-items">
        {options.map((option) => {
          const checked = value.includes(option.key);
          return <label className="permission-tree-item" key={option.key} title={option.description}>
            <span className="permission-tree-line" aria-hidden="true" />
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={(event) => toggle(option.key, event.target.checked)}
            />
            <span className="permission-tree-text">
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </span>
          </label>;
        })}
      </div>
    </div>

    <div className="permission-actions" aria-label="Permission selection controls">
      <button type="button" disabled={disabled || allSelected} onClick={selectAll}>Select All</button>
      <button type="button" disabled={disabled || value.length === 0} onClick={deselectAll}>Deselect All</button>
    </div>

    <p className="permission-scope-note">Only the checked items are available to this user. The account remains restricted to its assigned building or company.</p>

    <style>{`
      .permission-panel{min-width:0;display:flex;flex-direction:column;gap:6px}
      .permission-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;color:#2d3c34;font-size:11px;font-weight:800}
      .permission-title-row>span{min-width:34px;padding:3px 7px;border:1px solid #d8e0dc;border-radius:4px;background:#f4f7f5;color:#6b4a83;text-align:center;font-size:9px}
      .permission-tree{height:300px;overflow:auto;border:1px solid #aebbb4;background:#fff;padding:5px 4px;font-size:11px;box-shadow:inset 0 1px 2px rgba(22,36,28,.05)}
      .permission-tree-root{display:grid;grid-template-columns:13px 15px minmax(0,1fr);align-items:center;gap:4px;min-height:22px;padding:1px 3px;color:#1f3027}
      .permission-tree-root strong{font-size:11px}
      .permission-tree-branch{width:11px;height:11px;display:grid;place-items:center;border:1px solid #78877f;background:#fff;color:#516058;font-size:9px;line-height:1}
      .permission-tree input{width:13px!important;height:13px;margin:0;padding:0!important;accent-color:#675084;box-shadow:none!important}
      .permission-tree-items{position:relative;margin-left:12px;padding-left:12px}
      .permission-tree-items:before{content:"";position:absolute;left:4px;top:0;bottom:10px;border-left:1px dotted #9aa69f}
      .permission-tree-item{position:relative;display:grid!important;grid-template-columns:8px 15px minmax(0,1fr);align-items:start;gap:4px!important;min-height:24px;padding:3px 3px 3px 0!important;color:#26362d;cursor:pointer}
      .permission-tree-line{height:10px;margin-top:1px;border-bottom:1px dotted #9aa69f}
      .permission-tree-text{display:block;min-width:0;line-height:1.2}
      .permission-tree-text strong{display:block;font-size:10.5px;font-weight:600;color:#24342b}
      .permission-tree-text small{display:none;margin-top:2px;color:#748078;font-size:8px;font-weight:500}
      .permission-tree-item:hover .permission-tree-text small{display:block}
      .permission-tree-item:hover{background:#f5f7fb}
      .permission-actions{display:flex;gap:18px;padding:2px 1px 0}
      .permission-actions button{border:0;background:transparent;padding:0;color:#4f43b5;text-decoration:underline;font-size:9.5px;font-weight:600;cursor:pointer}
      .permission-actions button:disabled{color:#9da7a1;text-decoration:none;cursor:default;opacity:1}
      .permission-scope-note{margin:3px 0 0;color:#6e7973;font-size:9px;line-height:1.4}
      @media(max-width:720px){.permission-tree{height:240px}}
    `}</style>
  </section>;
}
