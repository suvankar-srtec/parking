"use client";

import { useRef, type FormEvent } from "react";
import { checkForm, requestJson } from "@/lib/client-request";
import { useFeedback, useMutation } from "@/components/FeedbackProvider";
import { ActionButton } from "@/components/LoadingIndicator";
import styles from "./VisitorForm.module.css";

export default function VisitorForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { notify, refresh } = useFeedback();
  const { pending, execute } = useMutation();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const error = checkForm(event.currentTarget);
    if (error) {
      notify(error, "error");
      return;
    }

    const data = new FormData(event.currentTarget);
    const validFromText = String(data.get("validFrom") ?? "");
    const validUntilText = String(data.get("validUntil") ?? "");
    const validFrom = new Date(validFromText);
    const validUntil = new Date(validUntilText);

    if (!validFromText || Number.isNaN(validFrom.getTime())) {
      notify("Please enter Valid From date and time.", "error");
      return;
    }
    if (!validUntilText || Number.isNaN(validUntil.getTime())) {
      notify("Please enter Valid Until date and time.", "error");
      return;
    }
    if (validUntil <= validFrom) {
      notify("Valid Until must be later than Valid From.", "error");
      return;
    }

    const body = {
      name: String(data.get("name") ?? "").trim(),
      phoneNumber: String(data.get("phoneNumber") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      vehicleNumber: String(data.get("vehicleNumber") ?? "").trim(),
      accessory: String(data.get("accessory") ?? "").trim(),
      validFrom: validFrom.toISOString(),
      validUntil: validUntil.toISOString(),
    };

    void execute(async () => {
      const result = await requestJson<{ ok: true; message: string; visitor: { id: string } }>(
        "/api/visitors",
        "POST",
        body,
      );
      formRef.current?.reset();
      notify(result.message || "Visitor details saved successfully.");
      refresh();
    });
  }

  return <form ref={formRef} className={styles.form} noValidate onSubmit={submit}>
    <fieldset className={styles.fieldset} disabled={pending}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Name</span>
          <input name="name" type="text" autoComplete="name" maxLength={120} required placeholder="Enter visitor name" />
        </label>

        <label className={styles.field}>
          <span>Phone Number</span>
          <input name="phoneNumber" type="tel" autoComplete="tel" minLength={7} maxLength={30} required placeholder="Enter phone number" />
        </label>

        <label className={styles.field}>
          <span>Mail</span>
          <input name="email" type="email" autoComplete="email" maxLength={180} required placeholder="Enter email address" />
        </label>

        <label className={styles.field}>
          <span>Vehicle Number <small>(if any)</small></span>
          <input name="vehicleNumber" type="text" autoCapitalize="characters" maxLength={40} placeholder="e.g. WB 24 AB 1234" />
        </label>

        <label className={styles.field}>
          <span>Accessory</span>
          <input name="accessory" type="text" maxLength={250} required placeholder="e.g. Laptop, bag, tools" />
        </label>

        <label className={styles.field}>
          <span>Valid From</span>
          <input name="validFrom" type="datetime-local" required />
        </label>

        <label className={styles.field}>
          <span>Valid Until</span>
          <input name="validUntil" type="datetime-local" required />
        </label>
      </div>
    </fieldset>

    <div className={styles.actions}>
      <button type="reset" className="secondary-button" disabled={pending}>Clear</button>
      <ActionButton type="submit" className="primary-button" pending={pending} pendingText="Saving visitor...">
        Save Visitor
      </ActionButton>
    </div>
  </form>;
}
