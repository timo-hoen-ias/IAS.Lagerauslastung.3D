extends RefCounted

const WmGew = preload("res://src/core/gew.gd")


static func _platz(gewicht_bestaende: Array, max_gewicht: float = 0.0) -> Dictionary:
	var bestaende: Array = []
	for gb: Array in gewicht_bestaende:
		bestaende.append({"artikelnummer": "X", "bezeichnung1": "", "matchcode": "", "bestand": gb[0], "verfuegbarkeit": 0, "gewicht": gb[1]})
	return {"platzId": 1, "dim": {"d1": 1, "d2": 1, "d3": 1}, "ebene": 0, "kurz": "X", "platzbezeichnung": "", "masse": {"hoehe": 60, "breite": 110, "laenge": 160}, "maxGewicht": max_gewicht, "bestaende": bestaende}


static func run(t) -> void:
	_test_platz(t)
	_test_ort(t)
	_test_fmt(t)


static func _test_platz(t) -> void:
	var p := _platz([[50.0, 0.5], [5.0, 3.0]], 200.0)
	t.near(WmGew.platz_gewicht(p), 40.0, 1e-6, "platzGewicht 50*0.5 + 5*3")
	t.near(WmGew.platz_max_gewicht(p), 200.0, 1e-6, "platzMaxGewicht")
	t.ok(not WmGew.platz_ueberlastet(p), "40kg auf 200kg ok")

	var ueber := _platz([[100.0, 1.0]], 50.0)
	t.ok(WmGew.platz_ueberlastet(ueber), "100kg auf 50kg überlastet")

	var ohne_max := _platz([[100.0, 1.0]], 0.0)
	t.ok(not WmGew.platz_ueberlastet(ohne_max), "max=0 nie überlastet")

	var leer := _platz([])
	t.eq(WmGew.platz_gewicht(leer), 0.0, "leerer Platz 0")


static func _test_ort(t) -> void:
	var ort := {"lagerkennung": "L", "bezeichnung": "", "lagertechnik": "LTD3HR", "dims": {"d1": 1, "d2": 1, "d3": 1}, "plaetze": [_platz([[50.0, 0.5], [5.0, 3.0]], 50.0), _platz([[10.0, 2.0]], 100.0)]}
	t.near(WmGew.ort_gewicht(ort), 40.0 + 20.0, 1e-6, "ortGewicht = 60")
	t.near(WmGew.ort_max_gewicht(ort), 150.0, 1e-6, "ortMaxGewicht = 150")
	t.ok(not WmGew.ort_ueberlastet(ort), "60 auf 150 ok")


static func _test_fmt(t) -> void:
	t.eq(WmGew.fmt_kg(12.34), "12,3 kg", "fmtKg 12.34")
	t.eq(WmGew.fmt_kg(1500.0), "1.500 kg", "fmtKg 1500")
	t.eq(WmGew.fmt_kg(0.0), "0 kg", "fmtKg 0")
