export async function requestJson<T extends { ok: boolean; message?: string }>(
  url: string, method: "POST" | "PATCH", body?: unknown, signal?: AbortSignal,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error("The server could not be reached. Please check your connection and try again.");
  }
  let data: T;
  try { data = await response.json(); }
  catch { throw new Error("The server could not complete this request. Please try again."); }
  if (!response.ok || !data.ok) throw new Error(data.message || "This request could not be completed.");
  return data;
}

export function checkForm(form: HTMLFormElement): string | null {
  for (const element of Array.from(form.elements)) {
    if (element instanceof HTMLInputElement && !element.validity.valid) {
      element.focus();
      const labelElement = element.labels?.[0];
      const label = (labelElement?.querySelector(":scope > span")?.textContent || labelElement?.textContent)?.trim() || "This field";
      if (element.validity.valueMissing) return `Please enter ${label.toLowerCase()}.`;
      return `${label}: ${element.validationMessage}`;
    }
  }
  return null;
}
