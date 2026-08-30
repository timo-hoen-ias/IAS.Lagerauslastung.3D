# Ego-Steuerung: PointerLock, WASD, Sprint, Sprung, AABB-Push-out-Kollision,
# LookTarget (Zentral-Raycast -> Selection). Port von WalkControls.tsx.
extends Node3D

const WmPhys = preload("res://src/core/phys.gd")
const WmTransform = preload("res://src/core/transform.gd")

signal player_moved(x: float, z: float, yaw: float)

const EYE_HEIGHT := 1.7
const SPRINT := 8.0
const RADIUS := 0.35
const GRAVITY := 20.0
const JUMP_SPEED := 8.0

var active := false
var speed := 10.0

var _placed: Array = []
var _placements: Array = []
var _cell_at: Callable = Callable()
var _pos := Vector3(0, EYE_HEIGHT, 0)
var _yaw := 0.0
var _pitch := 0.0
var _vy := 0.0
var _grounded := true
var _last_selection := ""

@onready var cam: Camera3D = $Camera


func setup(placed: Array, placements: Array, cell_at: Callable, start: Vector3) -> void:
	_placed = placed
	_placements = placements
	_cell_at = cell_at
	_pos = Vector3(start.x, EYE_HEIGHT, start.z)
	_yaw = 0.0
	_pitch = 0.0
	_vy = 0.0
	_grounded = true
	_last_selection = ""
	_update_camera()


func _ready() -> void:
	cam.current = false


func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		Input.set_mouse_mode(Input.MOUSE_MODE_VISIBLE)
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
		Input.set_mouse_mode(Input.MOUSE_MODE_CAPTURED)
	elif event is InputEventMouseMotion and Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
		_yaw -= event.relative.x * 0.0022
		_pitch = clampf(_pitch - event.relative.y * 0.0022, -1.4, 1.4)
		_update_camera()


func _process(delta: float) -> void:
	if not active:
		return
	if Input.get_mouse_mode() != Input.MOUSE_MODE_CAPTURED:
		return
	delta = minf(delta, 0.05)
	# Vertikal
	_vy = WmPhys.next_vertical(_vy, _grounded, Input.is_key_pressed(KEY_SPACE), delta, GRAVITY, JUMP_SPEED)
	_pos.y += _vy * delta
	if _pos.y <= EYE_HEIGHT:
		_pos.y = EYE_HEIGHT
		_vy = 0.0
		_grounded = true
	else:
		_grounded = false
	# Horizontal
	var fwd := -cam.global_transform.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var right := cam.global_transform.basis.x
	var dir := Vector3.ZERO
	if Input.is_key_pressed(KEY_W):
		dir += fwd
	if Input.is_key_pressed(KEY_S):
		dir -= fwd
	if Input.is_key_pressed(KEY_D):
		dir += right
	if Input.is_key_pressed(KEY_A):
		dir -= right
	if dir.length_squared() > 0.0:
		dir = dir.normalized()
		var mv := SPRINT if Input.is_key_pressed(KEY_SHIFT) else speed
		var step := dir * mv * delta
		_pos.x = _resolve_x(_pos.x + step.x, _pos.z)
		_pos.z = _resolve_z(_pos.x, _pos.z + step.z)
	_update_camera()
	_report()
	_look_target()


func _resolve_x(x: float, z: float) -> float:
	for r: Dictionary in _placed:
		var b := WmTransform.rack_aabb(r)
		if z > float(b["min_z"]) - RADIUS and z < float(b["max_z"]) + RADIUS and x > float(b["min_x"]) - RADIUS and x < float(b["max_x"]) + RADIUS:
			var dl: float = x - (float(b["min_x"]) - RADIUS)
			var dr: float = (float(b["max_x"]) + RADIUS) - x
			return float(b["min_x"]) - RADIUS if dl < dr else float(b["max_x"]) + RADIUS
	return x


func _resolve_z(x: float, z: float) -> float:
	for r: Dictionary in _placed:
		var b := WmTransform.rack_aabb(r)
		if x > float(b["min_x"]) - RADIUS and x < float(b["max_x"]) + RADIUS and z > float(b["min_z"]) - RADIUS and z < float(b["max_z"]) + RADIUS:
			var dl: float = z - (float(b["min_z"]) - RADIUS)
			var dr: float = (float(b["max_z"]) + RADIUS) - z
			return float(b["min_z"]) - RADIUS if dl < dr else float(b["max_z"]) + RADIUS
	return z


func _update_camera() -> void:
	cam.global_position = _pos
	cam.rotation = Vector3(_pitch, _yaw, 0.0)


func _report() -> void:
	var fwd := -cam.global_transform.basis.z
	var yaw := atan2(fwd.x, fwd.z)
	if absf(_pos.x - _last_report.x) + absf(_pos.z - _last_report.z) + absf(yaw - _last_report.y) > 0.001:
		_last_report = Vector3(_pos.x, _pos.z, yaw)
		player_moved.emit(_pos.x, _pos.z, yaw)


var _last_report := Vector3.ZERO


func _look_target() -> void:
	var from := cam.global_position
	var to := from - cam.global_transform.basis.z * 200.0
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to)
	q.collide_with_areas = false
	q.collide_with_bodies = true
	var hit := space.intersect_ray(q)
	var body: Object = hit.get("collider", null)
	if body != null and body.is_in_group("rack"):
		var key := str(body.get_meta("rack_key", ""))
		var ort = _ort_for_key(key)
		if ort != null:
			var platz = _cell_at.call(key, hit["position"])
			var key2 := "%s|%s" % [str(ort["lagerkennung"]), "" if platz == null else str(platz["platzId"])]
			if key2 != _last_selection:
				_last_selection = key2
				Store.set_selection({"ort": ort, "platz": platz})
		elif _last_selection != "":
			_last_selection = ""
			Store.set_selection(null)
	elif _last_selection != "":
		_last_selection = ""
		Store.set_selection(null)


func _ort_for_key(key: String) -> Variant:
	for p: Dictionary in _placements:
		if p["key"] == key:
			return p["ort"]
	return null
