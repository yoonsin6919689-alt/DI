export function Emblem({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className="emblem"
    >
      <path d="M24 2.5 45.5 24 24 45.5 2.5 24Z" stroke="currentColor" strokeWidth="1.3" opacity=".55" />
      <path d="M24 10 38 24 24 38 10 24Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 16.5 31.5 24 24 31.5 16.5 24Z" fill="currentColor" opacity=".9" />
      <path d="M24 2.5v13M24 32.5v13M2.5 24h13M32.5 24h13" stroke="currentColor" strokeWidth="1.1" opacity=".7" />
    </svg>
  );
}
