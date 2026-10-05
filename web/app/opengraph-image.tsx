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
        <svg width="120" height="120" viewBox="0 0 32 32" style={{ marginBottom: 32 }}>
          <path d="M21.8 9.8 A8.5 8.5 0 1 0 21.8 22.2" fill="none" stroke="#8b6dff" strokeWidth={4} strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3 }}>Cadence</div>
        <div style={{ fontSize: 40, color: "#b9b2d6", marginTop: 20, maxWidth: 940, lineHeight: 1.3 }}>
          Your Google Calendar, on command — chat or snap a photo, and it schedules it for you.
        </div>
      </div>
    ),
    { ...size },
  );
}
