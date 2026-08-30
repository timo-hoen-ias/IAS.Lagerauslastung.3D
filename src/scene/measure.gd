# Messwerkzeug: Kugeln an den Punkten + Linie dazwischen (Bodenebene).
extends Node3D

const POINT_COLOR := Color("#7ec8ff")
const LINE_COLOR := Color("#7ec8ff")


func _ready() -> void:
	visible = false


func set_points(points: Array) -> void:
	for c in get_children():
		c.queue_free()
	if points.is_empty():
		visible = false
		return
	visible = true
	for p: Dictionary in points:
		var mi := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.15
		sm.height = 0.3
		var mat := StandardMaterial3D.new()
		mat.albedo_color = POINT_COLOR
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		sm.material = mat
		mi.mesh = sm
		mi.position = Vector3(p["x"], 0.12, p["z"])
		add_child(mi)
	if points.size() == 2:
		var line := MeshInstance3D.new()
		var im := ImmediateMesh.new()
		im.surface_begin(Mesh.PRIMITIVE_LINES)
		im.surface_add_vertex(Vector3(points[0]["x"], 0.08, points[0]["z"]))
		im.surface_add_vertex(Vector3(points[1]["x"], 0.08, points[1]["z"]))
		im.surface_end()
		line.mesh = im
		var mat := StandardMaterial3D.new()
		mat.albedo_color = LINE_COLOR
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		line.material_override = mat
		add_child(line)
