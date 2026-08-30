# Zentraler App-Store (Port von store.tsx + localStorage). Zustand + Persistenz.
extends Node

signal transforms_changed
signal selection_changed
signal selected_rack_changed
signal selected_article_changed
signal transform_mode_changed
signal drag_active_changed
signal measure_changed
signal buchungen_changed

const TRANSFORM_FILE := "user://wm-rack-transforms-v2.json"
const BUCHUNG_STORE_MS := 10_000

var _transforms := {}
var _selection = null
var _selected_rack: String = ""
var _selected_article: String = ""
var _transform_mode := "translate"
var _drag_active := false
var _measure_points: Array = []
var _buchungen: Array = []
var _buchung_seq := 0


func _ready() -> void:
	_load_transforms()


# ---- Regal-Transformationen (persistiert) ----------------------------------

func get_transform(key: String) -> Dictionary:
	return _transforms.get(key, WmTransform.identity_transform())


func set_transform(key: String, t: Dictionary) -> void:
	_transforms[key] = t
	_save_transforms()
	transforms_changed.emit()


func reset_transform(key: String) -> void:
	_transforms.erase(key)
	_save_transforms()
	transforms_changed.emit()


func all_transforms() -> Dictionary:
	return _transforms


func effective_racks(placements: Array) -> Array:
	var out: Array = []
	for p: Dictionary in placements:
		out.append(WmTransform.apply_transform(p, get_transform(p["key"])))
	return out


static func _num(v: Variant) -> float:
	return float(v) if v is float or v is int else 0.0


static func _normalize_scale(v: Variant) -> Dictionary:
	if v is Dictionary:
		var d: Dictionary = v
		return {
			"x": WmTransform.clamp_scale(_num(d.get("x", 1.0))),
			"y": WmTransform.clamp_scale(_num(d.get("y", 1.0))),
			"z": WmTransform.clamp_scale(_num(d.get("z", 1.0))),
		}
	if v is float or v is int:
		var s := WmTransform.clamp_scale(_num(v))
		return {"x": s, "y": s, "z": s}
	return {"x": 1.0, "y": 1.0, "z": 1.0}


func _load_transforms() -> void:
	var f := FileAccess.open(TRANSFORM_FILE, FileAccess.READ)
	if f == null:
		return
	var json := JSON.new()
	if json.parse(f.get_as_text()) != OK:
		return
	var raw: Dictionary = json.data
	for key: String in raw:
		var v: Dictionary = raw[key]
		_transforms[key] = {
			"x": _num(v.get("x")),
			"z": _num(v.get("z")),
			"rotY": _num(v.get("rotY")),
			"scale": _normalize_scale(v.get("scale")),
		}


func _save_transforms() -> void:
	var f := FileAccess.open(TRANSFORM_FILE, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(_transforms))


# ---- Auswahl (Platz/Regal) -------------------------------------------------

func set_selection(s: Variant) -> void:
	_selection = s
	selection_changed.emit()


func selection() -> Variant:
	return _selection


# ---- Ausgewähltes Regal (Bearbeiten-Modus) ---------------------------------

func set_selected_rack(key: String) -> void:
	_selected_rack = key
	selected_rack_changed.emit()


func selected_rack() -> String:
	return _selected_rack


# ---- Ausgewählter Artikel (Suche) ------------------------------------------

func set_selected_article(nr: String) -> void:
	_selected_article = nr
	selected_article_changed.emit()


func selected_article() -> String:
	return _selected_article


# ---- TransformControls-Modus ----------------------------------------------

func set_transform_mode(m: String) -> void:
	_transform_mode = m
	transform_mode_changed.emit()


func transform_mode() -> String:
	return _transform_mode


# ---- Aktiver Drag ----------------------------------------------------------

func set_drag_active(v: bool) -> void:
	_drag_active = v
	drag_active_changed.emit()


func is_drag_active() -> bool:
	return _drag_active


# ---- Messpunkte ------------------------------------------------------------

func add_measure_point(p: Dictionary) -> void:
	_measure_points = [p] if _measure_points.size() >= 2 else _measure_points + [p]
	measure_changed.emit()


func clear_measure() -> void:
	_measure_points = []
	measure_changed.emit()


func measure_points() -> Array:
	return _measure_points


# ---- Live-Buchungen (Ringpuffer 10s) ---------------------------------------

func push_buchung(e: Dictionary) -> void:
	_buchung_seq += 1
	var entry := e.duplicate(true)
	entry["id"] = _buchung_seq
	if not entry.has("ts"):
		entry["ts"] = Time.get_unix_time_from_system() * 1000.0
	_buchungen.append(entry)
	var cut := Time.get_unix_time_from_system() * 1000.0 - BUCHUNG_STORE_MS
	_buchungen = _buchungen.filter(func(b: Dictionary) -> bool:
		return float(b.get("ts", 0)) >= cut
	)
	buchungen_changed.emit()


func buchungen() -> Array:
	return _buchungen
