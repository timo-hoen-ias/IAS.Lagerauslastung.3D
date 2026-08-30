# Orbit-Kamera: rechts ziehen = rotieren, Mitte ziehen = zoomen, Mausrad = Zoom,
# links ziehen = panen, WASD = fliegen, Leertaste/Shift = hoch/runter.
# freeze = Kamera eingefroren (während Gizmo-Drag).
extends Node3D

@export var speed := 12.0

var active := true
var frozen := false
var target := Vector3.ZERO
var yaw := 0.0
var pitch := 0.5
var distance := 40.0

@onready var cam: Camera3D = $Camera


func _ready() -> void:
	cam.current = true
	_update()


func frame(bounds: Dictionary) -> void:
	if bounds.is_empty():
		return
	var cx: float = (bounds["min_x"] + bounds["max_x"]) / 2.0
	var cz: float = (bounds["min_z"] + bounds["max_z"]) / 2.0
	target = Vector3(cx, 0.0, cz)
	distance = clampf(distance, 8.0, 800.0)
	_update()


func _unhandled_input(event: InputEvent) -> void:
	if not active or frozen:
		return
	if event is InputEventMouseMotion:
		if Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
			yaw -= event.relative.x * 0.006
			pitch = clampf(pitch - event.relative.y * 0.006, 0.05, 1.45)
			_update()
		elif Input.is_mouse_button_pressed(MOUSE_BUTTON_MIDDLE):
			distance = clampf(distance + event.relative.y * (distance * 0.015), 5.0, 800.0)
			_update()
		elif Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
			_pan(event.relative)
	elif event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			distance = maxf(5.0, distance - 3.0)
			_update()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			distance = minf(800.0, distance + 3.0)
			_update()


func _pan(rel: Vector2) -> void:
	var right := cam.global_transform.basis.x
	var up_flat := right.cross(Vector3.UP).normalized()
	var k := distance * 0.0012
	target += right * (-rel.x * k) + up_flat * (rel.y * k)
	_update()


func _process(delta: float) -> void:
	if not active or frozen:
		return
	var fwd := -cam.global_transform.basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var right := cam.global_transform.basis.x
	var move := Vector3.ZERO
	if Input.is_key_pressed(KEY_W):
		move += fwd
	if Input.is_key_pressed(KEY_S):
		move -= fwd
	if Input.is_key_pressed(KEY_D):
		move += right
	if Input.is_key_pressed(KEY_A):
		move -= right
	if Input.is_key_pressed(KEY_SPACE):
		move += Vector3.UP
	if Input.is_key_pressed(KEY_SHIFT):
		move -= Vector3.UP
	if move.length_squared() > 0.0:
		target += move.normalized() * speed * delta
		_update()


func _update() -> void:
	var cp := Vector3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw)) * distance
	cam.global_position = target + cp
	cam.look_at(target, Vector3.UP)
