const WAVES = [
  { cls: "wave-1", d: "M0,0 C150,90 350,-40 500,40 C650,120 900,20 1200,60 L1200,120 L0,120 Z" },
  { cls: "wave-2", d: "M0,0 C200,60 400,-20 600,50 C800,120 1000,10 1200,40 L1200,120 L0,120 Z" },
  { cls: "wave-3", d: "M0,30 C150,70 450,-10 700,50 C950,110 1100,30 1200,50 L1200,120 L0,120 Z" },
];

export default function Backdrop() {
  return (
    <>
      <div className="sun-glow" />
      <div className="waves" aria-hidden="true">
        {WAVES.map((w) => (
          <svg key={w.cls} className={`wave ${w.cls}`} viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d={w.d} />
          </svg>
        ))}
      </div>
    </>
  );
}
