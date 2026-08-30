extends RefCounted

const WmTransform = preload("res://src/core/transform.gd")


static func _placed(key: String = "A", origin: Vector3 = Vector3(10, 0, 20), size: Dictionary = {"w": 1.0, "h": 3.0, "d": 5.0}) -> Dictionary:
	return {
		"key": key, "kind": "rack", "gang": 0, "cols": 1, "levels": 3, "depth": 2,
		"flat": false, "cell_h": 0.6, "origin": origin, "size": size,
	}


static func run(t) -> void:
	_test_snap(t)
	_test_move_rotate(t)
	_test_scale(t)
	_test_apply(t)
	_test_aabb(t)
	_test_bounds(t)
	_test_dist(t)


static func _test_snap(t) -> void:
	t.eq(WmTransform.snap45(89.0), 90.0, "snap45 89 -> 90")
	t.eq(WmTransform.snap45(46.0), 45.0, "snap45 46 -> 45")
	t.eq(WmTransform.snap45(-44.0), -45.0, "snap45 -44 -> -45")
	t.eq(WmTransform.round05(1.3), 1.5, "round05 1.3 -> 1.5")
	t.eq(WmTransform.round05(0.24), 0.0, "round05 0.24 -> 0")
	t.eq(WmTransform.clamp_scale(3.0), 2.0, "clamp oben")
	t.eq(WmTransform.clamp_scale(0.1), 0.5, "clamp unten")
	t.eq(WmTransform.clamp_scale(1.0), 1.0, "clamp neutral")


static func _test_move_rotate(t) -> void:
	var id := WmTransform.identity_transform()
	var base := {"x": 2.4, "z": -1.6, "rotY": 0.0, "scale": {"x": 1.0, "y": 1.0, "z": 1.0}}
	var m := WmTransform.move_rack(base, 1.0, 0.0)
	t.eq(m["x"], 3.0, "moveRack 2.4+1 -> 3")
	t.eq(m["z"], -2.0, "moveRack -1.6 -> -2")
	t.eq(id["x"], 0.0, "moveRack verändert nicht das Original")

	var r := WmTransform.rotate_rack(id, 50.0)
	t.near(float(r["rotY"]) * 180.0 / PI, 45.0, 1e-6, "rotateRack +50 -> 45°")
	var r2 := WmTransform.rotate_rack(id, 95.0)
	t.near(float(r2["rotY"]) * 180.0 / PI, 90.0, 1e-6, "rotateRack +95 -> 90°")

	# Oszillations-Regression: gleiche Weltposition -> gleiches Ergebnis
	var a := WmTransform.snapped_move(id, 0.0, 0.0, 12.6, 8.2, 1.0, 0.5)
	var b := WmTransform.snapped_move(id, 0.0, 0.0, 12.6, 8.2, 1.0, 0.5)
	t.eq(a, b, "snappedMove deterministisch")
	t.eq(a["x"], WmTransform.snap1(12.6 - 1.0), "snappedMove x")
	t.eq(a["z"], WmTransform.snap1(8.2 - 0.5), "snappedMove z")


static func _test_scale(t) -> void:
	var id := WmTransform.identity_transform()
	var s := WmTransform.scale_rack(id, 1.3)
	t.eq(s["scale"], {"x": 1.5, "y": 1.5, "z": 1.5}, "scaleRack 1.3 -> 1.5 uniform")
	var s2 := WmTransform.scale_rack(id, 5.0)
	t.eq(s2["scale"]["x"], 2.0, "scaleRack 5 -> 2")

	var r := WmTransform.resize_rack(id, "x", 1.3)
	t.eq(r["scale"]["x"], 1.5, "resizeRack x 1.3 -> 1.5")
	t.eq(r["scale"]["y"], 1.0, "resizeRack y unverändert")

	var e := WmTransform.resize_rack_exact(id, "y", 1.37)
	t.near(e["scale"]["y"], 1.37, 1e-6, "resizeRackExact 1.37 bleibt")
	t.eq(WmTransform.resize_rack_exact(id, "y", 5.0)["scale"]["y"], 2.0, "resizeRackExact 5 -> 2")

	t.near(WmTransform.resize_factor(1.0, 1.8, 0.35), 1.5, 1e-6, "resizeFactor (1.8-0.35)/1 -> 1.5")
	t.near(WmTransform.resize_factor(1.0, -1.8, 0.35), 1.5, 1e-6, "resizeFactor symmetrisch negativ")
	t.eq(WmTransform.resize_factor(1.0, 0.1, 0.35), 0.5, "resizeFactor unter 0 -> 0.5")
	t.near(WmTransform.resize_height_factor(2.0, 3.0, 0.0), 1.5, 1e-6, "resizeHeightFactor")
	t.eq(WmTransform.resize_height_factor(2.0, 5.0, 0.0), 2.0, "resizeHeightFactor clamp")
	t.near(WmTransform.resize_height(2.0, 3.0, 0.0), 1.5, 1e-6, "resizeHeight")


static func _test_apply(t) -> void:
	var base := _placed()
	var id := WmTransform.identity_transform()
	var p := WmTransform.apply_transform(base, id)
	t.eq(p["position"], Vector3(10, 0, 20), "identisch: Position aus origin")
	t.eq(p["size"], base["size"], "identisch: Größe unverändert")

	var t2 := {"x": 3.0, "z": -2.0, "rotY": 0.0, "scale": {"x": 2.0, "y": 1.0, "z": 0.5}}
	var p2 := WmTransform.apply_transform(base, t2)
	t.eq(p2["position"], Vector3(13, 0, 18), "Position = origin + t")
	t.near(p2["size"]["w"], 2.0, 1e-6, "w skaliert")
	t.near(p2["size"]["d"], 2.5, 1e-6, "d skaliert")


static func _test_aabb(t) -> void:
	var p0 := WmTransform.apply_transform(_placed("A", Vector3(0, 0, 0), {"w": 2.0, "h": 1.0, "d": 4.0}), WmTransform.identity_transform())
	var b := WmTransform.rack_aabb(p0)
	t.near(b["min_x"], -1.0, 1e-6, "AABB 0° x")
	t.near(b["max_z"], 2.0, 1e-6, "AABB 0° z")

	var p90 := WmTransform.apply_transform(_placed("A", Vector3(0, 0, 0), {"w": 2.0, "h": 1.0, "d": 4.0}), {"x": 0.0, "z": 0.0, "rotY": PI / 2.0, "scale": {"x": 1.0, "y": 1.0, "z": 1.0}})
	var b90 := WmTransform.rack_aabb(p90)
	t.near(b90["max_x"], 2.0, 1e-6, "AABB 90° vertauscht w/d")


static func _test_bounds(t) -> void:
	t.eq(WmTransform.rack_bounds([]), {}, "leer -> leer")
	var racks := [
		WmTransform.apply_transform(_placed("A", Vector3(0, 0, 0), {"w": 2.0, "h": 1.0, "d": 2.0}), WmTransform.identity_transform()),
		WmTransform.apply_transform(_placed("B", Vector3(10, 0, 10), {"w": 2.0, "h": 1.0, "d": 2.0}), WmTransform.identity_transform()),
	]
	var b := WmTransform.rack_bounds(racks, 4.0)
	t.near(b["min_x"], -1.0 - 4.0, 1e-6, "bounds min_x + margin")
	t.near(b["max_x"], 11.0 + 4.0, 1e-6, "bounds max_x + margin")


static func _test_dist(t) -> void:
	t.near(WmTransform.dist2d({"x": 0.0, "z": 0.0}, {"x": 3.0, "z": 4.0}), 5.0, 1e-6, "dist2d 3-4-5")
