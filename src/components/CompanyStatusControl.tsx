"use client";

import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

export default function CompanyStatusControl({
  companyId,
  companyName,
  enabled,
}: {
  companyId: string;
  companyName: string;
  enabled: boolean;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

  function toggle() {
    const next = !enabled;
    if (!window.confirm(`${next ? "Enable" : "Disable"} ${companyName}?`)) return;
    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string }>(
        `/api/companies/${companyId}/status`,
        "PATCH",
        { enabled: next },
      );
      notify(result.message);
      refresh();
    });
  }

  return <div className="company-status-control">
    <span className={enabled ? "enabled" : "disabled"}>{enabled ? "Enabled" : "Disabled"}</span>
    <ActionButton
      type="button"
      className="secondary-button"
      pending={pending}
      pendingText={enabled ? "Disabling…" : "Enabling…"}
      onClick={toggle}
    >
      {enabled ? "Disable" : "Enable"}
    </ActionButton>
    <style>{`
      .company-status-control{display:flex;align-items:center;gap:8px}
      .company-status-control>span{display:inline-flex;align-items:center;min-height:24px;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:800}
      .company-status-control>span.enabled{background:#e8f7ef;color:#18714f}
      .company-status-control>span.disabled{background:#fdeceb;color:#b33a35}
      .company-status-control .secondary-button{min-width:86px}
    `}</style>
  </div>;
}
