# Port von src/app/scene/fly.ts — Flug-Delta aus Tastatur + Basisvektoren.
class_name WmFly
extends RefCounted


static func fly_delta(keys: Dictionary, forward: Vector2, right: Vector2, speed: float, dt: float) -> Vector3:
	var dx := 0.0
	var dz := 0.0
	if keys.get("W", false) or keys.get("ArrowUp", false):
		dx += forward.x
		dz += forward.y
	if keys.get("S", false) or keys.get("ArrowDown", false):
		dx -= forward.x
		dz -= forward.y
	if keys.get("D", false) or keys.get("ArrowRight", false):
		dx += right.x
		dz += right.y
	if keys.get("A", false) or keys.get("ArrowLeft", false):
		dx -= right.x
		dz -= right.y
	var len := sqrt(dx * dx + dz * dz)
	if len > 0.0:
		dx /= len
		dz /= len
	var dy := 0.0
	if keys.get("Space", false):
		dy += 1.0
	if keys.get("ShiftLeft", false) or keys.get("ShiftRight", false):
		dy -= 1.0
	return Vector3(dx * speed * dt, dy * speed * dt, dz * speed * dt)
