# Port von src/app/article.ts — Artikelsuche, Platz-Lookups, Buchungs-Flashes.
class_name WmArticle
extends RefCounted

const WmLayout = preload("res://src/core/layout.gd")

const FLASH_HERKUNFT_COLOR := Color("#ff9f43")
const FLASH_ZIEL_COLOR := Color("#2ecc71")
const FLASH_DURATION_MS := 1500.0


static func alle_artikel(data: Dictionary) -> Array:
	var by_nr := {}
	for ort: Dictionary in data["lagerorte"]:
		for p: Dictionary in ort["plaetze"]:
			for b: Dictionary in p["bestaende"]:
				var nr: String = b["artikelnummer"]
				var e: Dictionary = by_nr.get(nr, {})
				if e.is_empty():
					e = {"artikelnummer": nr, "bezeichnung1": b["bezeichnung1"], "gesamt": 0.0}
					by_nr[nr] = e
				e["gesamt"] += float(b["bestand"])
				if str(e["bezeichnung1"]) == "":
					e["bezeichnung1"] = b["bezeichnung1"]
	var out: Array = []
	for nr: String in by_nr:
		out.append(by_nr[nr])
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		return str(a["artikelnummer"]) < str(b["artikelnummer"])
	)
	return out


static func filter_artikel(liste: Array, query: String, limit: int = 20) -> Array:
	var q := query.strip_edges().to_lower()
	if q.is_empty():
		return []
	var treffer: Array = []
	for a: Dictionary in liste:
		var nr := str(a["artikelnummer"]).to_lower()
		var bez := str(a["bezeichnung1"]).to_lower()
		if nr.contains(q) or bez.contains(q):
			treffer.append({"prefix": nr.begins_with(q), "artikelnummer": a["artikelnummer"], "bezeichnung1": a["bezeichnung1"], "gesamt": a["gesamt"]})
	treffer.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if a["prefix"] != b["prefix"]:
			return a["prefix"]
		if str(a["artikelnummer"]) != str(b["artikelnummer"]):
			return str(a["artikelnummer"]) < str(b["artikelnummer"])
		return str(a["bezeichnung1"]) < str(b["bezeichnung1"])
	)
	return treffer.slice(0, limit)


static func artikel_lagerplaetze(data: Dictionary, artikelnummer: String) -> Array:
	var out: Array = []
	for ort: Dictionary in data["lagerorte"]:
		for p: Dictionary in ort["plaetze"]:
			for b: Dictionary in p["bestaende"]:
				if str(b["artikelnummer"]) == artikelnummer:
					out.append({"ort": ort, "platz": p, "bestand": b["bestand"]})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if str(a["ort"]["lagerkennung"]) != str(b["ort"]["lagerkennung"]):
			return str(a["ort"]["lagerkennung"]) < str(b["ort"]["lagerkennung"])
		return int(a["platz"]["platzId"]) < int(b["platz"]["platzId"])
	)
	return out


static func platz_ids_mit_artikel(plaetze: Array, artikelnummer: String) -> Array:
	var out: Array = []
	if artikelnummer == "":
		return out
	for p: Dictionary in plaetze:
		for b: Dictionary in p["bestaende"]:
			if str(b["artikelnummer"]) == artikelnummer:
				out.append(p["platzId"])
				break
	return out


static func plaetze_mit_artikel(placed_rack: Dictionary, artikelnummer: String) -> Array:
	var out: Array = []
	for p: Dictionary in WmLayout.gang_plaetze(placed_rack["ort"], placed_rack["kind"], placed_rack["gang"]):
		for b: Dictionary in p["bestaende"]:
			if str(b["artikelnummer"]) == artikelnummer:
				out.append({"platz": p, "bestand": b["bestand"]})
				break
	return out


static func platz_world(placed: Dictionary, t: Dictionary, platz: Dictionary) -> Dictionary:
	var box := WmLayout.cell_size(platz)
	var local: Vector3 = WmLayout.cell_local_position(platz, placed)
	var pos: Vector3 = placed["position"]
	var scale: Dictionary = t["scale"]
	var c := cos(float(placed["rotY"]))
	var sn := sin(float(placed["rotY"]))
	var x := pos.x + c * local.x * float(scale["x"]) - sn * local.z * float(scale["z"])
	var z := pos.z + sn * local.x * float(scale["x"]) + c * local.z * float(scale["z"])
	return {
		"x": x,
		"y": local.y * float(scale["y"]),
		"z": z,
		"w": float(box["w"]) * float(scale["x"]),
		"d": float(box["d"]) * float(scale["z"]),
		"h": float(box["h"]) * float(scale["y"]),
	}


static func platz_mit_id(racks: Array, platz_id: int) -> Variant:
	for r: Dictionary in racks:
		for p: Dictionary in WmLayout.gang_plaetze(r["ort"], r["kind"], r["gang"]):
			if int(p["platzId"]) == platz_id:
				return {"rack": r, "platz": p}
	return null


static func fmt_menge(menge: float) -> String:
	if is_equal_approx(menge, round(menge)):
		return str(int(round(menge)))
	var s := "%.2f" % menge
	s = s.trim_suffix("0")
	if s.ends_with("."):
		s = s.trim_suffix(".")
	return s


static func booking_flashes(racks: Array, buchungen: Array, transform_of: Callable) -> Array:
	var out: Array = []
	for b: Dictionary in buchungen:
		var menge := fmt_menge(float(b.get("menge", 0.0)))
		var art_nr: String = str(b.get("artikelnummer", ""))
		if b.get("herkunftPlatzId", null) != null:
			var hit = platz_mit_id(racks, int(b["herkunftPlatzId"]))
			if hit != null:
				out.append({
					"key": "%s-h" % str(b["id"]),
					"w": platz_world(hit["rack"], transform_of.call(hit["rack"]["key"]), hit["platz"]),
					"start": float(b.get("ts", 0.0)),
					"color": FLASH_HERKUNFT_COLOR,
					"label": "%s -%s" % [art_nr, menge],
				})
		if b.get("zielPlatzId", null) != null:
			var hit = platz_mit_id(racks, int(b["zielPlatzId"]))
			if hit != null:
				out.append({
					"key": "%s-z" % str(b["id"]),
					"w": platz_world(hit["rack"], transform_of.call(hit["rack"]["key"]), hit["platz"]),
					"start": float(b.get("ts", 0.0)),
					"color": FLASH_ZIEL_COLOR,
					"label": "%s +%s" % [art_nr, menge],
				})
	return out
