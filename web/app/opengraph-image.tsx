import { ImageResponse } from "next/og";

export const alt = "Cadence — AI calendar assistant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "90px",
          background: "#0e0b1a",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 40 }}>
          <div style={{ width: 24, height: 44, borderRadius: 9, background: "#8b6dff" }} />
          <div style={{ width: 24, height: 72, borderRadius: 9, background: "#8b6dff" }} />
          <div style={{ width: 24, height: 100, borderRadius: 9, background: "#8b6dff" }} />
        </div>
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3 }}>Cadence</div>
        <div style={{ fontSize: 40, color: "#b9b2d6", marginTop: 20, maxWidth: 940, lineHeight: 1.3 }}>
          Your Google Calendar, on command — chat or snap a photo, and it schedules it for you.
        </div>
      </div>
    ),
    { ...size },
  );
}
