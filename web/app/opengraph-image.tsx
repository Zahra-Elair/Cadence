import { ImageResponse } from "next/og";
import { readFileSync } from "fs";

export const alt = "Cadence — AI calendar assistant";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const logo = "data:image/png;base64," + readFileSync(new URL("./cadence-mark.png", import.meta.url)).toString("base64");
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={132} height={132} style={{ marginBottom: 30, borderRadius: 26 }} alt="" />
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3 }}>Cadence</div>
        <div style={{ fontSize: 40, color: "#b9b2d6", marginTop: 18, maxWidth: 940, lineHeight: 1.3 }}>
          Your Google Calendar, on command — chat or snap a photo, and it schedules it for you.
        </div>
      </div>
    ),
    { ...size },
  );
}
