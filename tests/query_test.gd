extends RefCounted

const WmQuery = preload("res://src/core/query.gd")


static func run(t) -> void:
	_test_group(t)
	_test_attach(t)
	_test_gewicht(t)
	_test_mandant(t)


static func _platz_row(kennung: String, platz_id: int) -> Dictionary:
	return {
		"Mandant": 1,
		"Lagerkennung": kennung,
		"Bezeichnung": "Test",
		"Lagertechnik": "LTD3HR",
		"AnzahlDimension1": 1,
		"AnzahlDimension2": 2,
		"AnzahlDimension3": 3,
		"PlatzID": platz_id,
		"Dimension1": 1,
		"Dimension2": 1,
		"Dimension3": 1,
		"Dimensionsebene": 0,
		"Kurzbezeichnung": "%s;1;1;1" % kennung,
		"Platzbezeichnung": "",
		"Hoehe": 60,
		"Breite": 110,
		"Laenge": 160,
		"Tragkraft": 500,
	}


static func _test_group(t) -> void:
	var rows := [_platz_row("B-ORT", 10), _platz_row("A-ORT", 20)]
	var data := WmQuery.group_lagerorte(rows)
	var orte: Array = data["lagerorte"]
	t.eq(orte.size(), 2, "zwei Orte")
	t.eq(orte[0]["lagerkennung"], "A-ORT", "sortiert A vor B")
	var a: Dictionary = orte[0]
	t.eq((a["plaetze"] as Array).size(), 1, "ein Platz pro Ort")
	t.eq(a["plaetze"][0]["platzId"], 20, "PlatzID uebernommen")
	t.eq(a["plaetze"][0]["masse"]["hoehe"], 60.0, "Maße cm->Zahl")
	t.eq(a["dims"]["d3"], 3.0, "Dimensionen uebernommen")
	t.eq(data["mandant"], 1.0, "Mandant aus erster Zeile")


static func _test_attach(t) -> void:
	var rows := [_platz_row("A-ORT", 1)]
	var data := WmQuery.group_lagerorte(rows)
	var bestand_rows := [
		{"Mandant": 1, "Lagerkennung": "A-ORT", "PlatzID": 1, "Artikelnummer": "100000",
		 "Bezeichnung1": "Schraube", "Matchcode": "", "AuspraegungID": 0, "Eigenmasse": 1,
		 "Lagermengeneinheit": "Stück", "Gewicht": 0, "GewichtLME": 0, "Bestand": 40, "Verfuegbarkeit": 30},
		{"Mandant": 1, "Lagerkennung": "A-ORT", "PlatzID": 1, "Artikelnummer": "100000",
		 "Bezeichnung1": "Schraube", "Matchcode": "", "AuspraegungID": 0, "Eigenmasse": 1,
		 "Lagermengeneinheit": "Stück", "Gewicht": 0, "GewichtLME": 0, "Bestand": 35, "Verfuegbarkeit": 10},
	]
	WmQuery.attach_bestaende(data, bestand_rows)
	var platz: Dictionary = data["lagerorte"][0]["plaetze"][0]
	t.eq((platz["bestaende"] as Array).size(), 1, "Artikel dedupliziert")
	var b: Dictionary = platz["bestaende"][0]
	t.eq(b["bestand"], 75.0, "Bestand summiert")
	t.eq(b["verfuegbarkeit"], 70.0, "Verfuegbarkeit wie TS-Original (Doppelzaehlung erste Zeile)")
	t.eq(b["gewicht"], 1.0, "Fallback auf Eigenmasse")


static func _test_gewicht(t) -> void:
	var r := {"GewichtLME": 0, "Gewicht": 2, "Eigenmasse": 5}
	t.eq(WmQuery.bestand_gewicht(r), 2.0, "Gewicht vor Eigenmasse")
	r["Gewicht"] = 0
	t.eq(WmQuery.bestand_gewicht(r), 5.0, "Eigenmasse als Fallback")
	var r2 := {"GewichtLME": 3, "Gewicht": 2, "Eigenmasse": 5}
	t.eq(WmQuery.bestand_gewicht(r2), 3.0, "GewichtLME gewinnt")


static func _test_mandant(t) -> void:
	var rows := [_platz_row("A-ORT", 1), _platz_row("A-ORT", 2)]
	rows[1]["Mandant"] = 2
	var data := WmQuery.group_lagerorte(rows, 1)
	t.eq((data["lagerorte"][0]["plaetze"] as Array).size(), 1, "Mandant-Filter bei Gruppierung")
