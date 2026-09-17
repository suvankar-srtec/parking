"use client";

import { requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "./FeedbackProvider";
import { ActionButton } from "./LoadingIndicator";

export default function RemoveParkingAllocationButton({
  endpoint,
  vehicleLabel,
  disabled = false,
}: {
  endpoint: string;
  vehicleLabel: string;
  disabled?: boolean;
}) {
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

  function remove() {
    if (pending || disabled) return;
    const confirmed = window.confirm(
      `Remove parking allocation for ${vehicleLabel}? The RFID card will be released and can be allotted again. Historical scan records will be kept.`,
    );
    if (!confirmed) return;

    void execute(async () => {
      const result = await requestJson(endpoint, "DELETE");
      notify(result.message || "Parking allocation removed successfully.");
      refresh();
    });
  }

  return (
    <ActionButton
      type="button"
      className="secondary-button"
      pending={pending}
      pendingText="Removing..."
      disabled={disabled}
      onClick={remove}
    >
      Remove allocation
    </ActionButton>
  );
}
