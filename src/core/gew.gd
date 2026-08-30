# Port von src/app/gew.ts — Gewichte, Überlastung, kg-Format.
class_name WmGew
extends RefCounted


static func platz_gewicht(platz: Dictionary) -> float:
	var s := 0.0
	for b: Dictionary in platz["bestaende"]:
		s += float(b["bestand"]) * float(b["gewicht"])
	return s


static func platz_max_gewicht(platz: Dictionary) -> float:
	return float(platz["maxGewicht"])


static func platz_ueberlastet(platz: Dictionary) -> bool:
	var max := platz_max_gewicht(platz)
	return max > 0.0 and platz_gewicht(platz) > max


static func ort_gewicht(ort: Dictionary) -> float:
	var s := 0.0
	for p: Dictionary in ort["plaetze"]:
		s += platz_gewicht(p)
	return s


static func ort_max_gewicht(ort: Dictionary) -> float:
	var s := 0.0
	for p: Dictionary in ort["plaetze"]:
		s += platz_max_gewicht(p)
	return s


static func ort_ueberlastet(ort: Dictionary) -> bool:
	var max := ort_max_gewicht(ort)
	return max > 0.0 and ort_gewicht(ort) > max


static func fmt_kg(n: float) -> String:
	return _de_format(n, 1) + " kg"


# de-DE Ganzzahl mit Tausendertrenner.
static func fmt_de(n: float) -> String:
	return _de_format(n, 0)


# de-DE: Komma als Dezimaltrenner, Punkt als Tausendertrenner.
static func _de_format(n: float, decimals: int) -> String:
	var neg := n < 0.0
	var v := absf(n)
	var factor := pow(10.0, decimals)
	var rounded: float = round(v * factor) / factor
	var int_part := int(floor(rounded))
	var frac := int(round((rounded - float(int_part)) * factor))
	var int_str := str(int_part)
	var out := ""
	var cnt := 0
	for i in range(int_str.length() - 1, -1, -1):
		out = int_str[i] + out
		cnt += 1
		if cnt % 3 == 0 and i > 0:
			out = "." + out
	if decimals > 0 and frac != 0:
		out += ",%s" % str(frac).pad_zeros(decimals)
	return ("-" if neg else "") + out
