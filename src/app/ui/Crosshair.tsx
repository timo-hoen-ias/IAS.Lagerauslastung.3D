import { useSelection } from '../store';

export default function Crosshair() {
  const selection = useSelection();
  const line = selection ? 'bg-accent shadow-[0_0_6px_rgba(69,216,200,0.9)]' : 'bg-white/75';
  return (
    <div className="pointer-events-none fixed left-1/2 top-[calc(50%+3vh)] z-30 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2">
      <div className={`absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 transition-colors duration-150 ${line}`} />
      <div className={`absolute top-1/2 left-0 h-0.5 w-full -translate-y-1/2 transition-colors duration-150 ${line}`} />
    </div>
  );
}
