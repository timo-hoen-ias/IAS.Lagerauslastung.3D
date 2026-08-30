# Port von src/server/perf/generate.ts — deterministisches Perf-Lager (Offline).
# Gleicher Seed -> identische Daten wie der Bun-Server (?db=perf).
class_name PerfGen
extends RefCounted

const WmQuery = preload("res://src/core/query.gd")

const ARTIKEL := ["Tischplatte", "Schublade", "Regalboden", "Seitenwand", "Rueckwand", "Gleitbrett", "Scharnier", "Griff", "Sockel", "Fachboden"]
const EINHEITEN := ["Stueck", "kg", "m", "m2", "l"]

# 32-Bit-Multiplikation mit niedrigen 32 Bit des Ergebnisses (int64-Overflow-sicher).
static func mul32(a: int, b: int) -> int:
	var a_hi := (a >> 16) & 0xffff
	var a_lo := a & 0xffff
	var b_hi := (b >> 16) & 0xffff
	var b_lo := b & 0xffff
	var res := (a_lo * b_lo) & 0xffffffff
	res = (res + ((a_hi * b_lo) << 16)) & 0xffffffff
	res = (res + ((a_lo * b_hi) << 16)) & 0xffffffff
	return res

# Deterministischer PRNG (mulberry32) — Port mit 32-Bit-Maskierung.
# Zustand in einem Array, da GDScript-Lambdas Skalare by value erfassen.
static func mulberry32(seed: int) -> Callable:
	var st := [seed & 0xffffffff]
	return func() -> float:
		st[0] = (st[0] + 0x6d2b79f5) & 0xffffffff
		var a: int = st[0]
		var t: int = mul32(a ^ (a >> 15), 1 | a)
		var before: int = t
		t = (before + mul32(before ^ (before >> 7), 61 | before)) & 0xffffffff
		t = (t ^ before) & 0xffffffff
		t = (t ^ (t >> 14)) & 0xffffffff
		return float(t) / 4294967296.0

# Mischung: 60% Hochregal (4x7x12), 20% Flaechenlager (4x50), 20% Freilager (1x800) -> 40.160 Plaetze bei 100 Orten.
static func spec_for(i: int) -> Dictionary:
	match i % 5:
		3:
			return {"technik": "LTD2SF", "d1": 4, "d2": 50, "d3": 0, "masse": {"hoehe": 20.0, "breite": 120.0, "laenge": 120.0}}
		4:
			return {"technik": "LTD1UF", "d1": 800, "d2": 0, "d3": 0, "masse": {"hoehe": 20.0, "breite": 100.0, "laenge": 200.0}}
		_:
			return {"technik": "LTD3HR", "d1": 4, "d2": 7, "d3": 12, "masse": {"hoehe": 60.0, "breite": 110.0, "laenge": 160.0}}

static func generate_platz_rows(orte: int, seed: int = 1) -> Dictionary:
	var rows: Array = []
	var metas: Array = []
	# platz_id via Array, da GDScript-Lambdas Skalare by value erfassen.
	var platz_id_state := [1]
	for i in range(orte):
		var spec: Dictionary = spec_for(i)
		var mandant := 1
		var kennung := "PERF-%03d" % (i + 1)
		var dims := {"d1": spec["d1"], "d2": spec["d2"], "d3": spec["d3"]}
		var platz_ids: Array = []
		var push := func(dd1: int, dd2: int, dd3: int) -> void:
			var platz_id: int = platz_id_state[0]
			platz_ids.append(platz_id)
			rows.append({
				"Mandant": mandant,
				"Lagerkennung": kennung,
				"Bezeichnung": "Perf-Lager %d" % (i + 1),
				"Lagertechnik": spec["technik"],
				"AnzahlDimension1": spec["d1"],
				"AnzahlDimension2": spec["d2"],
				"AnzahlDimension3": spec["d3"],
				"PlatzID": platz_id,
				"Dimension1": dd1,
				"Dimension2": dd2,
				"Dimension3": dd3,
				"Dimensionsebene": 0,
				"Kurzbezeichnung": "%s;%d;%d;%d" % [kennung, dd1, dd2, dd3],
				"Platzbezeichnung": "",
				"Hoehe": spec["masse"]["hoehe"],
				"Breite": spec["masse"]["breite"],
				"Laenge": spec["masse"]["laenge"],
				"Tragkraft": 500,
			})
			platz_id_state[0] += 1
		push.call(0, 0, 0)
		if int(spec["d3"]) > 0:
			for g in range(1, int(spec["d1"]) + 1):
				for e in range(1, int(spec["d2"]) + 1):
					for f in range(1, int(spec["d3"]) + 1):
						push.call(g, e, f)
		elif int(spec["d2"]) > 0:
			for g in range(1, int(spec["d1"]) + 1):
				for p in range(1, int(spec["d2"]) + 1):
					push.call(g, p, 0)
		else:
			for b in range(1, int(spec["d1"]) + 1):
				push.call(b, 0, 0)
		metas.append({
			"mandant": mandant,
			"kennung": kennung,
			"bezeichnung": "Perf-Lager %d" % (i + 1),
			"technik": spec["technik"],
			"dims": dims,
			"platzIds": platz_ids,
		})
	return {"rows": rows, "orte": metas}

# ~70% der Plaetze mit 1-2 Artikeln.
static func generate_bestand_rows(orte: Array, seed: int = 2) -> Array:
	var rnd := mulberry32(seed)
	var rows: Array = []
	for ort: Dictionary in orte:
		for platz_id: int in ort["platzIds"]:
			if rnd.call() < 0.3:
				continue
			var n := 1 + int(floor(rnd.call() * 2.0))
			for k in range(n):
				rows.append({
					"Mandant": ort["mandant"],
					"Lagerkennung": ort["kennung"],
					"PlatzID": platz_id,
					"Artikelnummer": str(100000 + int(floor(rnd.call() * 900000.0))),
					"Bezeichnung1": ARTIKEL[int(floor(rnd.call() * float(ARTIKEL.size())))],
					"Matchcode": "",
					"AuspraegungID": 0,
					"Eigenmasse": 1 + int(floor(rnd.call() * 50.0)),
					"Lagermengeneinheit": EINHEITEN[int(floor(rnd.call() * float(EINHEITEN.size())))],
					"Gewicht": 0,
					"GewichtLME": 0,
					"Bestand": 1 + int(floor(rnd.call() * 999.0)),
					"Verfuegbarkeit": 0,
				})
	return rows

static func generate_lager(orte: int, seed: int = 1) -> Dictionary:
	var platz := generate_platz_rows(orte, seed)
	var bestand_rows := generate_bestand_rows(platz["orte"], seed + 1)
	return {"platzRows": platz["rows"], "bestandRows": bestand_rows, "orte": platz["orte"]}

# LagerDaten ueber denselben Pfad wie die DB-Queries (groupLagerorte + attachBestaende).
static func generate_lager_daten(orte: int, seed: int = 1) -> Dictionary:
	var gen := generate_lager(orte, seed)
	var daten := WmQuery.group_lagerorte(gen["platzRows"], 1)
	WmQuery.attach_bestaende(daten, gen["bestandRows"], 1)
	return daten
