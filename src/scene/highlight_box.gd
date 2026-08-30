# Weißer Kanten-Highlight (12 dünne Boxen) um eine Zelle oder ein Regal.
extends Node3D

const EDGE := 0.04
const ALPHA := 0.9

var _mm: MultiMesh


func _ready() -> void:
	visible = false
	var box := BoxMesh.new()
	box.size = Vector3.ONE
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_colors = true
	_mm.mesh = box
	_mm.instance_count = 12
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.WHITE
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.albedo_color = Color(1, 1, 1, ALPHA)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = _mm
	mi.material_override = mat
	add_child(mi)


func show_cell(w: Dictionary) -> void:
	var x: float = w["x"]
	var y: float = w["y"]
	var z: float = w["z"]
	var ww: float = w["w"]
	var h: float = w["h"]
	var d: float = w["d"]
	var hw := ww / 2.0
	var hh := h / 2.0
	var hd := d / 2.0
	var t: Array = []
	for yy: float in [y - hh, y + hh]:
		t.append(Transform3D(Basis().scaled(Vector3(ww, EDGE, EDGE)), Vector3(x, yy, z - hd)))
		t.append(Transform3D(Basis().scaled(Vector3(ww, EDGE, EDGE)), Vector3(x, yy, z + hd)))
		t.append(Transform3D(Basis().scaled(Vector3(EDGE, EDGE, d)), Vector3(x - hw, yy, z)))
		t.append(Transform3D(Basis().scaled(Vector3(EDGE, EDGE, d)), Vector3(x + hw, yy, z)))
	for cx: float in [x - hw, x + hw]:
		for cz: float in [z - hd, z + hd]:
			t.append(Transform3D(Basis().scaled(Vector3(EDGE, h, EDGE)), Vector3(cx, y, cz)))
	for i in range(12):
		_mm.set_instance_transform(i, t[i])
		_mm.set_instance_color(i, Color.WHITE)
	visible = true


func hide_box() -> void:
	visible = false
