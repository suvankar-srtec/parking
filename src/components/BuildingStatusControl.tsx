"use client";

import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";
import styles from "./BuildingStatusControl.module.css";

export default function BuildingStatusControl({ buildingId, buildingName, enabled }: { buildingId: string; buildingName: string; enabled: boolean }) {
  const { pending, execute } = useMutation();
  const { notify, refresh } = useFeedback();
  const [active, setActive] = useState(enabled);
  useEffect(() => setActive(enabled), [enabled]);

  function toggle() {
    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string; building: { enabled: boolean } }>(
        "/api/buildings/" + encodeURIComponent(buildingId), "PATCH", { enabled: !active },
      );
      setActive(result.building.enabled);
      notify(result.message);
      refresh();
    });
  }

  return <div className={styles.control}>
    <span className={active ? styles.enabled : styles.disabled}>{active ? "Enabled" : "Disabled"}</span>
    <ActionButton type="button" className={styles.button} pending={pending} pendingText={active ? "Disabling..." : "Enabling..."} aria-label={(active ? "Disable " : "Enable ") + buildingName} onClick={toggle}>{active ? "Disable" : "Enable"}</ActionButton>
  </div>;
}
