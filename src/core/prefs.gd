# UserPrefs (Port von localStorage) — JSON in user://.
class_name WmPrefs
extends RefCounted

const FILE := "user://wm-prefs.json"


static func _load() -> Dictionary:
	var f := FileAccess.open(FILE, FileAccess.READ)
	if f == null:
		return {}
	var j := JSON.new()
	if j.parse(f.get_as_text()) != OK:
		return {}
	return j.data


static func _save(d: Dictionary) -> void:
	var f := FileAccess.open(FILE, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(d))


static func get_float(key: String, fallback: float) -> float:
	var d := _load()
	var v = d.get(key, null)
	return float(v) if v is float or v is int else fallback


static func set_float(key: String, v: float) -> void:
	var d := _load()
	d[key] = v
	_save(d)


static func get_vec2(key: String, fallback: Vector2) -> Vector2:
	var d := _load()
	var v = d.get(key, null)
	if v is Dictionary:
		return Vector2(float((v as Dictionary).get("x", fallback.x)), float((v as Dictionary).get("y", fallback.y)))
	return fallback


static func set_vec2(key: String, v: Vector2) -> void:
	var d := _load()
	d[key] = {"x": v.x, "y": v.y}
	_save(d)
