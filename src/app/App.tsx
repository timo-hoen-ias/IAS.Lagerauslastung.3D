import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { LagerDaten } from '../shared/types';
import { getTransform, setSelectedArticle, setTransform, useEffectiveRacks, useSelectedRack } from './store';
import WarehouseScene from './scene/WarehouseScene';
import { layoutRacks } from './scene/layout';
import { rotateRack, scaleRack } from './scene/transform';
import HUD from './ui/HUD';
import Minimap from './ui/Minimap';
import Crosshair from './ui/Crosshair';
import Readout from './ui/Readout';
import Inspector from './ui/Inspector';
import { startLiveBuchungen } from './live';
import { lagerLaden } from './lager';

export type Mode = 'orbit' | 'walk' | 'topdown';

export type DbInfo = { id: string; name: string; mandanten: number[] };

const MODE_ORDER: Mode[] = ['orbit', 'walk', 'topdown'];

export default function App() {
  const [data, setData] = useState<LagerDaten | null>(null);
  const [dbs, setDbs] = useState<DbInfo[]>([]);
  const [db, setDb] = useState<string>('default');
  const [mandant, setMandant] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [mode, setMode] = useState<Mode>('orbit');
  const [speed, setSpeed] = useState(10);
  const [edit, setEdit] = useState(false);
  const [measure, setMeasure] = useState(false);
  const [lighting, setLighting] = useState(true);
  const [walls, setWalls] = useState(false);

  const placements = useMemo(() => (data ? layoutRacks(data.lagerorte) : []), [data]);
  const racks = useEffectiveRacks(placements);
  const selectedRack = useSelectedRack();

  useEffect(() => {
    fetch('/api/dbs')
      .then((r) => r.json())
      .then((d: { dbs?: DbInfo[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setDbs(d.dbs ?? []);
      })
      .catch(() => setDbs([])); // kein Backend → ohne DB-Auswahl weiter (Perf-Fallback greift)
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ db });
    if (mandant != null) params.set('mandant', String(mandant));
    setData(null);
    setError(null);
    setFallback(false);
    setSelectedArticle(null);
    lagerLaden(`/api/lager?${params}`)
      .then((d) => {
        setData(d);
        setFallback(Boolean(d.fallback));
      })
      .catch((e: unknown) => setError(String(e instanceof Error ? e.message : e)));
  }, [db, mandant]);

  useEffect(() => startLiveBuchungen(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setMode((m) => MODE_ORDER[(MODE_ORDER.indexOf(m) + 1) % MODE_ORDER.length]!);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!edit) return;
    const onKey = (e: KeyboardEvent) => {
      if (!selectedRack) return;
      const t = getTransform(selectedRack);
      switch (e.code) {
        case 'ArrowUp':
          e.preventDefault();
          setTransform(selectedRack, { ...t, z: t.z - 1 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setTransform(selectedRack, { ...t, z: t.z + 1 });
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setTransform(selectedRack, { ...t, x: t.x - 1 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          setTransform(selectedRack, { ...t, x: t.x + 1 });
          break;
        case 'KeyQ':
          setTransform(selectedRack, rotateRack(t, -45));
          break;
        case 'KeyE':
          setTransform(selectedRack, rotateRack(t, 45));
          break;
        case 'BracketLeft':
          setTransform(selectedRack, scaleRack(t, t.scale.x - 0.5));
          break;
        case 'BracketRight':
          setTransform(selectedRack, scaleRack(t, t.scale.x + 0.5));
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit, selectedRack]);

  return (
    <div id="wm-root" className="wm-root">
      <Canvas dpr={[1, 1.5]} shadows camera={{ position: [0,16,34], fov: 60, near: 0.1, far: 400 }}>
        <WarehouseScene racks={racks} mode={mode} speed={speed} edit={edit} measure={measure} lighting={lighting} walls={walls} />
      </Canvas>
      <HUD
        data={data}
        dbs={dbs}
        db={db}
        setDb={setDb}
        mandant={mandant}
        setMandant={setMandant}
        error={error}
        fallback={fallback}
        mode={mode}
        setMode={setMode}
        speed={speed}
        setSpeed={setSpeed}
        edit={edit}
        setEdit={setEdit}
        measure={measure}
        setMeasure={setMeasure}
        lighting={lighting}
        setLighting={setLighting}
        walls={walls}
        setWalls={setWalls}
      />
      <Minimap racks={racks} visible={mode === 'walk'} />
      {mode === 'walk' && <Crosshair />}
      <Readout mode={mode} />
      <Inspector data={data} />
    </div>
  );
}
