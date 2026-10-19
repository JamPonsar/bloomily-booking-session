/**
 * Bloomily-style mark: six petals with "heads" radiating from a centre, in the
 * brand's orange / teal / sun / blue. Swap for the official asset if you have it.
 */
const PETALS = ['#F58220', '#1B9AAA', '#F5B72D', '#2D6FA3', '#F58220', '#1B9AAA'];

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      {PETALS.map((fill, i) => (
        <g key={i} transform={`rotate(${i * 60 + 15} 20 20)`} fill={fill}>
          <path d="M20 18 C24.2 13.8 23.8 8.6 20 5.6 C16.2 8.6 15.8 13.8 20 18 Z" />
          <circle cx="24.4" cy="4.6" r="2.7" />
        </g>
      ))}
    </svg>
  );
}

export function Logo({ label = 'bloomily' }: { label?: string }) {
  return (
    <span className="logo">
      <LogoMark size={30} />
      <span className="logo-word">{label}</span>
    </span>
  );
}
