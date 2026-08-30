# Artikel-Labels auf den Zell-Kisten ("Artikelnummer/Name/Bestand"),
# LOD: Labels werden nur für kamera-nah Regale erzeugt (wie RackLabels.tsx).
extends Node3D

const WmCell = preload("res://src/core/cell.gd")
const WmLayout = preload("res://src/core/layout.gd")

const SHOW_DIST := 40.0
const HIDE_DIST := 55.0

var _placements: Array = []
var _placed: Array = []
var _labels_by_rack := {}


func rebuild(placements: Array, placed: Array) -> void:
	for key: String in _labels_by_rack:
		for l: Label3D in _labels_by_rack[key]:
			l.queue_free()
	_labels_by_rack = {}
	_placements = placements
	_placed = placed


func _process(_delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null or _placements.is_empty():
		return
	for i in range(_placements.size()):
		var p: Dictionary = _placements[i]
		var pp: Dictionary = _placed[i]
		var dist := cam.global_position.distance_to(pp["position"])
		var exists: bool = _labels_by_rack.has(p["key"])
		if not exists and dist < SHOW_DIST:
			_create_rack_labels(p, pp)
		elif exists and dist > HIDE_DIST:
			_free_rack_labels(str(p["key"]))


func _create_rack_labels(p: Dictionary, pp: Dictionary) -> void:
	var rack := {
		"kind": p["kind"], "gang": p["gang"], "cols": p["cols"], "levels": p["levels"],
		"depth": p["depth"], "flat": p["flat"], "cell_h": p["cell_h"],
	}
	var plaetze := WmLayout.gang_plaetze(p["ort"], p["kind"], p["gang"])
	var result := WmCell.cell_segments(plaetze, rack)
	var t := Store.get_transform(p["key"])
	var scale: Dictionary = t["scale"]
	var arr: Array = []
	for label: Dictionary in result["labels"]:
		var l := Label3D.new()
		l.text = str(label["text"])
		l.outline_size = 10
		l.outline_modulate = Color(0, 0, 0, 0.9)
		l.font_size = 64
		# Größe an die Kistenfläche anpassen (wie labelFontSize), etwas lesbarer.
		l.pixel_size = (float(label["font_size"]) * 1.4) / 64.0
		l.modulate = Color(1, 1, 1, 1)
		l.position = _world(label["pos"], pp["position"], pp["rotY"], scale)
		# Text liegt auf der Kistenfläche (Gasse), kein Billboard.
		# Label3D-Vorderseite zeigt +Z -> +x-Seite nach außen = rotY +90°.
		var side := int(label["side"])
		l.rotation_degrees.y = 90.0 if side > 0 else -90.0
		if bool(label["vertical"]):
			l.rotation_degrees.z = 90.0
		add_child(l)
		arr.append(l)
	_labels_by_rack[p["key"]] = arr


func _free_rack_labels(key: String) -> void:
	var arr: Array = _labels_by_rack.get(key, [])
	for l: Label3D in arr:
		l.queue_free()
	_labels_by_rack.erase(key)


func _world(local: Vector3, rack_pos: Vector3, rot: float, scale: Dictionary) -> Vector3:
	var s := Vector3(float(scale["x"]), float(scale["y"]), float(scale["z"]))
	var v := local * s
	var c := cos(rot)
	var sn := sin(rot)
	return rack_pos + Vector3(c * v.x - sn * v.z, v.y, sn * v.x + c * v.z)
