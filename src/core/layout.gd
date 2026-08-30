# Port von src/app/scene/layout.ts — Regal-Layout, Zellpositionen, Farben.
class_name WmLayout
extends RefCounted

const SLOT := 1.0
const CELL_W := 0.9
const CELL_H := 0.6
const CELL_D := 0.9
const LEVEL_GAP := 0.1
const BASE_H := 0.25
const TOP_H := 0.25
const MAX_ROW_WIDTH := 55.0
const AISLE_X := 2.5
const GANG_GAP := 2.0
const AISLE_Z := 6.0
const POST := 0.08
const FRAME_CLEAR := 0.03
const TOP_OVERHANG := 0.1
const MASSE_TO_M := 0.01

const COLOR_EMPTY := Color("#5d6673")
const COLOR_LOW := Color("#27ae60")
const COLOR_MID := Color("#f1c40f")
const COLOR_HIGH := Color("#e74c3c")

static func is_catch_all(platz: Dictionary) -> bool:
	return platz["dim"]["d1"] == 0 and platz["dim"]["d2"] == 0 and platz["dim"]["d3"] == 0

static func technik_flat(technik: String) -> bool:
	return not technik.begins_with("LTD3")

static func cell_size(platz: Dictionary, clamp_box: bool = true) -> Dictionary:
	var breite: float = platz["masse"]["breite"] * MASSE_TO_M if platz["masse"]["breite"] > 0 else CELL_W
	var laenge: float = platz["masse"]["laenge"] * MASSE_TO_M if platz["masse"]["laenge"] > 0 else CELL_D
	var hoehe: float = platz["masse"]["hoehe"] * MASSE_TO_M if platz["masse"]["hoehe"] > 0 else CELL_H
	if not clamp_box:
		return {"w": breite, "h": hoehe, "d": laenge}
	return {"w": minf(breite, SLOT - 0.05), "h": hoehe, "d": minf(laenge, SLOT - 0.05)}

static func max_cell_size(ort: Dictionary, clamp_box: bool = true) -> Dictionary:
	var zellen: Array = ort["plaetze"]
	if zellen.size() > 1:
		zellen = zellen.filter(func(p: Dictionary) -> bool: return not is_catch_all(p))
	var w := 0.0
	var h := 0.0
	var d := 0.0
	for p: Dictionary in zellen:
		var s := cell_size(p, clamp_box)
		w = maxf(w, s["w"])
		h = maxf(h, s["h"])
		d = maxf(d, s["d"])
	return {
		"w": w if w > 0 else CELL_W,
		"h": h if h > 0 else CELL_H,
		"d": d if d > 0 else CELL_D,
	}

static func rack_structure(ort: Dictionary) -> Dictionary:
	var d1: float = ort["dims"]["d1"]
	var d2: float = ort["dims"]["d2"]
	var d3: float = ort["dims"]["d3"]
	var cell := max_cell_size(ort, false)
	if d3 > 0:
		var levels := maxi(int(d2), 1)
		var depth := int(d3)
		return {
			"kind": "rack", "count": maxi(int(d1), 1), "cols": 1,
			"levels": levels, "depth": depth, "flat": false, "cell_h": cell["h"],
			"size": {
				"w": SLOT,
				"h": BASE_H + levels * cell["h"] + (levels - 1) * LEVEL_GAP + TOP_H,
				"d": depth * SLOT,
			},
		}
	if d2 > 0:
		return {
			"kind": "row", "count": maxi(int(d1), 1), "cols": 1,
			"levels": 1, "depth": int(d2), "flat": true, "cell_h": cell["h"],
			"size": {"w": SLOT, "h": cell["h"], "d": int(d2) * SLOT},
		}
	if d1 > 0:
		var cols := int(d1)
		return {
			"kind": "line", "count": 1, "cols": cols,
			"levels": 1, "depth": 1, "flat": true, "cell_h": cell["h"],
			"size": {"w": cols * SLOT, "h": cell["h"], "d": SLOT},
		}
	return {
		"kind": "single", "count": 1, "cols": 1,
		"levels": 1, "depth": 1, "flat": true, "cell_h": cell["h"],
		"size": {"w": cell["w"], "h": cell["h"], "d": cell["d"]},
	}

static func instance_key(kennung: String, count: int, gang: int) -> String:
	return "%s#%d" % [kennung, gang] if count > 1 else kennung

static func gang_plaetze(ort: Dictionary, kind: String, gang: int) -> Array:
	var out: Array = []
	for p: Dictionary in ort["plaetze"]:
		if is_catch_all(p):
			if gang == 0 and (kind == "single" or (p["bestaende"] as Array).size() > 0):
				out.append(p)
		elif kind == "rack" or kind == "row":
			if int(p["dim"]["d1"]) == gang + 1:
				out.append(p)
		else:
			out.append(p)
	return out

static func cell_local_position(platz: Dictionary, rack: Dictionary) -> Vector3:
	var box := cell_size(platz)
	var catch_all := is_catch_all(platz)
	var kind: String = rack["kind"]
	var ix := 0
	var iy := 0
	var iz := 0
	if catch_all and kind == "single":
		ix = 0
		iy = 0
		iz = 0
	elif catch_all:
		ix = 0
		iy = 0
		iz = rack["depth"]
	elif kind == "rack":
		ix = 0
		iy = maxi(int(platz["dim"]["d2"]), 1) - 1
		iz = maxi(int(platz["dim"]["d3"]), 0) - 1
	elif kind == "row":
		ix = 0
		iy = 0
		iz = maxi(int(platz["dim"]["d2"]), 1) - 1
	elif kind == "line":
		ix = maxi(int(platz["dim"]["d1"]), 0) - 1
		iy = 0
		iz = 0
	else:
		ix = 0
		iy = 0
		iz = 0
	var lx: float = (ix - (int(rack["cols"]) - 1) / 2.0) * SLOT
	var lz: float = (iz - (int(rack["depth"]) - 1) / 2.0) * SLOT
	var ly: float = (0.0 if rack["flat"] else BASE_H) + iy * (float(rack["cell_h"]) + LEVEL_GAP) + float(box["h"]) / 2.0
	if catch_all and kind != "single":
		return Vector3(lx, ly, -(rack["depth"] / 2.0) * SLOT - box["d"] - 0.25)
	return Vector3(lx, ly, lz)

static func layout_racks(orte: Array) -> Array:
	var out: Array = []
	var x := 0.0
	var row_z := 0.0
	var row_max_d := 0.0
	for ort: Dictionary in orte:
		var st := rack_structure(ort)
		var count: int = st["count"]
		var total_w: float = count * st["size"]["w"] + maxf(0, count - 1) * GANG_GAP
		if x > 0 and x + total_w > MAX_ROW_WIDTH:
			x = 0.0
			row_z += row_max_d + AISLE_Z
			row_max_d = 0.0
		for g in range(count):
			var origin_x: float = x + g * (st["size"]["w"] + GANG_GAP) + st["size"]["w"] / 2.0
			out.append({
				"key": instance_key(ort["lagerkennung"], count, g),
				"ort": ort,
				"kind": st["kind"],
				"gang": g,
				"cols": st["cols"],
				"levels": st["levels"],
				"depth": st["depth"],
				"flat": st["flat"],
				"cell_h": st["cell_h"],
				"size": st["size"],
				"origin": Vector3(origin_x, 0.0, row_z + st["size"]["d"] / 2.0),
			})
		x += total_w + AISLE_X
		row_max_d = maxf(row_max_d, st["size"]["d"])
	return center_racks(out)

static func rack_bounds(placements: Array) -> Dictionary:
	if placements.is_empty():
		return {}
	var min_x := INF
	var max_x := -INF
	var min_z := INF
	var max_z := -INF
	for p: Dictionary in placements:
		var o: Vector3 = p["origin"]
		var w: float = p["size"]["w"]
		var d: float = p["size"]["d"]
		min_x = minf(min_x, o.x - w / 2.0)
		max_x = maxf(max_x, o.x + w / 2.0)
		min_z = minf(min_z, o.z - d / 2.0)
		max_z = maxf(max_z, o.z + d / 2.0)
	return {"min_x": min_x, "max_x": max_x, "min_z": min_z, "max_z": max_z}

static func center_racks(placements: Array) -> Array:
	var b := rack_bounds(placements)
	if b.is_empty():
		return placements
	var cx: float = (b["min_x"] + b["max_x"]) / 2.0
	var cz: float = (b["min_z"] + b["max_z"]) / 2.0
	if cx == 0 and cz == 0:
		return placements
	var out: Array = []
	for p: Dictionary in placements:
		var np := p.duplicate(true)
		var o: Vector3 = np["origin"]
		np["origin"] = Vector3(o.x - cx, 0.0, o.z - cz)
		out.append(np)
	return out

static func rack_frame(size: Dictionary) -> Dictionary:
	var post_h: float = size["h"] - TOP_H - FRAME_CLEAR
	return {
		"post": {"size": Vector3(POST, post_h, POST), "pos": Vector3(0.0, FRAME_CLEAR + post_h / 2.0, 0.0)},
		"top": {
			"size": Vector3(size["w"] + 2 * TOP_OVERHANG, TOP_H, size["d"] + 2 * TOP_OVERHANG),
			"pos": Vector3(0.0, size["h"] - TOP_H / 2.0 + FRAME_CLEAR, 0.0),
		},
	}

static func platz_total(platz: Dictionary) -> float:
	var total := 0.0
	for b: Dictionary in platz["bestaende"]:
		total += b["bestand"]
	return total

static func stock_color(total: float, has_stock: bool) -> Color:
	if not has_stock or total <= 0:
		return COLOR_EMPTY
	if total < 100:
		return COLOR_LOW
	if total < 500:
		return COLOR_MID
	return COLOR_HIGH
