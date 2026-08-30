extends RefCounted

const WmArticle = preload("res://src/core/article.gd")
const WmLayout = preload("res://src/core/layout.gd")
const WmTransform = preload("res://src/core/transform.gd")


static func _bestand(nr: String, bez: String, menge: float) -> Dictionary:
	return {"artikelnummer": nr, "bezeichnung1": bez, "matchcode": "", "bestand": menge, "verfuegbarkeit": 0, "gewicht": 0.0}


static func _platz(platz_id: int, bestaende: Array, dim: Dictionary = {"d1": 1, "d2": 1, "d3": 1}) -> Dictionary:
	return {"platzId": platz_id, "dim": dim, "ebene": 0, "kurz": "P%d" % platz_id, "platzbezeichnung": "", "masse": {"hoehe": 60, "breite": 110, "laenge": 160}, "maxGewicht": 500, "bestaende": bestaende}


static func _data() -> Dictionary:
	var kuehl := {"lagerkennung": "KUEHL", "bezeichnung": "Kühl", "lagertechnik": "LTD3HR", "dims": {"d1": 1, "d2": 1, "d3": 1}, "plaetze": [_platz(10, [_bestand("A1", "Eins", 10.0), _bestand("B2", "Zwei", 5.0)])]}
	var lag := {"lagerkennung": "LAG", "bezeichnung": "Lager", "lagertechnik": "LTD3HR", "dims": {"d1": 1, "d2": 1, "d3": 1}, "plaetze": [_platz(1, [_bestand("A1", "Eins", 12.0), _bestand("B2", "Zwei", 3.0)]), _platz(2, [_bestand("C3", "Drei", 7.0)])]}
	return {"mandant": 1.0, "lagerorte": [kuehl, lag]}


static func _rack_ort() -> Dictionary:
	var ort := {"lagerkennung": "RACK", "bezeichnung": "", "lagertechnik": "LTD3HR", "dims": {"d1": 1, "d2": 2, "d3": 2}, "plaetze": [
		_platz(20, [_bestand("C3", "Drei", 2.0)], {"d1": 1, "d2": 1, "d3": 1}),
		_platz(21, [_bestand("A1", "Eins", 4.0)], {"d1": 1, "d2": 1, "d3": 2}),
		_platz(22, [_bestand("B2", "Zwei", 9.0)], {"d1": 1, "d2": 2, "d3": 1}),
	]}
	return ort


static func _placed(ort: Dictionary, origin: Vector3 = Vector3(10, 0, 20)) -> Dictionary:
	var base := {
		"key": "RACK", "ort": ort, "kind": "rack", "gang": 0, "cols": 1, "levels": 2, "depth": 2,
		"flat": false, "cell_h": 0.6, "origin": origin, "size": {"w": 1.0, "h": 1.5, "d": 2.0},
	}
	return WmTransform.apply_transform(base, WmTransform.identity_transform())


static func run(t) -> void:
	_test_alle(t)
	_test_filter(t)
	_test_artikel_plaetze(t)
	_test_platz_ids(t)
	_test_plaetze_mit_artikel(t)
	_test_platz_world(t)
	_test_platz_mit_id(t)
	_test_fmt_menge(t)
	_test_flashes(t)


static func _test_alle(t) -> void:
	var alle := WmArticle.alle_artikel(_data())
	t.eq(alle.size(), 3, "3 Artikel")
	t.eq(alle[0]["artikelnummer"], "A1", "sortiert A1 zuerst")
	t.near(alle[0]["gesamt"], 22.0, 1e-6, "A1 gesamt 10+12")
	t.eq(alle[2]["artikelnummer"], "C3", "C3 letzter")


static func _test_filter(t) -> void:
	var alle := WmArticle.alle_artikel(_data())
	t.eq(WmArticle.filter_artikel(alle, "   ").size(), 0, "Whitespace -> leer")
	var a := WmArticle.filter_artikel(alle, "a")
	t.eq(a.size(), 1, "nur A1 matcht 'a' (Präfix)")
	t.eq(a[0]["artikelnummer"], "A1", "Präfix zuerst")
	var eins := WmArticle.filter_artikel(alle, "eins")
	t.eq(eins.size(), 1, "Bezeichnung 'eins'")
	t.eq(eins[0]["artikelnummer"], "A1", "Treffer A1")
	var ziffer := WmArticle.filter_artikel(alle, "1")
	t.eq(ziffer.size(), 1, "'1' matcht A1")
	t.eq(ziffer[0]["artikelnummer"], "A1", "A1 via Nummer enthält")
	t.eq(WmArticle.filter_artikel(alle, "zzz").size(), 0, "kein Treffer")
	var limit := WmArticle.filter_artikel(alle, "a", 1)
	t.eq(limit.size(), 1, "limit kappt")


static func _test_artikel_plaetze(t) -> void:
	var pl := WmArticle.artikel_lagerplaetze(_data(), "A1")
	t.eq(pl.size(), 2, "A1 auf 2 Plätzen")
	t.eq(pl[0]["ort"]["lagerkennung"], "KUEHL", "KUEHL vor LAG")
	t.eq(pl[1]["ort"]["lagerkennung"], "LAG", "LAG zweiter")
	t.eq(pl[0]["platz"]["platzId"], 10, "Platz 10")
	t.eq(WmArticle.artikel_lagerplaetze(_data(), "XXX").size(), 0, "unbekannt -> leer")


static func _test_platz_ids(t) -> void:
	var plaetze: Array = _data()["lagerorte"][1]["plaetze"]
	var a1 := WmArticle.platz_ids_mit_artikel(plaetze, "A1")
	t.eq(a1, [1], "A1 in LAG nur Platz 1")
	var b2 := WmArticle.platz_ids_mit_artikel(plaetze, "B2")
	t.eq(b2, [1], "B2 in LAG Platz 1")
	t.eq(WmArticle.platz_ids_mit_artikel(plaetze, "").size(), 0, "leer -> leer")


static func _test_plaetze_mit_artikel(t) -> void:
	var placed := _placed(_rack_ort())
	var c3 := WmArticle.plaetze_mit_artikel(placed, "C3")
	t.eq(c3.size(), 1, "C3 in Rack 1 Treffer")
	t.eq(c3[0]["platz"]["platzId"], 20, "Platz 20")
	t.near(c3[0]["bestand"], 2.0, 1e-6, "bestand 2")


static func _test_platz_world(t) -> void:
	var ort := _rack_ort()
	var placed := _placed(ort)
	var platz: Dictionary = ort["plaetze"][0]
	var w := WmArticle.platz_world(placed, WmTransform.identity_transform(), platz)
	# platz 20: dim 1;1;1 -> iy=0, iz=0 -> lx=0, lz=-0.5, ly=0.25+0+0.3=0.55
	t.near(w["x"], 10.0, 1e-6, "x = position.x")
	t.near(w["z"], 19.5, 1e-6, "z = 20 + (-0.5)")
	t.near(w["y"], 0.55, 1e-6, "y = 0.25 + box.h/2")
	t.near(w["w"], 0.95, 1e-6, "w = min(1.1, 0.95)")


static func _test_platz_mit_id(t) -> void:
	var placed := _placed(_rack_ort())
	var hit = WmArticle.platz_mit_id([placed], 22)
	t.ok(hit != null, "Platz 22 gefunden")
	t.eq(hit["platz"]["platzId"], 22, "Platz 22")
	var miss = WmArticle.platz_mit_id([placed], 999)
	t.ok(miss == null, "unbekannt -> null")


static func _test_fmt_menge(t) -> void:
	t.eq(WmArticle.fmt_menge(5.0), "5", "fmtMenge 5")
	t.eq(WmArticle.fmt_menge(5.5), "5.5", "fmtMenge 5.5")
	t.eq(WmArticle.fmt_menge(0.333), "0.33", "fmtMenge 0.333")


static func _test_flashes(t) -> void:
	var placed := _placed(_rack_ort())
	var bu := [{"id": 1, "artikelnummer": "A1", "menge": 2.0, "herkunftPlatzId": 20, "zielPlatzId": 21, "ts": 1000.0}]
	var flashes := WmArticle.booking_flashes([placed], bu, func(_k: String) -> Dictionary:
		return WmTransform.identity_transform()
	)
	t.eq(flashes.size(), 2, "Herkunft + Ziel")
	t.eq(flashes[0]["key"], "1-h", "Herkunft key")
	t.eq(flashes[0]["color"], WmArticle.FLASH_HERKUNFT_COLOR, "Herkunft warm")
	t.eq(flashes[0]["label"], "A1 -2", "Label -2")
	t.eq(flashes[1]["key"], "1-z", "Ziel key")
	t.eq(flashes[1]["color"], WmArticle.FLASH_ZIEL_COLOR, "Ziel grün")
	t.eq(flashes[1]["label"], "A1 +2", "Label +2")
	var bu_miss := [{"id": 2, "artikelnummer": "A1", "menge": 1.0, "herkunftPlatzId": 999, "zielPlatzId": null, "ts": 1000.0}]
	t.eq(WmArticle.booking_flashes([placed], bu_miss, func(_k: String) -> Dictionary:
		return WmTransform.identity_transform()
	).size(), 0, "unbekannte PlatzIds übersprungen")
