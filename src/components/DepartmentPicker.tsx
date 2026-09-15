"use client";

import { useEffect, useId, useRef, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { Spinner } from "./LoadingIndicator";
import styles from "./DepartmentPicker.module.css";

type Department = { id: string; name: string };

export default function DepartmentPicker({ companyId, departments, value, onChange, disabled = false, onBusyChange, onRemoved }: {
  companyId: string;
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onBusyChange: (busy: boolean) => void;
  onRemoved?: (id: string) => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [removed, setRemoved] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState("");
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();
  const options = departments.filter((item) => !removed.includes(item.id));
  const selected = options.find((item) => item.name === value);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  function remove(item: Department) {
    void execute(async () => {
      setDeletingId(item.id);
      onBusyChange(true);
      try {
        const result = await requestJson(
          "/api/companies/" + encodeURIComponent(companyId) + "/departments/" + encodeURIComponent(item.id), "DELETE",
        );
        setRemoved((current) => [...current, item.id]);
        if (value === item.name) onChange("");
        onRemoved?.(item.id);
        notify(result.message || "Department removed.");
        refresh();
      } finally {
        setDeletingId("");
        onBusyChange(false);
        trigger.current?.focus();
      }
    });
  }

  return <div className={styles.field} ref={root} onKeyDown={(event) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }
  }} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
  }}>
    <label id={id + "-label"} htmlFor={id}>Department</label>
    <input type="hidden" name="department" value={selected?.name || ""} />
    <button ref={trigger} id={id} type="button" className={styles.trigger} aria-expanded={open} aria-controls={id + "-options"} disabled={disabled || pending} onClick={() => setOpen(!open)}>
      <span>{selected?.name || "Select department"}</span><span aria-hidden="true">⌄</span>
    </button>
    {open && <div id={id + "-options"} className={styles.options} role="group" aria-labelledby={id + "-label"} aria-busy={pending}>
      {options.length === 0 && <p className={styles.empty}>No departments available.</p>}
      {options.map((item) => <div className={styles.row} key={item.id}>
        <button type="button" className={styles.option} aria-pressed={selected?.id === item.id} disabled={disabled || pending} onClick={() => {
          onChange(item.name);
          setOpen(false);
          trigger.current?.focus();
        }}>{item.name}</button>
        <button type="button" className={styles.remove} aria-label={"Remove " + item.name + " department"} title={"Remove " + item.name + "; assigned employees and vehicles become Unassigned"} disabled={disabled || pending} onClick={() => remove(item)}>
          {deletingId === item.id ? <Spinner /> : <span aria-hidden="true">−</span>}
        </button>
      </div>)}
    </div>}
  </div>;
}
