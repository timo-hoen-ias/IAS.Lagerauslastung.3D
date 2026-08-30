# Reine Rechen-Helfer für die Gizmo-Drags (Port des three.js TransformControls).
class_name WmEditMath
extends RefCounted

const GIZMO_LAYER := 2


static func axis_dir(axis: String, rotY: float) -> Vector3:
	match axis:
		"x":
			return Vector3(cos(rotY), 0.0, sin(rotY))
		"z":
			return Vector3(-sin(rotY), 0.0, cos(rotY))
		"y":
			return Vector3.UP
	return Vector3.ZERO


static func ray_plane_hit(from: Vector3, dir: Vector3, plane_origin: Vector3, plane_normal: Vector3) -> Variant:
	var denom := plane_normal.dot(dir)
	if absf(denom) < 1e-6:
		return null
	var t := (plane_origin - from).dot(plane_normal) / denom
	if t < 0.0:
		return null
	return from + dir * t


# Ebene, die die Achse enthält und Richtung Kamera zeigt (wie three.js Achsen-Drag).
static func axis_plane_normal(axis_dir: Vector3, view_dir: Vector3) -> Vector3:
	var perp := axis_dir.cross(view_dir)
	var n := perp.cross(axis_dir)
	if n.length_squared() < 1e-9:
		return Vector3.UP
	return n.normalized()


static func project_axis(hit: Vector3, center: Vector3, axis_dir: Vector3) -> float:
	return (hit - center).dot(axis_dir)


static func angle_signed(center: Vector3, p: Vector3) -> float:
	return atan2(p.x - center.x, p.z - center.z)


static func wrap_angle_rad(a: float) -> float:
	var out := fmod(a, TAU)
	if out > PI:
		out -= TAU
	elif out < -PI:
		out += TAU
	return out