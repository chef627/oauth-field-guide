/* eslint-disable @next/next/no-img-element */
export function AppLogo({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white text-sm font-semibold text-muted"
      style={{ width: size, height: size }}
    >
      {src ? <img src={src} alt="" width={size * 0.62} height={size * 0.62} className="object-contain" /> : name.charAt(0).toUpperCase()}
    </span>
  );
}
