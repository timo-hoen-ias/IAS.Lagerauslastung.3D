extends RefCounted

const PerfGen = preload("res://src/core/perf_gen.gd")


static func run(t) -> void:
	_test_determinism(t)
	_test_counts(t)
	_test_mulberry(t)
	_test_bestaende(t)


static func _test_determinism(t) -> void:
	var a := PerfGen.generate_lager_daten(10, 42)
	var b := PerfGen.generate_lager_daten(10, 42)
	t.eq(JSON.stringify(a), JSON.stringify(b), "gleicher Seed -> identische Daten")
	var c := PerfGen.generate_lager_daten(10, 7)
	t.ok(JSON.stringify(a) != JSON.stringify(c), "anderer Seed -> andere Daten")


static func _test_counts(t) -> void:
	var data := PerfGen.generate_lager_daten(10, 42)
	t.eq((data["lagerorte"] as Array).size(), 10, "10 Orte")
	var plaetze := 0
	for ort: Dictionary in data["lagerorte"]:
		plaetze += (ort["plaetze"] as Array).size()
	# 6x Hochregal (4x7x12 + Catch-all), 2x Flaechenlager (4x50 + 1), 2x Freilager (800 + 1)
	t.eq(plaetze, 6 * 337 + 2 * 201 + 2 * 801, "Platzanzahl inkl. Catch-all")
	# Struktur: Orte sortiert
	var kennungen: Array = []
	for ort: Dictionary in data["lagerorte"]:
		kennungen.append(ort["lagerkennung"])
	var sorted := kennungen.duplicate()
	sorted.sort()
	t.eq(kennungen, sorted, "Orte sortiert")
	# Catch-all Platz existiert in jedem Ort mit dim 0;0;0
	for ort: Dictionary in data["lagerorte"]:
		var has_catch_all := false
		for p: Dictionary in ort["plaetze"]:
			if p["dim"]["d1"] == 0 and p["dim"]["d2"] == 0 and p["dim"]["d3"] == 0:
				has_catch_all = true
		t.ok(has_catch_all, "Catch-all in " + str(ort["lagerkennung"]))


static func _test_mulberry(t) -> void:
	var r1 := PerfGen.mulberry32(42)
	var r2 := PerfGen.mulberry32(42)
	var r3 := PerfGen.mulberry32(7)
	var seq_a: Array = []
	var seq_b: Array = []
	for i in range(5):
		var va: float = r1.call()
		var vb: float = r2.call()
		t.ok(va >= 0.0 and va < 1.0, "Werte in [0,1)")
		t.near(va, vb, 1e-12, "gleicher Seed -> gleiche Sequenz")
		seq_a.append(va)
		seq_b.append(r3.call())
	t.ok(seq_a != seq_b, "verschiedene Seeds -> verschiedene Sequenzen")


static func _test_bestaende(t) -> void:
	var data := PerfGen.generate_lager_daten(5, 42)
	var mit_bestand := 0
	var artikel_ok := true
	for ort: Dictionary in data["lagerorte"]:
		for p: Dictionary in ort["plaetze"]:
			if (p["bestaende"] as Array).size() > 0:
				mit_bestand += 1
			for b: Dictionary in p["bestaende"]:
				if str(b["artikelnummer"]) == "" or b["bestand"] <= 0:
					artikel_ok = false
	t.ok(mit_bestand > 0, "es gibt bestandete Plaetze")
	t.ok(artikel_ok, "alle Bestaende haben Artikelnummer und Bestand > 0")
	# Gesamtbestand groesser als einzelner Eintrag -> Aggregation
	var sum := 0.0
	var cnt := 0
	for ort: Dictionary in data["lagerorte"]:
		for p: Dictionary in ort["plaetze"]:
			for b: Dictionary in p["bestaende"]:
				sum += float(b["bestand"])
				cnt += 1
	t.ok(sum > 0 and cnt > 0, "Summe Bestand > 0")
