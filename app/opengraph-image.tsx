import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, color: "#f8fafc", background: "radial-gradient(circle at 18% 5%, #2b2446 0%, #111827 42%, #070a12 100%)", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#c4b5fd", fontSize: 28, fontWeight: 700, letterSpacing: 2 }}><span style={{ display: "flex", width: 36, height: 36, border: "3px solid #c4b5fd", borderRadius: 7, alignItems: "center", justifyContent: "center" }}>▶</span>MOVIE CLUB</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}><span style={{ fontSize: 82, fontWeight: 700, letterSpacing: -5, lineHeight: 1 }}>Make a night of it.</span><span style={{ fontSize: 29, color: "#cbd5e1" }}>Pick the movie. Vote on a showtime. Go together.</span></div>
      <div style={{ width: "100%", height: 5, borderRadius: 5, background: "#a78bfa" }} />
    </div>,
    size,
  );
}
