# TargetMarker (Nicht-Ego): Strahl + Ring über dem Regal der Auswahl.
extends Node3D

const BEAM_COLOR := Color(1, 1, 1, 0.3)
const RING_COLOR := Color("#7ec8ff")

var _beam: MeshInstance3D
var _ring: MeshInstance3D
var _elapsed := 0.0


func _ready() -> void:
	visible = false
	_beam = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.05, 2.8, 0.05)
	var bmat := StandardMaterial3D.new()
	bmat.albedo_color = BEAM_COLOR
	bmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bmat.render_priority = 10
	bm.material = bmat
	_beam.mesh = bm
	add_child(_beam)
	_ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.4
	tm.outer_radius = 0.5
	var rmat := StandardMaterial3D.new()
	rmat.albedo_color = RING_COLOR
	rmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rmat.render_priority = 10
	tm.material = rmat
	_ring.mesh = tm
	_ring.rotation_degrees = Vector3(90, 0, 0)
	add_child(_ring)


func show_at(rack_pos: Vector3, height: float) -> void:
	var base := rack_pos + Vector3(0, height + 1.4, 0)
	_beam.position = base + Vector3(0, 1.4, 0)
	_ring.position = base + Vector3(0, 1.7, 0)
	visible = true


func hide_marker() -> void:
	visible = false


func _process(delta: float) -> void:
	if not visible:
		return
	_elapsed += delta
	var p := 0.5 + 0.5 * sin(_elapsed * PI)
	_ring.scale = Vector3.ONE * (1.0 + 0.12 * p)
