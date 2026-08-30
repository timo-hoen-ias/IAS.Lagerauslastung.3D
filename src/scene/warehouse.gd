# Baut das 3D-Lager aus LagerDaten + Regal-Transformationen.
# Zellen als Segmente (Port cellSegments): leer transparent, Einzelbox Bestandsfarbe,
# Mehrfach-Artikel prozentual entlang x mit Kisten-Farben. Plus Regal-Kanten-Puls.
extends Node3D

const WmLayout = preload("res://src/core/layout.gd")
const WmTransform = preload("res://src/core/transform.gd")
const WmBoxes = preload("res://src/core/boxes.gd")
const WmCell = preload("res://src/core/cell.gd")

const FRAME_COLOR := Color("#8f8f8f")
const BOARD_COLOR := Color("#3a3f47")
const FLOOR_COLOR := Color("#5f646d")
const GRID_COLOR := Color("#c3c7cd")
const PERIMETER_COLOR := Color(1, 1, 1, 0.35)
const CORNER_COLOR := Color("#7ec8ff")
const WALL_COLOR := Color("#333840")
const LABEL_COLOR := Color("#e8ecf1")
const EDGE_COLOR := Color("#ffffff")

const MARGIN := 4.0
const FLOOR_MARGIN := 10.0
const GRID_CELL := 1.0

var placements: Array = []
var placed: Array = []
var bounds := {}

var _cell_filled: Array = []
var _cell_filled_colors: Array = []
var _cell_empty: Array = []
var _cell_empty_colors: Array = []
var _cell_filled_mm: MultiMesh
var _cell_empty_mm: MultiMesh
var _cell_lookup := {}
var _grid_node: Node3D
var _perimeter_node: Node3D
var _walls_node: Node3D
var _walls_enabled := false
var _rack_edge_mm: MultiMesh
var _rack_edge_mat: StandardMaterial3D

static var _unit_box: BoxMesh


func build(rack_placements: Array, transforms: Dictionary) -> void:
	for c in get_children():
		c.free()
	placements = rack_placements
	placed = []
	_cell_filled = []
	_cell_filled_colors = []
	_cell_empty = []
	_cell_empty_colors = []
	_cell_lookup = {}
	_cell_filled_mm = null
	_cell_empty_mm = null
	_rack_edge_mm = null
	_rack_edge_mat = null

	for p: Dictionary in placements:
		var t: Dictionary = transforms.get(p["key"], WmTransform.identity_transform())
		placed.append(WmTransform.apply_transform(p, t))

	_add_floor()
	for i in range(placements.size()):
		var t: Dictionary = transforms.get(placements[i]["key"], WmTransform.identity_transform())
		_collect_rack(placements[i], placed[i], t)
	_flush_cells()
	_flush_boxes(_collect_boards(), BOARD_COLOR)
	_flush_boxes(_collect_frames(), FRAME_COLOR)
	_add_grid()
	_add_perimeter()
	_add_rack_edges()
	_add_walls()
	_add_labels()
	_add_colliders()
	bounds = WmTransform.rack_bounds(placed)


static func _box() -> BoxMesh:
	if _unit_box == null:
		_unit_box = BoxMesh.new()
		_unit_box.size = Vector3.ONE
	return _unit_box


# Grauer Boden, der das Lager immer umschließt (MGS2-VR-Look).
func _add_floor() -> void:
	var size := 60.0
	var cx := 0.0
	var cz := 0.0
	if not placed.is_empty():
		var b := WmTransform.rack_bounds(placed, FLOOR_MARGIN)
		size = maxf(b["max_x"] - b["min_x"], b["max_z"] - b["min_z"])
		cx = (b["min_x"] + b["max_x"]) / 2.0
		cz = (b["min_z"] + b["max_z"]) / 2.0
	var floor := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(size, size)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = FLOOR_COLOR
	mat.roughness = 1.0
	plane.material = mat
	floor.mesh = plane
	floor.position = Vector3(cx, 0.0, cz)
	add_child(floor)


func _world(local: Vector3, rack_pos: Vector3, rot: float, scale: Dictionary) -> Vector3:
	var s := Vector3(float(scale["x"]), float(scale["y"]), float(scale["z"]))
	var v := local * s
	var c := cos(rot)
	var sn := sin(rot)
	return rack_pos + Vector3(c * v.x - sn * v.z, v.y, sn * v.x + c * v.z)


func _flush_cells() -> void:
	if _cell_filled.size() > 0:
		_cell_filled_mm = _build_cell_multi(_cell_filled, _cell_filled_colors, false)
	if _cell_empty.size() > 0:
		_cell_empty_mm = _build_cell_multi(_cell_empty, _cell_empty_colors, true)


func _build_cell_multi(transforms: Array, colors: Array, empty: bool) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _box()
	mm.instance_count = transforms.size()
	for i in range(transforms.size()):
		mm.set_instance_transform(i, transforms[i])
		mm.set_instance_color(i, colors[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.WHITE
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 0.6
	mat.metallic = 0.1
	if empty:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(1, 1, 1, 0.3)
	mi.material_override = mat
	add_child(mi)
	return mm


func _collect_rack(p: Dictionary, pplaced: Dictionary, t: Dictionary) -> void:
	var ort: Dictionary = p["ort"]
	var rack_pos: Vector3 = pplaced["position"]
	var rot: float = pplaced["rotY"]
	var scale: Dictionary = t["scale"]
	var rack := {
		"kind": p["kind"], "gang": p["gang"], "cols": p["cols"], "levels": p["levels"],
		"depth": p["depth"], "flat": p["flat"], "cell_h": p["cell_h"],
	}
	for platz: Dictionary in WmLayout.gang_plaetze(ort, p["kind"], p["gang"]):
		var segs := WmCell.cell_segments([platz], rack)
		var refs: Array = []
		for seg: Dictionary in segs["segs"]:
			var local: Vector3 = seg["pos"]
			var ws := _scale_vec(seg["size"], scale)
			var t3 := Transform3D(Basis().scaled(ws), _world(local, rack_pos, rot, scale))
			if seg["empty"]:
				var ei: int = _cell_empty.size()
				_cell_empty.append(t3)
				_cell_empty_colors.append(seg["color"])
				refs.append({"filled": false, "index": ei, "base": seg["color"]})
			else:
				var fi: int = _cell_filled.size()
				_cell_filled.append(t3)
				_cell_filled_colors.append(seg["color"])
				refs.append({"filled": true, "index": fi, "base": seg["color"]})
		_cell_lookup[platz["platzId"]] = refs


func _collect_boards() -> Array:
	var out: Array = []
	for i in range(placements.size()):
		var p: Dictionary = placements[i]
		var pp: Dictionary = placed[i]
		var t: Dictionary = Store.get_transform(p["key"])
		var parts := WmBoxes.rack_parts(p["size"], int(p["levels"]), float(p["cell_h"]))
		for bd: Dictionary in parts["dark"]:
			out.append({"pos": _world(bd["pos"], pp["position"], pp["rotY"], t["scale"]), "size": _scale_vec(bd["size"], t["scale"])})
	return out


func _collect_frames() -> Array:
	var out: Array = []
	for i in range(placements.size()):
		var p: Dictionary = placements[i]
		var pp: Dictionary = placed[i]
		var t: Dictionary = Store.get_transform(p["key"])
		var frame := WmLayout.rack_frame(p["size"])
		out.append({"pos": _world(frame["top"]["pos"], pp["position"], pp["rotY"], t["scale"]), "size": _scale_vec(frame["top"]["size"], t["scale"])})
		var hw: float = p["size"]["w"] / 2.0
		var hd: float = p["size"]["d"] / 2.0
		for corner: Vector3 in [Vector3(-hw, 0, -hd), Vector3(hw, 0, -hd), Vector3(-hw, 0, hd), Vector3(hw, 0, hd)]:
			out.append({"pos": _world(corner + frame["post"]["pos"], pp["position"], pp["rotY"], t["scale"]), "size": _scale_vec(frame["post"]["size"], t["scale"])})
	return out


func _scale_vec(size: Vector3, scale: Dictionary) -> Vector3:
	return Vector3(size.x * float(scale["x"]), size.y * float(scale["y"]), size.z * float(scale["z"]))


func _flush_boxes(descs: Array, color: Color) -> void:
	if descs.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = false
	mm.mesh = _box()
	mm.instance_count = descs.size()
	for i in range(descs.size()):
		var d: Dictionary = descs[i]
		mm.set_instance_transform(i, Transform3D(Basis().scaled(d["size"]), d["pos"]))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.85
	mi.material_override = mat
	add_child(mi)


func _add_grid() -> void:
	if placed.is_empty():
		return
	var b := WmTransform.rack_bounds(placed, MARGIN)
	var descs: Array = []
	var x := floorf(b["min_x"])
	while x <= b["max_x"]:
		descs.append({"pos": Vector3(x, 0.01, (b["min_z"] + b["max_z"]) / 2.0), "size": Vector3(0.012, 0.012, b["max_z"] - b["min_z"])})
		x += GRID_CELL
	var z := floorf(b["min_z"])
	while z <= b["max_z"]:
		descs.append({"pos": Vector3((b["min_x"] + b["max_x"]) / 2.0, 0.01, z), "size": Vector3(b["max_x"] - b["min_x"], 0.012, 0.012)})
		z += GRID_CELL
	_grid_node = Node3D.new()
	add_child(_grid_node)
	_add_multi_to(_grid_node, descs, GRID_COLOR)


func _add_perimeter() -> void:
	if placed.is_empty():
		return
	var b := WmTransform.rack_bounds(placed, MARGIN)
	var min_x: float = b["min_x"]
	var max_x: float = b["max_x"]
	var min_z: float = b["min_z"]
	var max_z: float = b["max_z"]
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _box()
	var edges: Array = [
		{"pos": Vector3((min_x + max_x) / 2.0, 0.03, min_z), "size": Vector3(max_x - min_x, 0.04, 0.04)},
		{"pos": Vector3((min_x + max_x) / 2.0, 0.03, max_z), "size": Vector3(max_x - min_x, 0.04, 0.04)},
		{"pos": Vector3(min_x, 0.03, (min_z + max_z) / 2.0), "size": Vector3(0.04, 0.04, max_z - min_z)},
		{"pos": Vector3(max_x, 0.03, (min_z + max_z) / 2.0), "size": Vector3(0.04, 0.04, max_z - min_z)},
	]
	var corners: Array = []
	for sx in [1.0, -1.0]:
		for sz in [1.0, -1.0]:
			var cx: float = max_x if sx > 0 else min_x
			var cz: float = max_z if sz > 0 else min_z
			corners.append({"pos": Vector3(cx - sx * 0.25, 0.03, cz), "size": Vector3(0.5, 0.04, 0.04)})
			corners.append({"pos": Vector3(cx, 0.03, cz - sz * 0.25), "size": Vector3(0.04, 0.04, 0.5)})
	var all: Array = edges + corners
	mm.instance_count = all.size()
	for i in range(all.size()):
		var d: Dictionary = all[i]
		mm.set_instance_transform(i, Transform3D(Basis().scaled(d["size"]), d["pos"]))
		mm.set_instance_color(i, PERIMETER_COLOR if i < 4 else CORNER_COLOR)
	_perimeter_node = Node3D.new()
	add_child(_perimeter_node)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.WHITE
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mi.material_override = mat
	_perimeter_node.add_child(mi)


func _add_walls() -> void:
	if placed.is_empty():
		return
	var b := WmTransform.rack_bounds(placed, MARGIN)
	var max_top := 0.0
	for r: Dictionary in placed:
		max_top = maxf(max_top, float(r["size"]["h"]))
	var height := clampf(max_top + 1.0, 3.0, 12.0)
	var boxes := WmBoxes.wall_boxes(b, height)
	_walls_node = Node3D.new()
	add_child(_walls_node)
	_add_multi_to(_walls_node, boxes, WALL_COLOR)
	_walls_node.visible = _walls_enabled


func _add_labels() -> void:
	var font := ThemeDB.fallback_font
	for r: Dictionary in placed:
		var l := Label3D.new()
		l.text = str(r["ort"]["lagerkennung"])
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.outline_size = 8
		l.font_size = 56
		l.pixel_size = 0.007
		l.modulate = LABEL_COLOR
		l.position = r["position"] + Vector3(0, float(r["size"]["h"]) + 1.1, 0)
		add_child(l)


func set_walls(enabled: bool) -> void:
	_walls_enabled = enabled
	if _walls_node:
		_walls_node.visible = enabled


func walls_enabled() -> bool:
	return _walls_enabled


func _add_multi_to(parent: Node, descs: Array, color: Color) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = false
	mm.mesh = _box()
	mm.instance_count = descs.size()
	for i in range(descs.size()):
		var d: Dictionary = descs[i]
		mm.set_instance_transform(i, Transform3D(Basis().scaled(d["size"]), d["pos"]))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.85
	mi.material_override = mat
	parent.add_child(mi)


# Instanz-Index für einen Platz (für Farb-Overrides P3/P5).
func cell_ref(platz_id: int) -> Variant:
	return _cell_lookup.get(platz_id, null)


# ---- Kollider & Picking ----------------------------------------------------

var _rack_bodies: Array = []


func _add_colliders() -> void:
	_rack_bodies = []
	var floor_body := StaticBody3D.new()
	var floor_shape := CollisionShape3D.new()
	var floor_box := BoxShape3D.new()
	floor_box.size = Vector3(600, 0.1, 600)
	floor_shape.shape = floor_box
	floor_shape.position = Vector3(0, -0.05, 0)
	floor_body.add_child(floor_shape)
	floor_body.add_to_group("floor")
	add_child(floor_body)
	for i in range(placed.size()):
		var pp: Dictionary = placed[i]
		var body := StaticBody3D.new()
		body.transform = Transform3D(Basis(Vector3.UP, pp["rotY"]), pp["position"])
		var cs := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = Vector3(pp["size"]["w"], pp["size"]["h"], pp["size"]["d"])
		cs.shape = box
		body.add_child(cs)
		body.add_to_group("rack")
		body.set_meta("rack_key", pp["key"])
		add_child(body)
		_rack_bodies.append(body)


func rack_body_for_key(key: String) -> Variant:
	for b: StaticBody3D in _rack_bodies:
		if b.get_meta("rack_key", "") == key:
			return b
	return null


# Zelle aus Weltpunkt auflösen (Inverses von cellLocalPosition + Scale/Rotation).
func cell_at(placed_key: String, world_point: Vector3) -> Variant:
	var idx := _find_index(placed_key)
	if idx < 0:
		return null
	var p: Dictionary = placements[idx]
	var pp: Dictionary = placed[idx]
	var t: Dictionary = Store.get_transform(placed_key)
	var scale: Dictionary = t["scale"]
	# Welt -> lokaler (unskalierter) Punkt
	var v: Vector3 = world_point - pp["position"]
	var rot := -float(pp["rotY"])
	var c := cos(rot)
	var sn := sin(rot)
	var local := Vector3(c * v.x - sn * v.z, v.y / float(scale["y"]), sn * v.x + c * v.z) / Vector3(float(scale["x"]), 1.0, float(scale["z"]))
	var rack := {
		"kind": p["kind"], "gang": p["gang"], "cols": p["cols"], "levels": p["levels"],
		"depth": p["depth"], "flat": p["flat"], "cell_h": p["cell_h"],
	}
	var eps := 0.02
	for platz: Dictionary in WmLayout.gang_plaetze(p["ort"], p["kind"], p["gang"]):
		var center: Vector3 = WmLayout.cell_local_position(platz, rack)
		var box := WmLayout.cell_size(platz)
		if absf(local.x - center.x) <= float(box["w"]) / 2.0 + eps and absf(local.y - center.y) <= float(box["h"]) / 2.0 + eps and absf(local.z - center.z) <= float(box["d"]) / 2.0 + eps:
			return platz
	return null


func _find_index(placed_key: String) -> int:
	for i in range(placements.size()):
		if placements[i]["key"] == placed_key:
			return i
	return -1


# ---- Zell-Farben (Hover/Artikel-Highlight/Flash) ---------------------------

func set_cell_color(platz_id: int, color: Color) -> void:
	var refs = _cell_lookup.get(platz_id, null)
	if refs == null:
		return
	for ref: Dictionary in refs:
		var mm := _cell_filled_mm if ref["filled"] else _cell_empty_mm
		if mm != null:
			mm.set_instance_color(ref["index"], color)


func reset_cell_color(platz_id: int) -> void:
	var refs = _cell_lookup.get(platz_id, null)
	if refs == null:
		return
	for ref: Dictionary in refs:
		var mm := _cell_filled_mm if ref["filled"] else _cell_empty_mm
		if mm != null:
			mm.set_instance_color(ref["index"], ref["base"])


# ---- Pulsierende weiße Regal-Kanten ----------------------------------------

func _add_rack_edges() -> void:
	var transforms: Array = []
	for pp: Dictionary in placed:
		var w: float = pp["size"]["w"]
		var h: float = pp["size"]["h"]
		var d: float = pp["size"]["d"]
		var center: Vector3 = pp["position"] + Vector3(0, h / 2.0, 0)
		var hw := w / 2.0 + 0.1
		var hh := h / 2.0 + 0.1
		var hd := d / 2.0 + 0.1
		var edges: Array = []
		for y: float in [-hh, hh]:
			edges.append({"p": Vector3(0, y, -hd), "s": Vector3(w + 0.2, 0.03, 0.03)})
			edges.append({"p": Vector3(0, y, hd), "s": Vector3(w + 0.2, 0.03, 0.03)})
			edges.append({"p": Vector3(-hw, y, 0), "s": Vector3(0.03, 0.03, d + 0.2)})
			edges.append({"p": Vector3(hw, y, 0), "s": Vector3(0.03, 0.03, d + 0.2)})
		for x: float in [-hw, hw]:
			for z: float in [-hd, hd]:
				edges.append({"p": Vector3(x, 0, z), "s": Vector3(0.03, h + 0.2, 0.03)})
		var rot := float(pp["rotY"])
		var c := cos(rot)
		var sn := sin(rot)
		for e: Dictionary in edges:
			var p: Vector3 = e["p"]
			var vp := Vector3(c * p.x - sn * p.z, p.y, sn * p.x + c * p.z)
			var vs := Vector3(e["s"].x, e["s"].y, e["s"].z)
			transforms.append(Transform3D(Basis().scaled(vs), center + vp))
	if transforms.is_empty():
		return
	_rack_edge_mm = MultiMesh.new()
	_rack_edge_mm.transform_format = MultiMesh.TRANSFORM_3D
	_rack_edge_mm.use_colors = false
	_rack_edge_mm.mesh = _box()
	_rack_edge_mm.instance_count = transforms.size()
	for i in range(transforms.size()):
		_rack_edge_mm.set_instance_transform(i, transforms[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = _rack_edge_mm
	_rack_edge_mat = StandardMaterial3D.new()
	_rack_edge_mat.albedo_color = Color(1, 1, 1, 0.2)
	_rack_edge_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_rack_edge_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_rack_edge_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_rack_edge_mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_rack_edge_mat.render_priority = 5
	mi.material_override = _rack_edge_mat
	add_child(mi)


func _process(_delta: float) -> void:
	if _rack_edge_mat == null:
		return
	var p := 0.5 + 0.5 * sin(Time.get_ticks_msec() / 1000.0 * PI)
	_rack_edge_mat.albedo_color.a = 0.12 + 0.22 * p
