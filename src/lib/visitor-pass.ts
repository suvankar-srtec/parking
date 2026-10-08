type VisitorPassData = {
  name: string;
  scopeLabel: "BUILDING" | "COMPANY";
  scopeName: string;
  validFrom: Date;
  validUntil: Date;
  vehicleNumber?: string | null;
  accessory?: string | null;
  qrBase64: string;
};

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatIndia(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

export function buildVisitorPassSvg(data: VisitorPassData) {
  const name = esc(data.name);
  const scopeName = esc(data.scopeName);
  const vehicle = esc(data.vehicleNumber || "Not provided");
  const accessory = esc(data.accessory || "None");
  const validFrom = esc(formatIndia(data.validFrom));
  const validUntil = esc(formatIndia(data.validUntil));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="1050" viewBox="0 0 750 1050">
    <rect width="750" height="1050" fill="#ffffff"/>
    <rect width="750" height="14" fill="#1769c2"/>

    <text x="44" y="74" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="29" font-weight="800" fill="#172435">SRTEC ACCESS CONTROL</text>
    <text x="44" y="108" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="20" font-weight="800" letter-spacing="1.2" fill="#1769c2">VISITOR PASS</text>

    <rect x="616" y="40" width="90" height="90" rx="16" fill="#1769c2"/>
    <text x="661" y="99" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="42" font-weight="900" fill="#ffffff">S</text>

    <text x="44" y="151" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="14" font-weight="800" fill="#6a7c91">${data.scopeLabel}</text>
    <text x="44" y="177" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="18" font-weight="750" fill="#31445b">${scopeName}</text>

    <text x="44" y="211" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="14" font-weight="800" fill="#6a7c91">VALID FROM</text>
    <text x="150" y="211" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="15" font-weight="700" fill="#31445b">${validFrom}</text>
    <text x="44" y="239" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="14" font-weight="800" fill="#6a7c91">VALID UNTIL</text>
    <text x="150" y="239" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="15" font-weight="700" fill="#31445b">${validUntil}</text>

    <line x1="44" y1="270" x2="706" y2="270" stroke="#dbe6f2" stroke-width="2"/>

    <text x="44" y="314" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="14" font-weight="800" letter-spacing="1" fill="#6a7c91">VISITOR</text>
    <text x="44" y="359" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="34" font-weight="850" fill="#172435">${name}</text>

    <image href="data:image/png;base64,${data.qrBase64}" x="180" y="396" width="390" height="390" preserveAspectRatio="xMidYMid meet"/>

    <rect x="44" y="820" width="662" height="70" rx="12" fill="#eef6ff" stroke="#d5e6f7"/>
    <text x="375" y="862" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="21" font-weight="850" letter-spacing=".6" fill="#0f4f97">ONE ENTRY • EXIT ALLOWED</text>

    <text x="44" y="931" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="13" font-weight="800" fill="#6a7c91">VEHICLE</text>
    <text x="118" y="931" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="14" font-weight="700" fill="#31445b">${vehicle}</text>
    <text x="400" y="931" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="13" font-weight="800" fill="#6a7c91">ACCESSORY</text>
    <text x="493" y="931" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="14" font-weight="700" fill="#31445b">${accessory}</text>

    <line x1="44" y1="963" x2="706" y2="963" stroke="#dbe6f2" stroke-width="2"/>
    <text x="375" y="1000" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="17" font-weight="800" letter-spacing="1" fill="#52667d">SCAN QR FOR ACCESS</text>
    <text x="375" y="1026" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif" font-size="13" font-weight="650" fill="#6a7c91">Valid until ${validUntil}</text>
  </svg>`;
}
