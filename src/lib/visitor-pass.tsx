import { ImageResponse } from "next/og";
import React from "react";

type VisitorPassInput = {
  visitorName: string;
  scopeName: string;
  phoneNumber: string;
  vehicleNumber: string;
  accessory: string;
  validFrom: string;
  validUntil: string;
  qrDataUrl: string;
};

function text(value: string, max = 42) {
  const clean = value.trim().replace(/\s+/g, " ");
  return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
}

export async function renderVisitorPassPng(input: VisitorPassInput) {
  const response = new ImageResponse(
    <div
      style={{
        width: "750px",
        height: "1050px",
        display: "flex",
        flexDirection: "column",
        background: "#f5f2f8",
        color: "#17221c",
        fontFamily: "Arial, sans-serif",
        padding: "34px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          border: "3px solid #7c46ac",
          borderRadius: "30px",
          overflow: "hidden",
          boxShadow: "0 12px 35px rgba(60,35,78,.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "30px 34px 24px",
            background: "#7c46ac",
            color: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                width: "58px",
                height: "58px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "14px",
                background: "#ffffff",
                color: "#1769c2",
                fontSize: "28px",
                fontWeight: 900,
              }}
            >
              S
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "26px", fontWeight: 900 }}>SRTEC Access Control</div>
              <div style={{ marginTop: "4px", fontSize: "15px", opacity: .9 }}>VISITOR ACCESS</div>
            </div>
          </div>
          <div
            style={{
              padding: "9px 15px",
              border: "2px solid rgba(255,255,255,.7)",
              borderRadius: "999px",
              fontSize: "15px",
              fontWeight: 800,
            }}
          >
            VISITOR PASS
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "26px 38px 0" }}>
          <div style={{ fontSize: "18px", color: "#7c46ac", fontWeight: 800, letterSpacing: "1px" }}>
            {text(input.scopeName, 48)}
          </div>
          <div style={{ marginTop: "10px", fontSize: "34px", fontWeight: 900, textAlign: "center" }}>
            {text(input.visitorName, 38)}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "24px",
              width: "390px",
              height: "390px",
              padding: "18px",
              background: "#ffffff",
              border: "2px solid #d9d0e2",
              borderRadius: "22px",
            }}
          >
            <img
              src={input.qrDataUrl}
              width="350"
              height="350"
              style={{ width: "350px", height: "350px" }}
            />
          </div>

          <div style={{ marginTop: "15px", fontSize: "15px", fontWeight: 800, color: "#36463e" }}>
            Scan this pass at the entry gate
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            margin: "26px 34px 0",
            padding: "20px 22px",
            borderRadius: "18px",
            background: "#f7f9f8",
            border: "1px solid #dbe3df",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "18px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ color: "#76827b", fontSize: "13px", fontWeight: 700 }}>VALID FROM</span>
              <strong style={{ marginTop: "5px", fontSize: "18px" }}>{text(input.validFrom, 28)}</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ color: "#76827b", fontSize: "13px", fontWeight: 700 }}>VALID UNTIL</span>
              <strong style={{ marginTop: "5px", fontSize: "18px" }}>{text(input.validUntil, 28)}</strong>
            </div>
          </div>

          <div style={{ display: "flex", marginTop: "18px", paddingTop: "18px", borderTop: "1px solid #dfe6e2", gap: "18px" }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ color: "#76827b", fontSize: "13px", fontWeight: 700 }}>PHONE</span>
              <strong style={{ marginTop: "5px", fontSize: "17px" }}>{text(input.phoneNumber, 24)}</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <span style={{ color: "#76827b", fontSize: "13px", fontWeight: 700 }}>VEHICLE</span>
              <strong style={{ marginTop: "5px", fontSize: "17px" }}>{text(input.vehicleNumber, 24)}</strong>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: "18px", paddingTop: "18px", borderTop: "1px solid #dfe6e2" }}>
            <span style={{ color: "#76827b", fontSize: "13px", fontWeight: 700 }}>ACCESSORY</span>
            <strong style={{ marginTop: "5px", fontSize: "17px" }}>{text(input.accessory, 55)}</strong>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            marginTop: "auto",
            padding: "20px 34px 25px",
            justifyContent: "center",
            textAlign: "center",
            color: "#67756d",
            fontSize: "13px",
            lineHeight: 1.45,
          }}
        >
          One entry only. After entry, this QR can only be used for the corresponding exit.
        </div>
      </div>
    </div>,
    {
      width: 750,
      height: 1050,
    },
  );

  return Buffer.from(await response.arrayBuffer());
}
