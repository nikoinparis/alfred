/** App icon artwork for next/og ImageResponse. Maskable-safe: emblem sits in the central 60%. */
export function IconArt({ size }: { size: number }) {
  const emblem = Math.round(size * 0.56);
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 30%, #1e2530 0%, #090b0f 70%)",
      }}
    >
      <svg width={emblem} height={emblem} viewBox="0 0 32 32">
        <path d="M16 3 4 9.5v7.2C4 23 9.2 27.6 16 29c6.8-1.4 12-6 12-12.3V9.5L16 3Z" fill="#171c24" stroke="#374254" strokeWidth="0.8" />
        <path d="M9 12.5 16 22l7-9.5-3.6 1.6L16 9.5l-3.4 4.6L9 12.5Z" fill="#e2b04a" />
      </svg>
    </div>
  );
}
