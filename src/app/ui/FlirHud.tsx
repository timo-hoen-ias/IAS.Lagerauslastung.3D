import { useEffect, useRef, useState } from 'react';
import { useCam } from '../store';
import { fmtHeading, fmtInt, knotsFromMs, tapeItems, yawToHeading, HUD_PX_PER_DEG, HUD_TAPE_SPREAD } from './flirHudMath';
const GREEN = '#b9ffc8';
const GLOW = '0 0 6px rgba(150, 255, 170, 0.55)';
const MUTE = 'rgba(185, 255, 200, 0.45)';

function utcClock(now: number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}

export default function FlirHud({ onExit }: { onExit: () => void }) {
  const cam = useCam();
  const camRef = useRef(cam);
  camRef.current = cam;
  const [spdKn, setSpdKn] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = { x: cam.x, z: cam.z, t: performance.now() };
    const tick = (t: number) => {
      const d = Math.hypot(camRef.current.x - last.x, camRef.current.z - last.z);
      const dt = (t - last.t) / 1000;
      last = { x: camRef.current.x, z: camRef.current.z, t };
      if (dt > 0.02) {
        const inst = knotsFromMs(d / dt);
        setSpdKn((s) => s * 0.6 + inst * 0.4);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const heading = yawToHeading(cam.yaw);
  const items = tapeItems(heading);
  const centerPx = HUD_TAPE_SPREAD * HUD_PX_PER_DEG;

  const style = { color: GREEN, textShadow: GLOW } as const;
  const small = { color: MUTE, textShadow: GLOW } as const;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[15] select-none overflow-hidden font-mono"
      style={{ color: GREEN }}
    >
      {/* Vignette + dezente Scanlines für den „Display“-Look */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, #000 0 1px, transparent 1px 3px)' }}
      />

      {/* UTC-Uhr + REC oben rechts */}
      <div className="absolute right-5 top-4 flex items-center gap-2 text-[13px]" style={style}>
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-current" />
        <span>REC</span>
        <span className="ml-1" style={small}>
          U {utcClock(now)}
        </span>
      </div>

      {/* Kurs-Kompassband oben Mitte */}
      <div className="absolute left-1/2 top-4 h-11 w-[260px] -translate-x-1/2 overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2" style={{ width: centerPx * 2 + 12, height: 44 }}>
          {items.map((it, i) => (
            <div key={i} className="absolute top-0 h-full" style={{ left: centerPx + it.x, transform: 'translateX(-50%)' }}>
              <div className="h-3 w-px bg-current" style={it.major ? { opacity: 0.9 } : { opacity: 0.35 }} />
              {it.major && (
                <div className="mt-0.5 text-center text-[10px] leading-none" style={style}>
                  {fmtHeading(it.deg)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div
          className="absolute left-1/2 top-0 h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[6px] border-x-transparent"
          style={{ borderTopColor: GREEN, filter: 'drop-shadow(0 0 4px rgba(150,255,170,0.6))' }}
        />
      </div>

      {/* FLIR-Reticle Mitte */}
      <div className="absolute left-1/2 top-1/2 h-[130px] w-[130px] -translate-x-1/2 -translate-y-1/2" style={style}>
        <svg viewBox="-70 -70 140 140" className="h-full w-full opacity-90">
          <circle r="46" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.85" />
          <circle r="2.5" fill="currentColor" />
          {[0, 90, 180, 270].map((a) => (
            <line
              key={a}
              x1="0"
              y1="0"
              x2={Math.cos((a * Math.PI) / 180) * 46}
              y2={Math.sin((a * Math.PI) / 180) * 46}
              stroke="currentColor"
              strokeWidth="0.6"
              opacity="0.25"
            />
          ))}
          <line x1="-58" y1="-46" x2="-40" y2="-46" stroke="currentColor" strokeWidth="1.6" />
          <line x1="40" y1="-46" x2="58" y2="-46" stroke="currentColor" strokeWidth="1.6" />
          <line x1="-58" y1="46" x2="-40" y2="46" stroke="currentColor" strokeWidth="1.6" />
          <line x1="40" y1="46" x2="58" y2="46" stroke="currentColor" strokeWidth="1.6" />
          <line x1="-46" y1="-58" x2="-46" y2="-40" stroke="currentColor" strokeWidth="1.6" />
          <line x1="-46" y1="40" x2="-46" y2="58" stroke="currentColor" strokeWidth="1.6" />
          <line x1="46" y1="-58" x2="46" y2="-40" stroke="currentColor" strokeWidth="1.6" />
          <line x1="46" y1="40" x2="46" y2="58" stroke="currentColor" strokeWidth="1.6" />
          <path d="M 30 -22 L 42 -34 M 30 22 L 42 34 M -30 -22 L -42 -34 M -30 22 L -42 34" stroke="currentColor" strokeWidth="1.6" opacity="0.6" />
        </svg>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em]" style={style}>
          FLIR
        </div>
      </div>

      {/* linke Daten */}
      <div className="absolute bottom-24 left-6 text-[12px] leading-6" style={style}>
        <div>
          SPD <span className="inline-block w-[44px] text-right">{String(Math.round(spdKn)).padStart(3, '0')}</span> KT
        </div>
        <div>
          ALT <span className="inline-block w-[44px] text-right">{fmtInt(cam.y).padStart(3, '0')}</span> M
        </div>
        <div>
          HDG <span className="inline-block w-[44px] text-right">{fmtHeading(heading)}</span>°
        </div>
        <div>
          G&nbsp;&nbsp;<span className="inline-block w-[44px] text-right">1.0</span>
        </div>
        <div className="mt-2 text-[10px] tracking-widest" style={small}>
          X {fmtInt(cam.x).padStart(4, '0')} · Z {fmtInt(cam.z).padStart(4, '0')}
        </div>
      </div>

      {/* Statuszeile unten */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 text-[11px] tracking-[0.25em]" style={small}>
        <span style={style}>FLIR WHOT</span>
        <span>·</span>
        <span>MASTER ARM</span>
        <span>·</span>
        <span>STBY</span>
      </div>

      {/* Exit */}
      <button
        className="pointer-events-auto absolute bottom-4 right-4 rounded border px-2.5 py-1 text-[11px] tracking-[0.2em] transition-colors hover:bg-green-400/10"
        style={{ ...style, borderColor: 'rgba(185,255,200,0.5)' }}
        onClick={onExit}
      >
        EXIT FLIR
      </button>
    </div>
  );
}
