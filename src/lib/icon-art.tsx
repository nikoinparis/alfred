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
        background: "radial-gradient(circle at 50% 30%, #182235 0%, #050608 72%)",
      }}
    >
      <svg width={emblem} height={emblem} viewBox="0 0 32 32">
        <path d="M2 9.5 16 22.5 30 9.5 26.5 9.2 16 17.6 5.5 9.2Z" fill="#3a86ff" />
      </svg>
    </div>
  );
}
