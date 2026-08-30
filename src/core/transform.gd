# Port von src/app/scene/transform.ts — Regal-Transformationen, AABB, Raster-Funktionen.
class_name WmTransform
extends RefCounted

const SCALE_MIN := 0.5
const SCALE_MAX := 2.0


static func identity_transform() -> Dictionary:
	return {"x": 0.0, "z": 0.0, "rotY": 0.0, "scale": {"x": 1.0, "y": 1.0, "z": 1.0}}


static func snap1(n: float) -> float:
	return round(n)


static func snap45(deg: float) -> float:
	return round(deg / 45.0) * 45.0


static func round05(n: float) -> float:
	return round(n * 2.0) / 2.0


static func clamp_scale(s: float) -> float:
	return minf(SCALE_MAX, maxf(SCALE_MIN, s))


static func rotate_rack(t: Dictionary, delta_deg: float) -> Dictionary:
	var out := t.duplicate(true)
	out["rotY"] = snap45(float(t["rotY"]) * 180.0 / PI + delta_deg) * PI / 180.0
	return out


static func move_rack(t: Dictionary, dx: float, dz: float) -> Dictionary:
	var out := t.duplicate(true)
	out["x"] = snap1(float(t["x"]) + dx)
	out["z"] = snap1(float(t["z"]) + dz)
	return out


static func snapped_move(_last: Dictionary, base_x: float, base_z: float, wp_x: float, wp_z: float, grab_dx: float, grab_dz: float) -> Dictionary:
	var out := _last.duplicate(true)
	out["x"] = snap1(wp_x - grab_dx) - base_x
	out["z"] = snap1(wp_z - grab_dz) - base_z
	return out


static func scale_rack(t: Dictionary, factor: float) -> Dictionary:
	var s := clamp_scale(round05(factor))
	var out := t.duplicate(true)
	out["scale"] = {"x": s, "y": s, "z": s}
	return out


static func resize_rack(t: Dictionary, axis: String, factor: float) -> Dictionary:
	var out := t.duplicate(true)
	var sc := (out["scale"] as Dictionary).duplicate()
	sc[axis] = clamp_scale(round05(factor))
	out["scale"] = sc
	return out


static func resize_rack_exact(t: Dictionary, axis: String, factor: float) -> Dictionary:
	var out := t.duplicate(true)
	var sc := (out["scale"] as Dictionary).duplicate()
	sc[axis] = clamp_scale(factor)
	out["scale"] = sc
	return out


static func resize_factor(base_half: float, pointer_coord: float, handle_offset: float) -> float:
	return clamp_scale(round05((absf(pointer_coord) - handle_offset) / base_half))


static func resize_height_factor(base_h: float, top_y: float, floor_y: float) -> float:
	return clamp_scale(round05((top_y - floor_y) / base_h))


static func resize_height(base_h: float, pointer_y: float, handle_offset: float, floor_y: float = 0.0) -> float:
	return resize_height_factor(base_h, pointer_y - handle_offset, floor_y)


# base = RackPlacement (origin: Vector3, size unscaled) -> PlacedRack
static func apply_transform(base: Dictionary, t: Dictionary) -> Dictionary:
	var origin: Vector3 = base["origin"]
	var scale: Dictionary = t["scale"]
	var base_size: Dictionary = base["size"]
	var out := base.duplicate(true)
	out["position"] = Vector3(origin.x + float(t["x"]), 0.0, origin.z + float(t["z"]))
	out["rotY"] = float(t["rotY"])
	out["size"] = {
		"w": float(base_size["w"]) * float(scale["x"]),
		"h": float(base_size["h"]) * float(scale["y"]),
		"d": float(base_size["d"]) * float(scale["z"]),
	}
	return out


static func rack_aabb(placed: Dictionary) -> Dictionary:
	var pos: Vector3 = placed["position"]
	var size: Dictionary = placed["size"]
	var rot: float = placed["rotY"]
	var hx := absf(cos(rot)) * float(size["w"]) / 2.0 + absf(sin(rot)) * float(size["d"]) / 2.0
	var hz := absf(sin(rot)) * float(size["w"]) / 2.0 + absf(cos(rot)) * float(size["d"]) / 2.0
	return {"min_x": pos.x - hx, "max_x": pos.x + hx, "min_z": pos.z - hz, "max_z": pos.z + hz}


static func rack_bounds(placed_racks: Array, margin: float = 0.0) -> Dictionary:
	if placed_racks.is_empty():
		return {}
	var min_x := INF
	var max_x := -INF
	var min_z := INF
	var max_z := -INF
	for r: Dictionary in placed_racks:
		var b := rack_aabb(r)
		min_x = minf(min_x, b["min_x"])
		max_x = maxf(max_x, b["max_x"])
		min_z = minf(min_z, b["min_z"])
		max_z = maxf(max_z, b["max_z"])
	return {"min_x": min_x - margin, "max_x": max_x + margin, "min_z": min_z - margin, "max_z": max_z + margin}


static func dist2d(a: Dictionary, b: Dictionary) -> float:
	var dx := float(b["x"]) - float(a["x"])
	var dz := float(b["z"]) - float(a["z"])
	return sqrt(dx * dx + dz * dz)
