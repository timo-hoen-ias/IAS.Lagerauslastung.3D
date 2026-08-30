extends RefCounted

const WmBoxes = preload("res://src/core/boxes.gd")


static func run(t) -> void:
	_test_rack_parts(t)
	_test_wall_boxes(t)
	_test_floor_frame(t)


static func _test_rack_parts(t) -> void:
	var parts := WmBoxes.rack_parts({"w": 1.0, "h": 3.5, "d": 5.0}, 3, 0.6)
	var dark: Array = parts["dark"]
	var grey: Array = parts["grey"]
	var top: Array = parts["top"]
	t.eq(dark.size(), 4, "1 Sockel + 3 Böden")
	t.eq(grey.size(), 4, "4 Eckpfosten")
	t.eq(top.size(), 1, "1 Abdeckplatte")
	var sockel: Dictionary = dark[0]
	t.near(sockel["size"].x, 1.3, 1e-6, "Sockel w+0.3")
	t.near(sockel["size"].z, 5.3, 1e-6, "Sockel d+0.3")
	t.near(sockel["size"].y, 0.08, 1e-6, "Sockelhöhe")
	var boden: Dictionary = dark[1]
	t.near(boden["pos"].y, 0.25 + 0.0 * (0.6 + 0.1) - 0.02, 1e-6, "Boden 0 y")
	var boden2: Dictionary = dark[2]
	t.near(boden2["pos"].y, 0.25 + 1.0 * (0.6 + 0.1) - 0.02, 1e-6, "Boden 1 y")
	# Pfosten: postH = h - TOP_H - FRAME_CLEAR
	var post: Dictionary = grey[0]
	t.near(post["size"].y, 3.5 - 0.25 - 0.03, 1e-6, "Pfostenhöhe")


static func _test_wall_boxes(t) -> void:
	var boxes := WmBoxes.wall_boxes({"min_x": 0.0, "max_x": 12.0, "min_z": 0.0, "max_z": 12.0}, 4.0)
	t.eq(boxes.size(), 8 + 20, "8 Streifen + 20 Pfeiler")
	var sill_count := 0
	var pier_count := 0
	for b in boxes:
		if b["pos"].y <= 0.5001:
			sill_count += 1
		if b["size"].y >= 3.999:
			pier_count += 1
	t.eq(sill_count, 4, "4 Brüstungen")
	t.eq(pier_count, 20, "20 Pfeiler (5 je Seite)")
	# Abschluss-Pfeiler bei nicht ganzzahliger Rasterlänge
	var b2 := WmBoxes.wall_boxes({"min_x": 0.0, "max_x": 8.5, "min_z": 0.0, "max_z": 8.5}, 4.0)
	t.eq(b2.size(), 8 + 4 * 4, "8.5m -> 4 Pfeiler je Seite (0,3,6,8.5)")


static func _test_floor_frame(t) -> void:
	var f := WmBoxes.floor_frame_boxes(4.0, 2.0)
	t.eq((f["core"] as Array).size(), 12, "core 12 (4 Linien + 8 Ecken)")
	t.eq((f["halo"] as Array).size(), 12, "halo 12")
	var first: Dictionary = f["core"][0]
	t.near(first["pos"].z, -(2.0 + 0.5) / 2.0, 1e-6, "Randlinie inkl. FRAME_GAP")
