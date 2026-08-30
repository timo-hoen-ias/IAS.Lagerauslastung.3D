# 3D-Editier-Gizmo (three.js TransformControls-Port für Regale):
# Verschieben: X-/Z-Pfeile + XZ-Ebene · Drehen: Y-Ring · Skalieren: Würfel.
# StaticBody-Handles auf Collision-Layer bit 1 (GIZMO_LAYER) für gezielten Raycast.
extends Node3D

const WmEditMath = preload("res://src/core/editmath.gd")

const X_COLOR := Color("#e74c3c")
const Y_COLOR := Color("#2ecc71")
const Z_COLOR := Color("#3498db")
const PLANE_COLOR := Color(1, 1, 1, 0.35)

const ARROW_LEN := 0.8
const ARROW_OFF := 0.5
const ARROW_TIP := 0.24
const SCALE_OFF := 0.9
const RING_RADIUS := 1.15

var placements: Array = []
var ring_y := 1.2

var _edit := false
var _key := ""
var _mode := "translate"
var _handles: Array = []


func _ready() -> void:
	_build()
	Store.selected_rack_changed.connect(_on_rack)
	Store.transform_mode_changed.connect(func(): _mode = Store.transform_mode(); _refresh_handles())
	Store.transforms_changed.connect(sync)
	visible = false


func setup(arr: Array) -> void:
	placements = arr
	sync()


func set_edit(on: bool) -> void:
	_edit = on
	sync()


func _on_rack() -> void:
	_key = Store.selected_rack()
	sync()


# Position/Rotation/Höhe aus Placement + Store-Transform aktualisieren.
func sync() -> void:
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
	global_position = Vector3(o.x + float(t["x"]), 0.0, o.z + float(t["z"]))
	rotation = Vector3(0.0, float(t["rotY"]), 0.0)
	var scale: Dictionary = t["scale"]
	ring_y = maxf(float(base["size"]["h"]) * float(scale["y"]) / 2.0 + 0.7, 1.2)
	for h in _handles:
		if h["tool"] == "rotate":
			(h["body"] as StaticBody3D).position.y = ring_y
	visible = true
	_refresh_handles()


func _refresh_handles() -> void:
	for h in _handles:
		var on = _mode == h["tool"]
		(h["body"] as StaticBody3D).set_deferred("collision_layer", WmEditMath.GIZMO_LAYER if on else 0)
		for mi in h["meshes"]:
			mi.visible = on


# ---- Hover / Drag-Highlight ------------------------------------------------

func highlight(tool: String, axis: String) -> void:
	for h in _handles:
		var on = h["tool"] == tool and h["axis"] == axis
		(h["mat"] as StandardMaterial3D).albedo_color = h["base"].lerp(Color.WHITE, 0.55) if on else h["base"]


func clear_highlight() -> void:
	for h in _handles:
		(h["mat"] as StandardMaterial3D).albedo_color = h["base"]


func _process(_delta: float) -> void:
	if not visible or Store.is_drag_active():
		clear_highlight()
		return
	var vp := get_viewport()
	var cam := vp.get_camera_3d()
	if cam == null:
		return
	var mp := vp.get_mouse_position()
	var from := cam.project_ray_origin(mp)
	var to := from + cam.project_ray_normal(mp) * 2000.0
	var q := PhysicsRayQueryParameters3D.create(from, to)
	q.collision_mask = WmEditMath.GIZMO_LAYER
	q.collide_with_areas = false
	q.collide_with_bodies = true
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	var body: Object = hit.get("collider", null)
	if body != null:
		highlight(str(body.get_meta("gizmo_tool", "")), str(body.get_meta("gizmo_axis", "")))
	else:
		clear_highlight()


func _find(key: String) -> int:
	for i in range(placements.size()):
		if placements[i]["key"] == key:
			return i
	return -1


# ---- Handle-Aufbau ---------------------------------------------------------

func _build() -> void:
	_build_axis_arrow("x", X_COLOR)
	_build_axis_arrow("z", Z_COLOR)
	_build_plane()
	_build_ring()
	_build_scale("x", X_COLOR)
	_build_scale("y", Y_COLOR)
	_build_scale("z", Z_COLOR)


func _new_mat(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if color.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		m.render_priority = 3
	return m


func _register(body: StaticBody3D, mat: StandardMaterial3D, tool: String, axis: String) -> void:
	body.set_meta("gizmo_tool", tool)
	body.set_meta("gizmo_axis", axis)
	body.collision_layer = WmEditMath.GIZMO_LAYER
	body.collision_mask = 0
	add_child(body)
	_handles.append({"tool": tool, "axis": axis, "body": body, "meshes": [], "mat": mat, "base": mat.albedo_color})


func _add_shape(body: StaticBody3D, bsize: Vector3, pos: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = bsize
	cs.shape = box
	cs.position = pos
	body.add_child(cs)


# Mesh als Kind des Bodys hängen + Material, damit Highlight mitläuft.
func _attach(body: StaticBody3D, mi: MeshInstance3D, mat: StandardMaterial3D) -> void:
	mi.material_override = mat
	body.add_child(mi)
	for h in _handles:
		if h["body"] == body:
			h["meshes"].append(mi)
			return


func _build_axis_arrow(axis: String, color: Color) -> void:
	var mat := _new_mat(color)
	var body := StaticBody3D.new()
	_register(body, mat, "translate", axis)
	var cylinder := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.035
	cm.bottom_radius = 0.035
	cm.height = ARROW_LEN
	cylinder.mesh = cm
	var cone := MeshInstance3D.new()
	var kone := CylinderMesh.new()
	kone.top_radius = 0.0
	kone.bottom_radius = 0.09
	kone.height = ARROW_TIP
	cone.mesh = kone
	if axis == "x":
		cylinder.rotation_degrees = Vector3(0, 0, 90)
		cone.rotation_degrees = Vector3(0, 0, 90)
		cylinder.position = Vector3(ARROW_OFF, 0, 0)
		cone.position = Vector3(ARROW_OFF + ARROW_LEN / 2.0 + ARROW_TIP / 2.0 - 0.02, 0, 0)
		_add_shape(body, Vector3(ARROW_LEN + 0.24, 0.08, 0.08), Vector3(ARROW_OFF, 0, 0))
	else:
		cylinder.rotation_degrees = Vector3(90, 0, 0)
		cone.rotation_degrees = Vector3(90, 0, 0)
		cylinder.position = Vector3(0, 0, ARROW_OFF)
		cone.position = Vector3(0, 0, ARROW_OFF + ARROW_LEN / 2.0 + ARROW_TIP / 2.0 - 0.02)
		_add_shape(body, Vector3(0.08, 0.08, ARROW_LEN + 0.24), Vector3(0, 0, ARROW_OFF))
	_attach(body, cylinder, mat)
	_attach(body, cone, mat)


func _build_plane() -> void:
	var mat := _new_mat(PLANE_COLOR)
	var body := StaticBody3D.new()
	_register(body, mat, "translate", "xz")
	var mi := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(1.0, 0.02, 1.0)
	mi.mesh = pm
	mi.position = Vector3(0, 0.35, 0)
	_add_shape(body, Vector3(1.0, 0.06, 1.0), Vector3(0, 0.35, 0))
	_attach(body, mi, mat)


func _build_ring() -> void:
	var mat := _new_mat(Y_COLOR)
	var body := StaticBody3D.new()
	_register(body, mat, "rotate", "y")
	body.position.y = ring_y
	var mi := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = RING_RADIUS - 0.06
	tm.outer_radius = RING_RADIUS + 0.06
	mi.mesh = tm
	mi.rotation_degrees = Vector3(90, 0, 0)
	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = RING_RADIUS
	cyl.height = 0.08
	cs.shape = cyl
	body.add_child(cs)
	_attach(body, mi, mat)


func _build_scale(axis: String, color: Color) -> void:
	var mat := _new_mat(color)
	var body := StaticBody3D.new()
	_register(body, mat, "scale", axis)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.2, 0.2, 0.2)
	mi.mesh = bm
	match axis:
		"x":
			mi.position = Vector3(SCALE_OFF, 0, 0)
		"y":
			mi.position = Vector3(0, SCALE_OFF, 0)
		"z":
			mi.position = Vector3(0, 0, SCALE_OFF)
	_add_shape(body, Vector3(0.24, 0.24, 0.24), mi.position)
	_attach(body, mi, mat)
