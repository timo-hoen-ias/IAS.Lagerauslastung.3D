import { useCam } from '../store';
import type { Mode } from '../App';
import DragPanel from './DragPanel';

const MODE_LABEL: Record<Mode, string> = { orbit: 'ORBIT', walk: 'EGO', topdown: 'TOP-DOWN' };

export default function Readout({ mode }: { mode: Mode }) {
  const cam = useCam();
  return (
    <DragPanel
      id="readout"
      className="readout glass"
      defaultPos={() => ({ x: Math.max(10, window.innerWidth - 250), y: Math.max(10, window.innerHeight - 250) })}
    >
      <div className="readout-line">
        POS-X <span>{cam.x.toFixed(1)}</span>
      </div>
      <div className="readout-line">
        POS-Z <span>{cam.z.toFixed(1)}</span>
      </div>
      <div className="readout-line">
        MODUS <span>{MODE_LABEL[mode]}</span>
      </div>
    </DragPanel>
  );
}
