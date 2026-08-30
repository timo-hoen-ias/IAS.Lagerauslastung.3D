extends RefCounted

const WmLayout = preload("res://src/core/layout.gd")


static func _ort(dims: Dictionary, masse: Dictionary = {"hoehe": 60.0, "breite": 110.0, "laenge": 160.0}, platz_dim: Dictionary = {"d1": 1, "d2": 1, "d3": 1}) -> Dictionary:
	var platz := {
		"platzId": 1,
		"dim": platz_dim,
		"ebene": 0,
		"kurz": "X;1;1;1",
		"platzbezeichnung": "",
		"masse": masse,
		"maxGewicht": 500,
		"bestaende": [],
	}
	if platz_dim == {"d1": 0, "d2": 0, "d3": 0}:
		platz["kurz"] = "X;0;0;0"
	return {
		"lagerkennung": "TEST",
		"bezeichnung": "Test",
		"lagertechnik": "LTD3HR",
		"dims": dims,
		"plaetze": [platz],
	}


static func run(t) -> void:
	_test_structure_rack(t)
	_test_structure_row(t)
	_test_structure_line(t)
	_test_catch_all(t)
	_test_cell_pos_rack(t)
	_test_cell_pos_row(t)
	_test_cell_pos_line(t)
	_test_layout_center(t)
	_test_stock_color(t)


static func _test_structure_rack(t) -> void:
	var st := WmLayout.rack_structure(_ort({"d1": 4, "d2": 7, "d3": 12}))
	t.eq(st["kind"], "rack", "Hochregal = rack")
	t.eq(st["count"], 4, "4 Gaenge")
	t.eq(st["levels"], 7, "7 Ebenen")
	t.eq(st["depth"], 12, "12 Facher")
	t.near(st["size"]["h"], 0.25 + 7 * 0.6 + 6 * 0.1 + 0.25, 1e-6, "Hoehe mit BASE/LEVEL_GAP/TOP")
	t.near(st["size"]["d"], 12.0, 1e-6, "Tiefe")


static func _test_structure_row(t) -> void:
	var st := WmLayout.rack_structure(_ort({"d1": 4, "d2": 50, "d3": 0}))
	t.eq(st["kind"], "row", "Flaechenlager = row")
	t.eq(st["count"], 4, "4 Reihen")
	t.eq(st["depth"], 50, "50 Plaetze je Reihe")
	t.ok(st["flat"], "row ist flach")


static func _test_structure_line(t) -> void:
	var st := WmLayout.rack_structure(_ort({"d1": 800, "d2": 0, "d3": 0}))
	t.eq(st["kind"], "line", "Freilager = line")
	t.eq(st["cols"], 800, "800 Bloecke")
	t.ok(st["flat"], "line ist flach")


static func _test_catch_all(t) -> void:
	var ort := _ort({"d1": 4, "d2": 7, "d3": 12}, {"hoehe": 60.0, "breite": 110.0, "laenge": 160.0}, {"d1": 0, "d2": 0, "d3": 0})
	t.ok(WmLayout.is_catch_all(ort["plaetze"][0]), "0;0;0 = Catch-all")


static func _test_cell_pos_rack(t) -> void:
	var ort := _ort({"d1": 4, "d2": 7, "d3": 12}, {"hoehe": 60.0, "breite": 110.0, "laenge": 160.0}, {"d1": 1, "d2": 3, "d3": 5})
	var rack := {"kind": "rack", "gang": 0, "cols": 1, "levels": 7, "depth": 12, "flat": false, "cell_h": 0.6}
	var p := WmLayout.cell_local_position(ort["plaetze"][0], rack)
	t.near(p.x, 0.0, 1e-6, "x mittig")
	t.near(p.y, 0.25 + 2 * (0.6 + 0.1) + 0.6 / 2, 1e-6, "Ebene 3 y")
	t.near(p.z, (5 - 1 - (12 - 1) / 2.0) * 1.0, 1e-6, "Fach 5 z")


static func _test_cell_pos_row(t) -> void:
	var ort := _ort({"d1": 4, "d2": 50, "d3": 0}, {"hoehe": 20.0, "breite": 120.0, "laenge": 120.0}, {"d1": 1, "d2": 10, "d3": 0})
	var rack := {"kind": "row", "gang": 0, "cols": 1, "levels": 1, "depth": 50, "flat": true, "cell_h": 0.2}
	var p := WmLayout.cell_local_position(ort["plaetze"][0], rack)
	t.near(p.y, 0.1, 1e-6, "flach: halbe Zellhoehe")
	t.near(p.z, (10 - 1 - (50 - 1) / 2.0) * 1.0, 1e-6, "Platz 10 z")


static func _test_cell_pos_line(t) -> void:
	var ort := _ort({"d1": 800, "d2": 0, "d3": 0}, {"hoehe": 20.0, "breite": 100.0, "laenge": 200.0}, {"d1": 10, "d2": 0, "d3": 0})
	var rack := {"kind": "line", "gang": 0, "cols": 800, "levels": 1, "depth": 1, "flat": true, "cell_h": 0.2}
	var p := WmLayout.cell_local_position(ort["plaetze"][0], rack)
	t.near(p.x, (10 - 1 - (800 - 1) / 2.0) * 1.0, 1e-6, "Block 10 x")
	t.near(p.z, 0.0, 1e-6, "z mittig")


static func _test_layout_center(t) -> void:
	var orte: Array = []
	for i in range(5):
		var ort := _ort({"d1": 4, "d2": 7, "d3": 12} if i % 5 < 3 else ({"d1": 4, "d2": 50, "d3": 0} if i % 5 == 3 else {"d1": 800, "d2": 0, "d3": 0}))
		ort["lagerkennung"] = "ORT-%d" % i
		orte.append(ort)
	var placements := WmLayout.layout_racks(orte)
	var b := WmLayout.rack_bounds(placements)
	t.eq(placements.size(), 3 * 4 + 4 + 1, "3x4 HR + 4 SF + 1 UF")
	t.near(b["min_x"] + b["max_x"], 0.0, 1e-6, "zentriert auf x=0")
	t.near(b["min_z"] + b["max_z"], 0.0, 1e-6, "zentriert auf z=0")


static func _test_stock_color(t) -> void:
	t.eq(WmLayout.stock_color(0.0, false), WmLayout.COLOR_EMPTY, "leer = grau")
	t.eq(WmLayout.stock_color(50.0, true), WmLayout.COLOR_LOW, "<100 = gruen")
	t.eq(WmLayout.stock_color(50.0, false), WmLayout.COLOR_EMPTY, "ohne Bestand immer grau")
	t.eq(WmLayout.stock_color(200.0, true), WmLayout.COLOR_MID, "100-499 = gelb")
	t.eq(WmLayout.stock_color(500.0, true), WmLayout.COLOR_HIGH, ">=500 = rot")
