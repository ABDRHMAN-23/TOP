export default function SinanMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="شعار سِنان"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.25 3.6C5.7 3.6 3.2 6.45 3.2 10.2c0 4.05 2.18 6.35 3.22 10.08.83 2.95 1.48 7.01 3.68 7.01 1.64 0 2.04-4.68 3.82-7.1.48-.65 1.18-.98 2.08-.98s1.6.33 2.08.98c1.78 2.42 2.18 7.1 3.82 7.1 2.2 0 2.85-4.06 3.68-7.01 1.04-3.73 3.22-6.03 3.22-10.08 0-3.75-2.5-6.6-6.05-6.6-2.86 0-4.52 2.05-6.75 2.05S12.11 3.6 9.25 3.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.3 9.1c1.55.8 3.43 1.2 5.7 1.2s4.15-.4 5.7-1.2" stroke="currentColor" strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
