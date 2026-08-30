# Top-Down-Kamera: orthografisch, Pan (rechts ziehen / WASD), Zoom (Mausrad).
extends Node3D

var active := false

var _center := Vector3.ZERO
var _height := 40.0

@onready var cam: Camera3D = $Camera


func _ready() -> void:
	cam.current = false


func setup(bounds: Dictionary) -> void:
	if bounds.is_empty():
		return
	var cx: float = (bounds["min_x"] + bounds["max_x"]) / 2.0
	var cz: float = (bounds["min_z"] + bounds["max_z"]) / 2.0
	_center = Vector3(cx, 0.0, cz)
	var size := maxf(bounds["max_x"] - bounds["min_x"], bounds["max_z"] - bounds["min_z"])
	_height = clampf(size / 1.2 + 10.0, 20.0, 240.0)
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	_apply()


func _unhandled_input(event: InputEvent) -> void:
	if not active:
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			_height = clampf(_height * 0.85, 10.0, 300.0)
			_apply()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			_height = clampf(_height * 1.15, 10.0, 300.0)
			_apply()
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		var fwd := (cam.global_position - _center)
		fwd.y = 0.0
		fwd = fwd.normalized()
		var right := Vector3(-fwd.z, 0.0, fwd.x)
		var k := _height / 300.0
		_center -= right * event.relative.x * k
		_center -= fwd * event.relative.y * k
		_apply()


func _process(delta: float) -> void:
	if not active:
		return
	var right := Vector3(1, 0, 0)
	var fwd := Vector3(0, 0, 1)
	var move := Vector3.ZERO
	if Input.is_key_pressed(KEY_W):
		move += fwd
	if Input.is_key_pressed(KEY_S):
		move -= fwd
	if Input.is_key_pressed(KEY_D):
		move += right
	if Input.is_key_pressed(KEY_A):
		move -= right
	if move.length_squared() > 0.0:
		_center += move.normalized() * 40.0 * delta
		_apply()


func _apply() -> void:
	cam.global_position = _center + Vector3(0, _height, 0)
	cam.look_at(_center, Vector3(0, 0, -1))
	cam.size = _height * 0.6
