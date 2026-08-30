# Port von src/app/scene/boxes.ts — Baupläne: Regalteile, Wände, Bodenrahmen.
class_name WmBoxes
extends RefCounted

const WmLayout = preload("res://src/core/layout.gd")

const WALL_THICK := 0.25
const WALL_PIER := 0.4
const WALL_SILL := 1.0
const WALL_HEADER := 0.6
const WALL_BAY := 3.0

const LINE := 0.06
const LINE_H := 0.02
const FRAME_GAP := 0.25
const CORNER_OFF := 0.02
const CORNER_LEN := 0.22
const CORNER_LINE := 0.04
const HALO_EXTRA := 0.12

# RackTeile: dunkel (Sockel + Böden), grau (4 Eckpfosten), oben (Abdeckplatte).
static func rack_parts(size: Dictionary, levels: int, cell_h: float) -> Dictionary:
	var dark: Array = []
	dark.append({"pos": Vector3(0, 0.04, 0), "size": Vector3(size["w"] + 0.3, 0.08, size["d"] + 0.3)})
	for iy in range(levels):
		dark.append({
			"pos": Vector3(0, WmLayout.BASE_H + iy * (cell_h + WmLayout.LEVEL_GAP) - 0.02, 0),
			"size": Vector3(size["w"] + 0.1, 0.04, size["d"] + 0.1),
		})
	var frame := WmLayout.rack_frame(size)
	var grey: Array = []
	for corner: Vector2 in [Vector2(-1, -1), Vector2(1, -1), Vector2(-1, 1), Vector2(1, 1)]:
		var post_size: Vector3 = frame["post"]["size"]
		var post_pos: Vector3 = frame["post"]["pos"]
		grey.append({
			"pos": Vector3(corner.x * (size["w"] / 2.0 - WmLayout.POST / 2.0), post_pos.y, corner.y * (size["d"] / 2.0 - WmLayout.POST / 2.0)),
			"size": post_size,
		})
	return {"dark": dark, "grey": grey, "top": [{"pos": frame["top"]["pos"], "size": frame["top"]["size"]}]}


static func _piers(from: float, to: float) -> Array:
	var out: Array = []
	var x := from
	while x <= to - 1e-6:
		out.append(x)
		x += WALL_BAY
	if float(out[out.size() - 1]) < to - 1e-6:
		out.append(to)
	return out


static func wall_boxes(bounds: Dictionary, height: float) -> Array:
	var min_x: float = bounds["min_x"]
	var max_x: float = bounds["max_x"]
	var min_z: float = bounds["min_z"]
	var max_z: float = bounds["max_z"]
	var boxes: Array = []
	boxes.append_array(_z_wall(min_x, max_x, min_z, height))
	boxes.append_array(_z_wall(min_x, max_x, max_z, height))
	boxes.append_array(_x_wall(min_x, min_z, max_z, height))
	boxes.append_array(_x_wall(max_x, min_z, max_z, height))
	return boxes


static func _z_wall(min_x: float, max_x: float, z: float, height: float) -> Array:
	var len := max_x - min_x
	var mid := (min_x + max_x) / 2.0
	var boxes: Array = [
		{"pos": Vector3(mid, WALL_SILL / 2.0, z), "size": Vector3(len, WALL_SILL, WALL_THICK)},
		{"pos": Vector3(mid, height - WALL_HEADER / 2.0, z), "size": Vector3(len, WALL_HEADER, WALL_THICK)},
	]
	for px in _piers(min_x, max_x):
		boxes.append({"pos": Vector3(px, height / 2.0, z), "size": Vector3(WALL_PIER, height, WALL_THICK)})
	return boxes


static func _x_wall(x: float, min_z: float, max_z: float, height: float) -> Array:
	var len := max_z - min_z
	var mid := (min_z + max_z) / 2.0
	var boxes: Array = [
		{"pos": Vector3(x, WALL_SILL / 2.0, mid), "size": Vector3(WALL_THICK, WALL_SILL, len)},
		{"pos": Vector3(x, height - WALL_HEADER / 2.0, mid), "size": Vector3(WALL_THICK, WALL_HEADER, len)},
	]
	for pz in _piers(min_z, max_z):
		boxes.append({"pos": Vector3(x, height / 2.0, pz), "size": Vector3(WALL_THICK, height, WALL_PIER)})
	return boxes


static func floor_frame_boxes(w: float, d: float) -> Dictionary:
	var fw := w + FRAME_GAP * 2.0
	var fd := d + FRAME_GAP * 2.0
	var half_w := fw / 2.0
	var half_d := fd / 2.0
	var core: Array = []
	var halo: Array = []
	var line := func(pos: Vector3, size: Vector3, halo_size: Vector3) -> void:
		core.append({"pos": pos, "size": size})
		halo.append({"pos": pos, "size": halo_size})
	line.call(Vector3(0, 0, -half_d), Vector3(fw, LINE_H, LINE), Vector3(fw, LINE_H, LINE + HALO_EXTRA))
	line.call(Vector3(0, 0, half_d), Vector3(fw, LINE_H, LINE), Vector3(fw, LINE_H, LINE + HALO_EXTRA))
	line.call(Vector3(-half_w, 0, 0), Vector3(LINE, LINE_H, fd), Vector3(LINE + HALO_EXTRA, LINE_H, fd))
	line.call(Vector3(half_w, 0, 0), Vector3(LINE, LINE_H, fd), Vector3(LINE + HALO_EXTRA, LINE_H, fd))
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			var cx: float = sx * (half_w + CORNER_OFF)
			var cz: float = sz * (half_d + CORNER_OFF)
			line.call(Vector3(cx - sx * CORNER_LEN / 2.0, 0, cz), Vector3(CORNER_LEN, LINE_H, CORNER_LINE), Vector3(CORNER_LEN, LINE_H, CORNER_LINE + HALO_EXTRA))
			line.call(Vector3(cx, 0, cz - sz * CORNER_LEN / 2.0), Vector3(CORNER_LINE, LINE_H, CORNER_LEN), Vector3(CORNER_LINE + HALO_EXTRA, LINE_H, CORNER_LEN))
	return {"core": core, "halo": halo}
