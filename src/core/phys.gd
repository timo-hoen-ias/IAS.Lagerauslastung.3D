# Port von src/app/phys.ts — Vertikal-Physik (Ego).
class_name WmPhys
extends RefCounted


static func next_vertical(vy: float, grounded: bool, jump: bool, dt: float, gravity: float = 20.0, jump_speed: float = 8.0) -> float:
	if grounded and jump:
		return jump_speed
	return vy - gravity * dt
