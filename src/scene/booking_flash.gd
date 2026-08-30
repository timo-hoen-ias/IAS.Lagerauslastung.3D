# BookingFlash-Marker: Ring + Shell + Strahl + Label für eine Buchung,
# animiert über FLASH_DURATION_MS und entfernt sich selbst.
extends Node3D

const WmArticle = preload("res://src/core/article.gd")
const DURATION_S := 1.5

var _ring: MeshInstance3D
var _shell: MeshInstance3D
var _beam: MeshInstance3D
var _label: Label3D
var _start_s := 0.0
var _base_y := 0.0
var _ring_mat: StandardMaterial3D
var _shell_mat: StandardMaterial3D
var _beam_mat: StandardMaterial3D
var _label_mat: StandardMaterial3D
var _label_base_alpha := 1.0


func setup(w: Dictionary, color: Color, text: String) -> void:
	_start_s = Time.get_ticks_msec() / 1000.0
	_base_y = float(w["y"]) + float(w["h"]) + 0.6

	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.4
	tm.outer_radius = 0.5
	_ring_mat = StandardMaterial3D.new()
	_ring_mat.albedo_color = color
	_ring_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_ring_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_ring_mat.render_priority = 20
	tm.material = _ring_mat
	ring.mesh = tm
	ring.rotation_degrees = Vector3(90, 0, 0)
	ring.position = Vector3(w["x"], _base_y, w["z"])
	add_child(ring)
	_ring = ring

	var shell := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(float(w["w"]) + 0.1, float(w["h"]) + 0.1, float(w["d"]) + 0.1)
	_shell_mat = StandardMaterial3D.new()
	_shell_mat.albedo_color = color
	_shell_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_shell_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_shell_mat.render_priority = 20
	bm.material = _shell_mat
	shell.mesh = bm
	shell.position = Vector3(w["x"], float(w["y"]), w["z"])
	add_child(shell)
	_shell = shell

	var beam_h := float(w["h"]) * 1.2 + 0.6
	var beam := MeshInstance3D.new()
	var bm2 := BoxMesh.new()
	bm2.size = Vector3(0.07, beam_h, 0.07)
	_beam_mat = StandardMaterial3D.new()
	_beam_mat.albedo_color = color
	_beam_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_beam_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_beam_mat.render_priority = 20
	bm2.material = _beam_mat
	beam.mesh = bm2
	beam.position = Vector3(w["x"], float(w["y"]) + float(w["h"]) / 2.0 + beam_h / 2.0, w["z"])
	add_child(beam)
	_beam = beam

	var lbl := Label3D.new()
	lbl.text = text
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.outline_size = 10
	lbl.font_size = 64
	lbl.pixel_size = 0.006
	lbl.outline_modulate = Color(0, 0, 0, 1)
	lbl.modulate = color
	lbl.position = Vector3(w["x"], _base_y, w["z"])
	add_child(lbl)
	_label = lbl


func _process(delta: float) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	var p := clampf((now - _start_s) / DURATION_S, 0.0, 1.0)
	if p >= 1.0:
		queue_free()
		return
	var ramp := minf(1.0, p * 6.0)
	var fade := 1.0 - p
	_ring_mat.albedo_color.a = 0.9 * fade * ramp
	_shell_mat.albedo_color.a = 0.4 * fade * ramp
	_beam_mat.albedo_color.a = 0.35 * fade * ramp
	_ring.scale = Vector3.ONE * (0.35 + p * 2.4)
	_shell.scale = Vector3.ONE * (1.0 + p * 0.5)
	_label.modulate.a = fade * ramp
	_label.position.y = _base_y + p * 0.9
