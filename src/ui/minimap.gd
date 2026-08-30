# Minimap (Ego-Modus): Regale als Rechtecke, Spieler-Pfeil in der Mitte.
extends Control

const RACK_COLOR := Color(0.6, 0.6, 0.6, 0.75)
const PLAYER_COLOR := Color("#7ec8ff")

var _placed: Array = []
var _px := 0.0
var _pz := 0.0
var _pyaw := 0.0
var _scale := 1.0


func _ready() -> void:
	custom_minimum_size = Vector2(220, 220)


func set_state(placed: Array, px: float, pz: float, yaw: float) -> void:
	_placed = placed
	_px = px
	_pz = pz
	_pyaw = yaw
	queue_redraw()


func _process(_delta: float) -> void:
	pass


func _draw() -> void:
	if _placed.is_empty():
		return
	var W := size.x
	var H := size.y
	var min_x := INF
	var max_x := -INF
	var min_z := INF
	var max_z := -INF
	for r: Dictionary in _placed:
		var b := WmTransform.rack_aabb(r)
		min_x = minf(min_x, b["min_x"])
		max_x = maxf(max_x, b["max_x"])
		min_z = minf(min_z, b["min_z"])
		max_z = maxf(max_z, b["max_z"])
	_scale = minf(W / maxf(max_x - min_x, 1.0), H / maxf(max_z - min_z, 1.0)) * 0.85
	for r: Dictionary in _placed:
		var pts: PackedVector2Array = []
		var hw: float = r["size"]["w"] / 2.0
		var hd: float = r["size"]["d"] / 2.0
		for corner: Vector2 in [Vector2(-hw, -hd), Vector2(hw, -hd), Vector2(hw, hd), Vector2(-hw, hd)]:
			var rot := float(r["rotY"])
			var rx := corner.x * cos(rot) - corner.y * sin(rot)
			var rz := corner.x * sin(rot) + corner.y * cos(rot)
			pts.append(_screen(float(r["position"].x) + rx, float(r["position"].z) + rz))
		draw_colored_polygon(pts, RACK_COLOR)
	var a := _pyaw + PI
	var up := Vector2(sin(a), cos(a))
	var right := Vector2(-cos(a), sin(a))
	var c := Vector2(W / 2.0, H / 2.0)
	var tri := PackedVector2Array([c + up * 9.0, c - up * 7.0 + right * 5.0, c - up * 7.0 - right * 5.0])
	draw_colored_polygon(tri, PLAYER_COLOR)


func _screen(x: float, z: float) -> Vector2:
	var dx := x - _px
	var dz := z - _pz
	var a := _pyaw + PI
	var rx := dx * cos(a) - dz * sin(a)
	var rz := dx * sin(a) + dz * cos(a)
	return Vector2(size.x / 2.0 + rx * _scale, size.y / 2.0 + rz * _scale)
