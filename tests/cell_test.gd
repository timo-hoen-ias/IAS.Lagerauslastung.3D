extends RefCounted

const WmCell = preload("res://src/core/cell.gd")
const WmLayout = preload("res://src/core/layout.gd")


static func _bestand(nr: String, name: String, menge: float) -> Dictionary:
	return {"artikelnummer": nr, "bezeichnung1": name, "matchcode": "", "bestand": menge, "verfuegbarkeit": 0, "gewicht": 0.0}


static func _platz(platz_id: int, bestaende: Array, dim: Dictionary = {"d1": 1, "d2": 1, "d3": 1}) -> Dictionary:
	return {"platzId": platz_id, "dim": dim, "ebene": 0, "kurz": "P%d" % platz_id, "platzbezeichnung": "", "masse": {"hoehe": 60, "breite": 110, "laenge": 160}, "maxGewicht": 500, "bestaende": bestaende}


static func _rack() -> Dictionary:
	return {"kind": "rack", "gang": 0, "cols": 1, "levels": 3, "depth": 2, "flat": false, "cell_h": 0.6}


static func run(t) -> void:
	_test_anteile(t)
	_test_farben(t)
	_test_fmt(t)
	_test_segments(t)


static func _test_anteile(t) -> void:
	var a := WmCell.bestand_anteile([_bestand("A1", "Eins", 30.0), _bestand("B2", "Zwei", 10.0)])
	t.eq(a.size(), 2, "2 Anteile")
	t.near(a[0]["anteil"], 0.75, 1e-6, "A 75%")
	t.near(a[1]["anteil"], 0.25, 1e-6, "B 25%")
	t.eq(a[0]["matchcode"], "Eins", "matchcode fallback auf Bezeichnung")
	# bestand <= 0 übersprungen
	var b := WmCell.bestand_anteile([_bestand("A1", "Eins", 5.0), _bestand("B2", "Zwei", 0.0)])
	t.eq(b.size(), 1, "leerer Bestand übersprungen")
	# max 6 + Rest "…"
	var viele: Array = []
	for i in range(8):
		viele.append(_bestand("A%d" % i, "X%d" % i, 10.0))
	var c := WmCell.bestand_anteile(viele)
	t.eq(c.size(), 6, "max 6 Kisten")
	t.eq(c[5]["artikel"], "…", "Rest als …")
	t.near(c[5]["anteil"], 3.0 / 8.0, 1e-6, "Rest-Anteil 3/8")
	# leer
	t.eq(WmCell.bestand_anteile([]).size(), 0, "leer")


static func _test_farben(t) -> void:
	t.eq(WmCell.kisten_farbe(0), Color("#2ecc71"), "kisten_farbe 0")
	t.eq(WmCell.kisten_farbe(12), WmCell.kisten_farbe(0), "zyklisch")


static func _test_fmt(t) -> void:
	t.eq(WmCell.fmt_bestand(42.333), "42.33", "fmt 42.333")
	t.eq(WmCell.fmt_bestand(42.9), "42.9", "fmt 42.9")
	t.eq(WmCell.fmt_bestand(250.0), "250", "fmt 250")
	t.eq(WmCell.box_label("A1", "Schraube", 5.0), "A1\nSchraube\n5", "box_label 3 Zeilen")


static func _test_segments(t) -> void:
	var rack := _rack()
	# leerer Platz -> 1 transparentes Segment
	var leer := WmCell.cell_segments([_platz(1, [])], rack)
	t.eq(leer["segs"].size(), 1, "leer: 1 Segment")
	t.ok(leer["segs"][0]["empty"], "leer: empty=true")
	t.eq(leer["labels"].size(), 0, "leer: keine Labels")
	# einzelner Artikel -> 1 Segment (Bestandsfarbe) + 2 Labels
	var einz := WmCell.cell_segments([_platz(2, [_bestand("A1", "Eins", 50.0)])], rack)
	t.eq(einz["segs"].size(), 1, "einzeln: 1 Segment")
	t.eq(einz["segs"][0]["color"], WmLayout.stock_color(50.0, true), "Bestandsfarbe")
	t.eq(einz["labels"].size(), 2, "einzeln: 2 Labels")
	t.near(einz["labels"][0]["pos"].x, 0.95 / 2.0 + 0.02, 1e-6, "Label +x Seite")
	t.near(einz["labels"][1]["pos"].x, -0.95 / 2.0 - 0.02, 1e-6, "Label -x Seite")
	t.eq(einz["labels"][0]["text"], "A1\nEins\n50", "Label-Text")
	# mehrere Artikel -> Segmente prozentual entlang x
	var multi := WmCell.cell_segments([_platz(3, [_bestand("A1", "Eins", 30.0), _bestand("B2", "Zwei", 10.0)])], rack)
	t.eq(multi["segs"].size(), 2, "multi: 2 Segmente")
	var box_w := 0.95
	var gesamt_w := box_w - 0.05
	t.near(multi["segs"][0]["size"].x, 0.75 * gesamt_w, 1e-6, "Segment A Breite 75%")
	t.near(multi["segs"][1]["size"].x, 0.25 * gesamt_w, 1e-6, "Segment B Breite 25%")
	t.eq(multi["segs"][0]["color"], WmCell.kisten_farbe(0), "Farbe A")
	t.eq(multi["segs"][1]["color"], WmCell.kisten_farbe(1), "Farbe B")
	t.near(multi["segs"][0]["pos"].x, -0.475 + 0.3375, 1e-6, "Segment A Mitte")
	t.near(multi["segs"][1]["pos"].x, 0.25 + 0.1125, 1e-6, "Segment B Mitte")
	t.eq(multi["labels"].size(), 2, "multi: 2 Labels (je Segment außen)")
	t.eq(multi["labels"][0]["side"], -1, "Segment A Label zeigt nach außen (-x)")
	t.eq(multi["labels"][1]["side"], 1, "Segment B Label zeigt nach außen (+x)")
	t.near(multi["labels"][0]["pos"].x, -0.495, 1e-6, "Segment A Label auf linker Kante")
	t.near(multi["labels"][1]["pos"].x, 0.495, 1e-6, "Segment B Label auf rechter Kante")
