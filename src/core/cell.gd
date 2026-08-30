# Port von src/app/scene/Cell.tsx — Kisten-Anteile, Segment-Farben, Box-Labels.
class_name WmCell
extends RefCounted

const WmLayout = preload("res://src/core/layout.gd")

const KISTEN_FARBEN := [
	Color("#2ecc71"), Color("#e74c3c"), Color("#e6b93c"), Color("#3498db"),
	Color("#9b59b6"), Color("#e67e22"), Color("#1abc9c"), Color("#ecf0f1"),
	Color("#f39c12"), Color("#00bcd4"), Color("#c0392b"), Color("#27ae60"),
]
const REST_FARBE := Color("#8b95a3")
const MIN_FONT := 0.035
const MAX_FONT := 0.09


static func kisten_farbe(i: int) -> Color:
	return KISTEN_FARBEN[i % KISTEN_FARBEN.size()]


# Teilt die Bestände eines Platzes in Kisten-Anteile (nach Menge).
# Überspringt Bestand <= 0, kappt bei max_kisten (Rest als "…").
static func bestand_anteile(bestaende: Array, max_kisten: int = 6) -> Array:
	var aktiv: Array = []
	for b: Dictionary in bestaende:
		if float(b["bestand"]) > 0.0:
			aktiv.append(b)
	if aktiv.is_empty():
		return []
	var gesamt := 0.0
	for b: Dictionary in aktiv:
		gesamt += float(b["bestand"])
	if gesamt <= 0.0:
		return []
	var anteile: Array = []
	for b: Dictionary in aktiv:
		anteile.append({
			"artikel": b["artikelnummer"],
			"matchcode": str(b["matchcode"]) if str(b["matchcode"]) != "" else str(b["bezeichnung1"]),
			"bestand": b["bestand"],
			"anteil": float(b["bestand"]) / gesamt,
		})
	if anteile.size() <= max_kisten:
		return anteile
	var top := anteile.slice(0, max_kisten - 1)
	var rest := anteile.slice(max_kisten - 1)
	var rest_summe := 0.0
	var rest_bestand := 0.0
	for a: Dictionary in rest:
		rest_summe += float(a["anteil"])
		rest_bestand += float(a["bestand"])
	top.append({"artikel": "…", "matchcode": "", "bestand": rest_bestand, "anteil": rest_summe})
	return top


# Bestand kompakt gerundet: 42.333 -> "42.33", 42.9 -> "42.9", 250 -> "250".
static func fmt_bestand(n: float) -> String:
	if is_equal_approx(n, round(n)):
		return str(int(round(n)))
	var s := "%.2f" % n
	s = s.trim_suffix("0")
	if s.ends_with("."):
		s = s.trim_suffix(".")
	return s


# Label-Text einer Artikelschachtel: Artikelnummer / Name / Bestand je Zeile.
static func box_label(artikelnummer: String, name: String, bestand: float) -> String:
	return "%s\n%s\n%s" % [artikelnummer, name, fmt_bestand(bestand)]


static func label_vertical(face_w: float, face_h: float, min_w: float = 0.4) -> bool:
	return face_h > face_w or face_w < min_w


static func label_font_size(text_len: int, face_w: float) -> float:
	if text_len <= 0 or face_w <= 0:
		return MAX_FONT
	return clampf(face_w / (float(text_len) * 0.55), MIN_FONT, MAX_FONT)


# Zerlegt die Plätze eines Regals in Segment-Instanzen + Labels (pure).
# Einzelbox: 1 Segment (Bestandsfarbe), Mehrfach: Segment je Anteil (kisten_farbe).
static func cell_segments(plaetze: Array, rack: Dictionary) -> Dictionary:
	const GAP := 0.05
	var segs: Array = []
	var labels: Array = []
	var add_label := func(platz_id: int, box: Dictionary, c: Vector3, x: float, side: int, text: String) -> void:
		var vertical := label_vertical(float(box["d"]), float(box["h"]))
		var line_w := 0
		for line: String in text.split("\n"):
			line_w = maxi(line_w, line.length())
		labels.append({
			"platz_id": platz_id,
			"pos": Vector3(c.x + x, c.y, c.z),
			"text": text,
			"side": side,
			"vertical": vertical,
			"font_size": label_font_size(line_w, float(box["h"]) if vertical else float(box["d"])),
		})
	for platz: Dictionary in plaetze:
		var box := WmLayout.cell_size(platz)
		var c: Vector3 = WmLayout.cell_local_position(platz, rack)
		var anteile := bestand_anteile(platz["bestaende"])
		var leer: bool = (platz["bestaende"] as Array).is_empty()
		var platz_id: int = platz["platzId"]
		if leer:
			segs.append({
				"platz_id": platz_id, "pos": c, "size": Vector3(box["w"], box["h"], box["d"]),
				"color": WmLayout.COLOR_EMPTY, "empty": true,
			})
			continue
		if anteile.size() <= 1:
			var a: Dictionary = anteile[0]
			var total := float(a["bestand"])
			segs.append({
				"platz_id": platz_id, "pos": c, "size": Vector3(box["w"], box["h"], box["d"]),
				"color": WmLayout.stock_color(total, true), "empty": false,
			})
			var label := box_label(str(a["artikel"]), str(a["matchcode"]), total)
			add_label.call(platz_id, box, c, float(box["w"]) / 2.0 + 0.02, 1, label)
			add_label.call(platz_id, box, c, -float(box["w"]) / 2.0 - 0.02, -1, label)
			continue
		var gesamt_w := float(box["w"]) - GAP * (anteile.size() - 1)
		var lauf_x := -float(box["w"]) / 2.0
		for i in range(anteile.size()):
			var a: Dictionary = anteile[i]
			var seg_w := maxf(0.02, float(a["anteil"]) * gesamt_w)
			var seg_x := lauf_x + seg_w / 2.0
			lauf_x += seg_w + GAP
			var farbe: Color = REST_FARBE if str(a["artikel"]) == "…" else kisten_farbe(i)
			segs.append({
				"platz_id": platz_id, "pos": Vector3(c.x + seg_x, c.y, c.z), "size": Vector3(seg_w, box["h"], box["d"]),
				"color": farbe, "empty": false,
			})
			# Label jeder Kiste nach außen: linke Hälfte -> -x, rechte Hälfte -> +x.
			var side := 1
			var label_x: float
			if seg_x < 0.0:
				side = -1
				label_x = seg_x - seg_w / 2.0 - 0.02
			else:
				side = 1
				label_x = seg_x + seg_w / 2.0 + 0.02
			add_label.call(platz_id, box, c, label_x, side, box_label(str(a["artikel"]), str(a["matchcode"]), float(a["bestand"])))
	return {"segs": segs, "labels": labels}
