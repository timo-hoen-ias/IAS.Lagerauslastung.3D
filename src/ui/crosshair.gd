# Fadenkreuz (Ego-Modus), 22x22 px in der Mitte.
class_name CrosshairUI
extends Control


func _init() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var c := Vector2(size.x / 2.0, size.y / 2.0)
	var col := Color(1, 1, 1, 0.75)
	draw_rect(Rect2(c.x - 11, c.y - 1, 22, 2), col)
	draw_rect(Rect2(c.x - 1, c.y - 11, 2, 22), col)
