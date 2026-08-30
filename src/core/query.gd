# Port von src/server/query.ts — Gruppierung der SQL-Zeilen (Ort -> Platz -> Bestaende).
# Erwartet Zeilen im Shape von PLAETZE_SQL bzw. LAGER_SQL (auch perf-Generator).
class_name WmQuery
extends RefCounted

static func num(v: Variant) -> float:
	if typeof(v) == TYPE_INT or typeof(v) == TYPE_FLOAT:
		return float(v)
	if v == null:
		return 0.0
	var s := str(v).strip_edges()
	if s.is_valid_float():
		return float(s)
	return 0.0

static func str_(v: Variant) -> String:
	if v == null:
		return ""
	return str(v).strip_edges()

static func to_float(v: Variant) -> float:
	return num(v)

static func group_lagerorte(rows: Array, mandant: Variant = null) -> Dictionary:
	var lagerorte := {}
	var mandant_v: Variant = null
	if mandant != null:
		mandant_v = num(mandant)
	for r: Dictionary in rows:
		if mandant_v != null and num(r.get("Mandant")) != mandant_v:
			continue
		var kennung: String = str_(r.get("Lagerkennung"))
		var ort_key := "%s|%s" % [str_(r.get("Mandant")), kennung]
		var ort: Dictionary = lagerorte.get(ort_key, {})
		if ort.is_empty():
			ort = {
				"lagerkennung": kennung,
				"bezeichnung": str_(r.get("Bezeichnung")),
				"lagertechnik": str_(r.get("Lagertechnik")),
				"dims": {
					"d1": num(r.get("AnzahlDimension1")),
					"d2": num(r.get("AnzahlDimension2")),
					"d3": num(r.get("AnzahlDimension3")),
				},
				"plaetze": [],
			}
			lagerorte[ort_key] = ort
		ort["plaetze"].append({
			"platzId": int(num(r.get("PlatzID"))),
			"dim": {
				"d1": num(r.get("Dimension1")),
				"d2": num(r.get("Dimension2")),
				"d3": num(r.get("Dimension3")),
			},
			"ebene": num(r.get("Dimensionsebene")),
			"kurz": str_(r.get("Kurzbezeichnung")),
			"platzbezeichnung": str_(r.get("Platzbezeichnung")),
			"masse": {
				"hoehe": num(r.get("Hoehe")),
				"breite": num(r.get("Breite")),
				"laenge": num(r.get("Laenge")),
			},
			"maxGewicht": num(r.get("Tragkraft")),
			"bestaende": [],
		})
	var orte: Array = []
	for k: String in lagerorte:
		orte.append(lagerorte[k])
	orte.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return a["lagerkennung"] < b["lagerkennung"]
	)
	var mandant_out := 0.0
	if not rows.is_empty():
		mandant_out = num((rows[0] as Dictionary).get("Mandant"))
	return {"mandant": mandant_out, "lagerorte": orte}

# Gewicht je Lagermengeneinheit: GewichtLME vor Gewicht vor Eigenmasse.
static func bestand_gewicht(r: Dictionary) -> float:
	var gewicht_lme := num(r.get("GewichtLME"))
	if gewicht_lme > 0.0:
		return gewicht_lme
	var gewicht := num(r.get("Gewicht"))
	if gewicht > 0.0:
		return gewicht
	return num(r.get("Eigenmasse"))

static func attach_bestaende(data: Dictionary, rows: Array, mandant: Variant = null) -> void:
	var by_platz := {}
	for ort: Dictionary in data["lagerorte"]:
		for platz: Dictionary in ort["plaetze"]:
			by_platz["%s|%d" % [ort["lagerkennung"], int(platz["platzId"])]] = platz
	var je_artikel := {}
	var mandant_v: Variant = null
	if mandant != null:
		mandant_v = num(mandant)
	for r: Dictionary in rows:
		if mandant_v != null and num(r.get("Mandant")) != mandant_v:
			continue
		var platz: Dictionary = by_platz.get(
			"%s|%d" % [str_(r.get("Lagerkennung")), int(num(r.get("PlatzID")))],
			{},
		)
		if platz.is_empty():
			continue
		var platz_id: int = platz["platzId"]
		var artikel: Dictionary = je_artikel.get(platz_id, {})
		if artikel.is_empty():
			artikel = {}
			je_artikel[platz_id] = artikel
		var art_nr: String = str_(r.get("Artikelnummer"))
		var eintrag: Dictionary = artikel.get(art_nr, {})
		if eintrag.is_empty():
			eintrag = {
				"artikelnummer": art_nr,
				"bezeichnung1": str_(r.get("Bezeichnung1")),
				"matchcode": str_(r.get("Matchcode")),
				"bestand": 0,
				"verfuegbarkeit": num(r.get("Verfuegbarkeit")),
				"gewicht": bestand_gewicht(r),
			}
			artikel[art_nr] = eintrag
			platz["bestaende"].append(eintrag)
		eintrag["bestand"] += num(r.get("Bestand"))
		# Hinweis: verfuegbarkeit wird wie im TS-Original (query.ts) beim Anlegen
		# initialisiert UND anschließend addiert -> Doppelzaehlung der 1. Zeile.
		# Bewusst beibehalten, damit Offline-Daten identisch zum Server sind.
		eintrag["verfuegbarkeit"] += num(r.get("Verfuegbarkeit"))
		var g := bestand_gewicht(r)
		if g > 0.0:
			eintrag["gewicht"] = g
