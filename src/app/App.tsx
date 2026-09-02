import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { LagerDaten } from '../shared/types';
import type { EditorLager } from '../shared/editor';
import {
  getTransform,
  loadStockAnzeigeConfig,
  setSelectedArticle,
  setTransform,
  useEffectiveRacks,
  useHiddenLagerkennungen,
  useSelectedRack,
  useVisibleEditorLagerIds,
} from './store';
import WarehouseScene from './scene/WarehouseScene';
import { layoutRacks } from './scene/layout';
import { rackAabb, rotateRack, scaleRack } from './scene/transform';
import { buildEditorOverlay, stageEditorOverlays, type EditorLagerListItem, type PositionedEditorOverlay } from './editorOverlay';
import HUD from './ui/HUD';
import Minimap from './ui/Minimap';
import Crosshair from './ui/Crosshair';
import Inspector from './ui/Inspector';
import { startLiveBuchungen } from './live';
import { lagerLaden } from './lager';
import { nextIntervalMs, randomBuchung, SIM_MAX_MS, SIM_MIN_MS } from './sim';
import type { HeatmapDaten } from './heatmap';
import HeatmapPanel from './ui/HeatmapPanel';

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
  const [sim, setSim] = useState(false);
  const [simMinMs, setSimMinMs] = useState(SIM_MIN_MS);
  const [simMaxMs, setSimMaxMs] = useState(SIM_MAX_MS);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [heatmap, setHeatmap] = useState<{ daten: HeatmapDaten; from: number; to: number } | null>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [flir, setFlir] = useState(false);
  const [editorLagerList, setEditorLagerList] = useState<EditorLagerListItem[]>([]);
  const [editorLagerDefs, setEditorLagerDefs] = useState<Map<string, EditorLager>>(new Map());
  const visibleEditorLagerIds = useVisibleEditorLagerIds();
  const hiddenLagerkennungen = useHiddenLagerkennungen();

  const sichtbareLagerorte = useMemo(
    () => (data ? data.lagerorte.filter((o) => !hiddenLagerkennungen.has(o.lagerkennung)) : []),
    [data, hiddenLagerkennungen],
  );
  const placements = useMemo(() => layoutRacks(sichtbareLagerorte), [sichtbareLagerorte]);
  const racks = useEffectiveRacks(placements);
  const selectedRack = useSelectedRack();

  const editorOverlays = useMemo<PositionedEditorOverlay[]>(() => {
    if (!data || visibleEditorLagerIds.size === 0) return [];
    const bekannteIds = new Set(editorLagerList.map((l) => l.id));
    const overlays = [...visibleEditorLagerIds]
      .filter((id) => bekannteIds.has(id))
      .map((id) => editorLagerDefs.get(id))
      .filter((lager): lager is EditorLager => lager != null)
      .map((lager) =>
        buildEditorOverlay(
          lager,
          data.lagerorte.find((o) => o.lagerkennung === lager.lagerkennung && lager.mandant === data.mandant),
        ),
      );
    if (overlays.length === 0) return [];
    const startX = racks.reduce((m, r) => Math.max(m, rackAabb(r).maxX), 0);
    return stageEditorOverlays(overlays, startX);
  }, [data, editorLagerList, editorLagerDefs, visibleEditorLagerIds, racks]);

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
    setEditorLagerDefs(new Map()); // Ids sind je DB-Verbindung vergeben, nicht global eindeutig
    fetch(`/api/editor/lager?db=${db}`)
      .then((r) => r.json())
      .then((d: { lager?: EditorLagerListItem[] }) => setEditorLagerList(d.lager ?? []))
      .catch(() => setEditorLagerList([]));
  }, [db]);

  useEffect(() => {
    const missing = [...visibleEditorLagerIds].filter((id) => !editorLagerDefs.has(id));
    if (missing.length === 0) return;
    Promise.all(
      missing.map((id) =>
        fetch(`/api/editor/lager/${id}?db=${db}`)
          .then((r) => (r.ok ? (r.json() as Promise<EditorLager>) : null))
          .then((lager) => [id, lager] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((results) => {
      setEditorLagerDefs((prev) => {
        const next = new Map(prev);
        for (const [id, lager] of results) if (lager) next.set(id, lager);
        return next;
      });
    });
  }, [visibleEditorLagerIds, editorLagerDefs, db]);

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
    if (data == null) return;
    loadStockAnzeigeConfig(db, data.mandant).catch(() => undefined);
  }, [db, data?.mandant]);

  useEffect(() => {
    if (!sim || !data) return;
    let timer: number | undefined;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      fetch('/api/buchung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(randomBuchung(data)),
      }).catch((e: unknown) => console.warn('[sim] Buchung konnte nicht gesendet werden', e));
      timer = window.setTimeout(tick, nextIntervalMs(simMinMs, simMaxMs));
    };
    tick();
    return () => {
      stopped = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [sim, data, simMinMs, simMaxMs]);

  const loadHeatmap = (from: number, to: number) => {
    const params = new URLSearchParams({ from: String(from), to: String(to) });
    if (mandant != null) params.set('mandant', String(mandant));
    setHeatmapLoading(true);
    fetch(`/api/buchungen/heatmap?${params}`)
      .then((r) => r.json())
      .then((d: HeatmapDaten | { error?: string }) => {
        if ('error' in d) throw new Error(d.error);
        setHeatmap({ daten: d as HeatmapDaten, from, to });
      })
      .catch((e: unknown) => console.warn('[heatmap]', e))
      .finally(() => setHeatmapLoading(false));
  };

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
      <Canvas dpr={[1,1.5]} shadows camera={{ position: [0,16,34], fov: 60, near: 0.1, far: 400 }}>
        <WarehouseScene
          racks={racks}
          mode={mode}
          speed={speed}
          edit={edit}
          measure={measure}
          lighting={lighting}
          walls={walls}
          heatmapPoints={heatmapOpen ? heatmap?.daten.points : undefined}
          flir={flir}
          editorOverlays={editorOverlays}
        />
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
        sim={sim}
        setSim={setSim}
        simMinMs={simMinMs}
        setSimMinMs={setSimMinMs}
        simMaxMs={simMaxMs}
        setSimMaxMs={setSimMaxMs}
        heatmap={heatmapOpen}
        setHeatmap={setHeatmapOpen}
        onFlirToggle={() => setFlir((f) => !f)}
      />
      {heatmapOpen && (
        <HeatmapPanel
          data={data}
          onBerechnen={loadHeatmap}
          onClose={() => setHeatmapOpen(false)}
          loading={heatmapLoading}
          ergebnis={heatmap?.daten ?? null}
          range={heatmap ? { from: heatmap.from, to: heatmap.to } : null}
        />
      )}
      <Minimap racks={racks} visible={mode === 'walk'} />
      {mode === 'walk' && <Crosshair />}
      <Inspector data={data} editorLagerList={editorLagerList} />
    </div>
  );
}
