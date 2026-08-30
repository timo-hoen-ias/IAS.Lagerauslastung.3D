extends Node3D

const WmLayout = preload("res://src/core/layout.gd")
const WmTransform = preload("res://src/core/transform.gd")
const WmArticle = preload("res://src/core/article.gd")
const WmEditMath = preload("res://src/core/editmath.gd")
const WmUndo = preload("res://src/core/undo_controller.gd")

const MODE_LABELS := {"orbit": "ORBIT", "walk": "EGO", "topdown": "TOP-DOWN"}
const HIGHLIGHT_COLOR := Color("#7ec8ff")

@onready var warehouse: Node3D = $Warehouse
@onready var orbit_rig: Node3D = $CameraRig
@onready var hud: CanvasLayer = $HUD
@onready var inspector: CanvasLayer = $Inspector
@onready var directional: DirectionalLight3D = $DirectionalLight3D
@onready var hemisphere: DirectionalLight3D = $HemisphereLight
@onready var camera: Camera3D = $CameraRig/Camera

var _data: Dictionary = {}
var _placements: Array = []
var _mode := "orbit"
var _edit := false
var _measure := false
var _lighting := true
var _walls := false
var _speed := 10.0

var _highlight_box: Node3D
var _target_marker: Node3D
var _minimap: Control
var _walk: Node3D
var _topdown: Node3D
var _measure_node: Node3D
var _flash_root: Node3D
var _article_labels: Node3D
var _flash_seen := {}
var _article_platz_ids: Array = []
var _article_pulse := 0.0
var _last_cam := Vector3.ZERO

var _click_start := Vector2(-1, -1)
var _click_time := 0.0
var _undo: RefCounted
var _gizmo: Node3D
var _rack_frame: Node3D

var _gizmo_active := false
var _gizmo_tool := ""
var _gizmo_axis := ""
var _gizmo_key := ""
var _gizmo_t0: Dictionary = {}
var _gizmo_center := Vector3.ZERO
var _gizmo_hit_start := Vector3.ZERO
var _gizmo_plane_n := Vector3.UP
var _gizmo_plane_o := Vector3.ZERO
var _gizmo_start_angle := 0.0
var _gizmo_start_proj := 0.0


func _ready() -> void:
	DataProvider.data_ready.connect(_on_data)
	Live.buchung_received.connect(hud.add_buchung)
	Live.state_changed.connect(hud.set_ws_state)
	DataProvider.notice.connect(_on_notice)
	Store.transforms_changed.connect(_rebuild)
	Store.selection_changed.connect(_on_selection_changed)
	Store.selected_article_changed.connect(_on_article_changed)
	Store.measure_changed.connect(_on_measure_changed)
	Store.buchungen_changed.connect(_on_buchungen_changed)

	hud.mode_changed.connect(_set_mode)
	hud.edit_toggled.connect(func(on: bool): _edit = on; hud.set_edit(on); _gizmo.set_edit(on); _rack_frame.set_edit(on))
	hud.measure_toggled.connect(func(on: bool): _measure = on)
	hud.lighting_toggled.connect(func(on: bool): set_lighting(on))
	hud.walls_toggled.connect(func(on: bool): set_walls(on))
	hud.speed_changed.connect(func(v: float): _speed = v)
	hud.inspector_toggled.connect(func(on: bool): inspector.set_panel_visible(on))

	_undo = WmUndo.new(
		func(key: String) -> Variant: return Store.get_transform(key),
		func(key: String, t: Dictionary) -> void: Store.set_transform(key, t),
		func(key: String) -> void: Store.reset_transform(key)
	)
	hud.set_undo(_undo)

	_gizmo = Node3D.new()
	_gizmo.set_script(preload("res://src/scene/edit_gizmo.gd"))
	add_child(_gizmo)
	_rack_frame = Node3D.new()
	_rack_frame.set_script(preload("res://src/scene/rack_frame.gd"))
	add_child(_rack_frame)

	_highlight_box = Node3D.new()
	_highlight_box.set_script(preload("res://src/scene/highlight_box.gd"))
	add_child(_highlight_box)
	_target_marker = Node3D.new()
	_target_marker.set_script(preload("res://src/scene/target_marker.gd"))
	add_child(_target_marker)

	_walk = Node3D.new()
	_walk.set_script(preload("res://src/scene/walk_controller.gd"))
	var walk_cam := Camera3D.new()
	walk_cam.name = "Camera"
	_walk.add_child(walk_cam)
	add_child(_walk)
	_walk.player_moved.connect(_on_player_moved)

	_topdown = Node3D.new()
	_topdown.set_script(preload("res://src/scene/topdown_controller.gd"))
	var td_cam := Camera3D.new()
	td_cam.name = "Camera"
	_topdown.add_child(td_cam)
	add_child(_topdown)

	_measure_node = Node3D.new()
	_measure_node.set_script(preload("res://src/scene/measure.gd"))
	add_child(_measure_node)

	_flash_root = Node3D.new()
	add_child(_flash_root)

	_article_labels = Node3D.new()
	_article_labels.set_script(preload("res://src/scene/article_labels.gd"))
	add_child(_article_labels)

	_minimap = preload("res://src/ui/minimap.gd").new()
	_minimap.set_anchors_preset(Control.PRESET_TOP_LEFT)
	_minimap.offset_left = 12
	_minimap.offset_top = 210
	_minimap.custom_minimum_size = Vector2(220, 220)
	_minimap.visible = false
	hud.add_child(_minimap)

	_apply_lighting()
	hud.show_loading("Lade Lagerdaten …")
	_set_mode("orbit")


# ---- Daten ----------------------------------------------------------------

func _on_data(data: Dictionary, source: String) -> void:
	_data = data
	_placements = WmLayout.layout_racks(data["lagerorte"])
	_gizmo.setup(_placements)
	_rack_frame.setup(_placements)
	_rebuild()
	var orte: int = (data["lagerorte"] as Array).size()
	var plaetze := 0
	for ort: Dictionary in data["lagerorte"]:
		plaetze += (ort["plaetze"] as Array).size()
	hud.set_source(source)
	hud.set_counts(orte, plaetze)
	hud.set_ws_state("ws: verbunden" if Live.is_connected_ws() else "ws: offline")
	hud.hide_loading()
	inspector.set_data(data)


func _rebuild() -> void:
	warehouse.build(_placements, Store.all_transforms())
	orbit_rig.frame(warehouse.bounds)
	_article_labels.rebuild(_placements, warehouse.placed)
	_update_minimap()
	_refresh_article_highlight(true)
	_on_selection_changed()
	if _mode == "walk":
		_start_walk()


func _on_notice(message: String) -> void:
	print("[data] ", message)
	if message.contains("Fehler") or message.contains("nicht erreichbar") or message.contains("Parse"):
		hud.show_error(message)


func set_lighting(enabled: bool) -> void:
	_lighting = enabled
	_apply_lighting()


func _apply_lighting() -> void:
	directional.shadow_enabled = _lighting
	hemisphere.visible = _lighting


func set_walls(enabled: bool) -> void:
	_walls = enabled
	warehouse.set_walls(enabled)


# ---- Modi ----------------------------------------------------------------

func _set_mode(mode: String) -> void:
	_mode = mode
	if _mode == "walk":
		_start_walk()
		hud.set_crosshair_visible(true)
		_minimap.visible = true
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	else:
		_walk.active = false
		hud.set_crosshair_visible(false)
		_minimap.visible = false
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
	if _mode == "orbit":
		orbit_rig.active = true
		_topdown.active = false
		camera.current = true
	elif _mode == "topdown":
		orbit_rig.active = false
		_topdown.active = true
		_topdown.setup(warehouse.bounds)
		(_topdown.get_node("Camera") as Camera3D).current = true
	hud.set_readout(_last_cam.x, _last_cam.z, MODE_LABELS.get(mode, mode.to_upper()))


func _start_walk() -> void:
	if _data.is_empty():
		return
	orbit_rig.active = false
	_topdown.active = false
	_walk.active = true
	(_walk.get_node("Camera") as Camera3D).current = true
	var start := Vector3(warehouse.bounds.get("min_x", 0.0), 0, warehouse.bounds.get("min_z", 0.0))
	_walk.setup(warehouse.placed, _placements, func(key: String, p: Vector3) -> Variant:
		return warehouse.cell_at(key, p)
	, start)


func _cycle_mode() -> void:
	var order := ["orbit", "walk", "topdown"]
	var idx := order.find(_mode)
	var next: String = order[(idx + 1) % order.size()]
	_set_mode(next)
	hud.set_mode(next)


# ---- Auswahl & Marker ------------------------------------------------------

func _on_selection_changed() -> void:
	var sel = Store.selection()
	_highlight_box.hide_box()
	_target_marker.hide_marker()
	if sel == null:
		return
	var kennung: String = str(sel["ort"]["lagerkennung"])
	for r: Dictionary in warehouse.placed:
		if str(r["ort"]["lagerkennung"]) == kennung:
			if sel.has("platz") and sel["platz"] != null:
				var w := WmArticle.platz_world(r, Store.get_transform(r["key"]), sel["platz"])
				_highlight_box.show_cell(w)
			else:
				_target_marker.show_at(r["position"], float(r["size"]["h"]))
			break


# ---- Artikel-Highlight ----------------------------------------------------

func _on_article_changed() -> void:
	_article_platz_ids = []
	var art := Store.selected_article()
	if art != "":
		for r: Dictionary in warehouse.placed:
			for p: Dictionary in WmArticle.plaetze_mit_artikel(r, art):
				_article_platz_ids.append(p["platz"]["platzId"])
	_refresh_article_highlight(true)


func _refresh_article_highlight(reset: bool) -> void:
	if reset:
		for id: int in _article_platz_ids:
			warehouse.reset_cell_color(id)


# ---- Messwerkzeug ----------------------------------------------------------

func _on_measure_changed() -> void:
	var points := Store.measure_points()
	_measure_node.set_points(points)
	if points.size() == 2:
		var d := WmTransform.dist2d(points[0], points[1])
		hud.set_measure_status("Strecke: %.1f m" % d)
	elif points.size() == 1:
		hud.set_measure_status("Ersten Punkt gesetzt — zweiten Punkt wählen")
	else:
		hud.set_measure_status("")


func _on_buchungen_changed() -> void:
	if warehouse.placed.is_empty():
		return
	var flashes := WmArticle.booking_flashes(warehouse.placed, Store.buchungen(), func(key: String) -> Dictionary:
		return Store.get_transform(key)
	)
	var now := Time.get_ticks_msec() / 1000.0
	for f: Dictionary in flashes:
		var key := str(f["key"])
		if _flash_seen.has(key):
			continue
		_flash_seen[key] = now + 1.5
		var marker := Node3D.new()
		marker.set_script(preload("res://src/scene/booking_flash.gd"))
		_flash_root.add_child(marker)
		marker.setup(f["w"], f["color"], f["label"])
	for key: String in _flash_seen.keys():
		if now > float(_flash_seen[key]):
			_flash_seen.erase(key)


func _process(delta: float) -> void:
	var art := Store.selected_article()
	if art != "" and _article_platz_ids.size() > 0:
		_article_pulse += delta
		var k := 0.5 + 0.5 * sin(_article_pulse * PI)
		var col := HIGHLIGHT_COLOR.lerp(Color.WHITE, k * 0.6)
		for id: int in _article_platz_ids:
			warehouse.set_cell_color(id, col)
	else:
		_article_pulse = 0.0
	var cam_pos := camera.global_position
	if cam_pos.distance_squared_to(_last_cam) > 0.0001:
		_last_cam = cam_pos
		hud.set_readout(cam_pos.x, cam_pos.z, MODE_LABELS.get(_mode, _mode.to_upper()))


# ---- Eingabe ---------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		var kc = event.keycode
		if kc == KEY_TAB:
			_cycle_mode()
			get_viewport().set_input_as_handled()
			return
		var ctrl = event.ctrl_pressed or event.meta_pressed
		if ctrl and (kc == KEY_Z or kc == KEY_Y):
			var focus := get_viewport().gui_get_focus_owner()
			if focus is LineEdit or focus is TextEdit:
				return
			if kc == KEY_Y or event.shift_pressed:
				_undo.redo()
			else:
				_undo.undo()
			get_viewport().set_input_as_handled()
			return
		if kc == KEY_ESCAPE and _mode == "walk":
			_set_mode("orbit")
			hud.set_mode("orbit")
			get_viewport().set_input_as_handled()


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if _edit and Store.selected_rack() != "":
			_edit_shortcut(event.keycode)
			return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_click_start = event.position
			_click_time = Time.get_ticks_msec() / 1000.0
			if _edit:
				_try_start_gizmo_drag(event.position)
		else:
			if _gizmo_active:
				_end_gizmo_drag()
				return
			var d: float = event.position.distance_to(_click_start)
			var dt := Time.get_ticks_msec() / 1000.0 - _click_time
			if d < 6.0 and dt < 0.4:
				_handle_click(event.position)
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
		if _gizmo_active:
			_gizmo_drag_update(event.position)


func _edit_shortcut(keycode: int) -> void:
	var key := Store.selected_rack()
	var t := Store.get_transform(key)
	match keycode:
		KEY_UP:
			_undo.set_transform(key, WmTransform.move_rack(t, 0.0, -1.0))
		KEY_DOWN:
			_undo.set_transform(key, WmTransform.move_rack(t, 0.0, 1.0))
		KEY_LEFT:
			_undo.set_transform(key, WmTransform.move_rack(t, -1.0, 0.0))
		KEY_RIGHT:
			_undo.set_transform(key, WmTransform.move_rack(t, 1.0, 0.0))
		KEY_Q:
			_undo.set_transform(key, WmTransform.rotate_rack(t, -45.0))
		KEY_E:
			_undo.set_transform(key, WmTransform.rotate_rack(t, 45.0))
		KEY_BRACKETLEFT:
			_undo.set_transform(key, WmTransform.scale_rack(t, float(t["scale"]["x"]) - 0.5))
		KEY_BRACKETRIGHT:
			_undo.set_transform(key, WmTransform.scale_rack(t, float(t["scale"]["x"]) + 0.5))


func _handle_click(screen_pos: Vector2) -> void:
	if _edit:
		_handle_edit_select(screen_pos)
		return
	if _measure:
		var floor = _raycast_floor(screen_pos)
		if floor != null:
			Store.add_measure_point({"x": floor.x, "z": floor.z})
		return
	if _mode == "walk":
		return
	var hit := _raycast(screen_pos)
	if hit.is_empty():
		return
	var body: Object = hit.get("collider", null)
	if body != null and body.is_in_group("rack"):
		var key: String = str(body.get_meta("rack_key", ""))
		var idx := _find_placement(key)
		if idx < 0:
			return
		var ort: Dictionary = _placements[idx]["ort"]
		var platz = warehouse.cell_at(key, hit["position"])
		if platz != null:
			Store.set_selection({"ort": ort, "platz": platz})
		else:
			Store.set_selection({"ort": ort, "platz": null})


func _handle_edit_select(screen_pos: Vector2) -> void:
	var hit := _raycast(screen_pos)
	if hit.is_empty():
		Store.set_selected_rack("")
		return
	var body: Object = hit.get("collider", null)
	if body == null or not body.is_in_group("rack"):
		Store.set_selected_rack("")
		return
	Store.set_selected_rack(str(body.get_meta("rack_key", "")))


func _try_start_gizmo_drag(screen_pos: Vector2) -> void:
	if Store.selected_rack() == "":
		return
	var hit := _raycast_gizmo(screen_pos)
	if hit.is_empty():
		return
	var body: Object = hit.get("collider", null)
	if body == null:
		return
	var tool := str(body.get_meta("gizmo_tool", ""))
	var axis := str(body.get_meta("gizmo_axis", ""))
	if tool == "":
		return
	_gizmo_tool = tool
	_gizmo_axis = axis
	_gizmo_key = Store.selected_rack()
	_gizmo_t0 = Store.get_transform(_gizmo_key)
	var pi := _find_placement(_gizmo_key)
	var base: Vector3 = _placements[pi]["origin"] if pi >= 0 else Vector3.ZERO
	_gizmo_center = Vector3(base.x + float(_gizmo_t0["x"]), 0.0, base.z + float(_gizmo_t0["z"]))
	_gizmo_plane_n = WmEditMath.axis_plane_normal(_gizmo_axis_dir(), -camera.global_transform.basis.z)
	_gizmo_plane_o = _gizmo_center
	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)
	var p = WmEditMath.ray_plane_hit(from, dir, _gizmo_plane_o, _gizmo_plane_n)
	if p == null:
		return
	_gizmo_hit_start = p
	_gizmo_start_angle = WmEditMath.angle_signed(_gizmo_center, p)
	_gizmo_start_proj = WmEditMath.project_axis(p, _gizmo_center, _gizmo_axis_dir())
	_gizmo_active = true
	orbit_rig.frozen = true
	Store.set_drag_active(true)


func _gizmo_drag_update(screen_pos: Vector2) -> void:
	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)
	var p = WmEditMath.ray_plane_hit(from, dir, _gizmo_plane_o, _gizmo_plane_n)
	if p == null:
		return
	var t: Dictionary = _gizmo_t0.duplicate(true)
	match _gizmo_tool:
		"translate":
			var ad := _gizmo_axis_dir()
			var d := WmEditMath.project_axis(p, _gizmo_hit_start, ad)
			if _gizmo_axis == "y":
				t["y"] = float(_gizmo_t0["y"]) + d
			else:
				t["x"] = float(_gizmo_t0["x"]) + ad.x * d
				t["z"] = float(_gizmo_t0["z"]) + ad.z * d
		"rotate":
			var a := WmEditMath.wrap_angle_rad(WmEditMath.angle_signed(_gizmo_center, p) - _gizmo_start_angle)
			t["rotY"] = float(_gizmo_t0["rotY"]) + rad_to_deg(a)
		"scale":
			var c := WmEditMath.project_axis(p, _gizmo_plane_o, _gizmo_axis_dir())
			var f := _gizmo_start_proj
			var v := 1.0 if absf(f) < 1e-6 else c / f
			var ns: float = float(_gizmo_t0["scale"]["x"])
			if _gizmo_axis == "x":
				ns = maxf(float(_gizmo_t0["scale"]["x"]) * v, 0.15)
			elif _gizmo_axis == "z":
				ns = maxf(float(_gizmo_t0["scale"]["z"]) * v, 0.15)
			elif _gizmo_axis == "y":
				ns = maxf(float(_gizmo_t0["scale"]["y"]) * v, 0.15)
			_apply_scale_axis(t, _gizmo_axis, ns)
	Store.set_transform(_gizmo_key, t)


func _apply_scale_axis(t: Dictionary, axis: String, value: float) -> void:
	t["scale"] = t["scale"].duplicate(true)
	if axis == "x":
		t["scale"]["x"] = value
	elif axis == "y":
		t["scale"]["y"] = value
	elif axis == "z":
		t["scale"]["z"] = value
	elif axis == "all":
		t["scale"]["x"] = value
		t["scale"]["y"] = value
		t["scale"]["z"] = value


func _end_gizmo_drag() -> void:
	Store.set_drag_active(false)
	orbit_rig.frozen = false
	if not _undo_ok(_gizmo_t0, Store.get_transform(_gizmo_key)):
		_undo.record_drag(_gizmo_key, Store.get_transform(_gizmo_key), _gizmo_t0)
	_gizmo_active = false


func _undo_ok(start: Dictionary, fin: Dictionary) -> bool:
	for k: String in start:
		var a: Variant = start[k]
		var b: Variant = fin[k]
		if a is Dictionary:
			if not _undo_ok(a, b):
				return false
			continue
		if float(a) != float(b):
			return false
	return true


func _gizmo_axis_dir() -> Vector3:
	var rot := float(_gizmo_t0["rotY"])
	match _gizmo_axis:
		"x":
			return WmEditMath.axis_dir("x", rot)
		"z":
			return WmEditMath.axis_dir("z", rot)
	return Vector3.UP


func _raycast_gizmo(screen_pos: Vector2) -> Dictionary:
	var from := camera.project_ray_origin(screen_pos)
	var to := from + camera.project_ray_normal(screen_pos) * 2000.0
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to)
	q.collide_with_areas = false
	q.collide_with_bodies = true
	q.collision_mask = WmEditMath.GIZMO_LAYER
	q.hit_from_inside = true
	return space.intersect_ray(q)


func _find_placement(key: String) -> int:
	for i in range(_placements.size()):
		if _placements[i]["key"] == key:
			return i
	return -1


func _raycast(screen_pos: Vector2) -> Dictionary:
	var from := camera.project_ray_origin(screen_pos)
	var to := from + camera.project_ray_normal(screen_pos) * 2000.0
	return _raycast_from_to(from, to)


func _raycast_floor(screen_pos: Vector2) -> Variant:
	var from := camera.project_ray_origin(screen_pos)
	var dir := camera.project_ray_normal(screen_pos)
	if absf(dir.y) < 1e-6:
		return null
	var t := -from.y / dir.y
	if t < 0.0:
		return null
	return from + dir * t


func _raycast_from_to(from: Vector3, to: Vector3) -> Dictionary:
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to)
	q.collide_with_areas = false
	q.collide_with_bodies = true
	return space.intersect_ray(q)


func _on_player_moved(x: float, z: float, yaw: float) -> void:
	_minimap.set_state(warehouse.placed, x, z, yaw)


func _update_minimap() -> void:
	if _minimap:
		_minimap.set_state(warehouse.placed, 0.0, 0.0, 0.0)
