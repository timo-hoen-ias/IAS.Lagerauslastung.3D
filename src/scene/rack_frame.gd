# Bodenrahmen für das ausgewählte Regal (Port Rack.tsx FloorFrame):
# weiße Bodenlinien + dunkle Fläche während eines Drags.
extends Node3D

const CORE_COLOR := Color(1, 1, 1, 0.9)
const HALO_COLOR := Color(1, 1, 1, 0.22)
const PLANE_COLOR := Color("#11151c")

var placements: Array = []

var _edit := false
var _key := ""
var _core: Array = []
var _halo: Array = []
var _plane: MeshInstance3D
var _built := false
var _elapsed := 0.0


func _ready() -> void:
	_build()
	Store.selected_rack_changed.connect(_on_rack)
	Store.transforms_changed.connect(_refresh)
	Store.drag_active_changed.connect(_refresh)
	visible = false


func setup(arr: Array) -> void:
	placements = arr
	_refresh()


func set_edit(on: bool) -> void:
	_edit = on
	_refresh()


func _on_rack() -> void:
	_key = Store.selected_rack()
	_refresh()


func _refresh() -> void:
	if not _built:
		return
	if not _edit or _key == "" or placements.is_empty():
		visible = false
		return
	var idx := _find(_key)
	if idx < 0:
		visible = false
		return
	var base: Dictionary = placements[idx]
	var t := Store.get_transform(_key)
	var o: Vector3 = base["origin"]
	var scale: Dictionary = t["scale"]
	var w := float(base["size"]["w"]) * float(scale["x"])
	var d := float(base["size"]["d"]) * float(scale["z"])
	position = Vector3(o.x + float(t["x"]), 0.0, o.z + float(t["z"]))
	rotation = Vector3(0.0, float(t["rotY"]), 0.0)
	_update_edges(w, d)
	var dragging := Store.is_drag_active()
	_plane.visible = dragging
	visible = true


func _update_edges(w: float, d: float) -> void:
	var hw := w / 2.0
	var hd := d / 2.0
	var descs := [
		Vector3(0, 0.05, -hd), Vector3(w, 0.03, 0.03),
		Vector3(0, 0.05, hd), Vector3(w, 0.03, 0.03),
		Vector3(-hw, 0.05, 0), Vector3(0.03, 0.03, d),
		Vector3(hw, 0.05, 0), Vector3(0.03, 0.03, d),
	]
	for i in range(_core.size()):
		var mi: MeshInstance3D = _core[i]
		(mi.mesh as BoxMesh).size = descs[i * 2 + 1]
		mi.position = descs[i * 2]
	for i in range(_halo.size()):
		var mi: MeshInstance3D = _halo[i]
		var s: Vector3 = descs[i * 2 + 1] + Vector3(0.1, 0.02, 0.1)
		(mi.mesh as BoxMesh).size = s
		mi.position = descs[i * 2]
	var ps: Vector3 = (Vector3(w + 0.6, 0.02, d + 0.6)) if _plane.visible else Vector3.ZERO
	(_plane.mesh as BoxMesh).size = ps


func _find(key: String) -> int:
	for i in range(placements.size()):
		if placements[i]["key"] == key:
			return i
	return -1


func _build() -> void:
	_built = true
	var core_mat := _edge_mat(CORE_COLOR, BaseMaterial3D.BLEND_MODE_MIX)
	var halo_mat := _edge_mat(HALO_COLOR, BaseMaterial3D.BLEND_MODE_ADD)
	for i in range(4):
		var c := MeshInstance3D.new()
		c.mesh = BoxMesh.new()
		c.material_override = core_mat
		add_child(c)
		_core.append(c)
		var h := MeshInstance3D.new()
		h.mesh = BoxMesh.new()
		h.material_override = halo_mat
		add_child(h)
		_halo.append(h)
	_plane = MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3.ZERO
	_plane.mesh = pm
	var pmat := StandardMaterial3D.new()
	pmat.albedo_color = PLANE_COLOR
	pmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pmat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	pmat.render_priority = 2
	_plane.material_override = pmat
	_plane.position = Vector3(0, 0.035, 0)
	add_child(_plane)


func _edge_mat(color: Color, blend: int) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = blend
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	m.render_priority = 2
	return m


func _process(delta: float) -> void:
	if not visible:
		return
	if not Store.is_drag_active():
		_elapsed = 0.0
		return
	_elapsed += delta
	var p := 0.5 + 0.5 * sin(_elapsed * PI)
	var core_op := 0.9 + 0.1 * p
	var halo_op := 0.26 + 0.12 * p
	for mi in _core:
		(mi.material_override as StandardMaterial3D).albedo_color.a = core_op
	for mi in _halo:
		(mi.material_override as StandardMaterial3D).albedo_color.a = halo_op