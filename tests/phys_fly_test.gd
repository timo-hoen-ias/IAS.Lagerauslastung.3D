extends RefCounted

const WmPhys = preload("res://src/core/phys.gd")
const WmFly = preload("res://src/core/fly.gd")


static func run(t) -> void:
	_test_phys(t)
	_test_fly(t)


static func _test_phys(t) -> void:
	t.near(WmPhys.next_vertical(0.0, true, true, 0.016), 8.0, 1e-6, "Sprung vom Boden -> jumpSpeed")
	t.near(WmPhys.next_vertical(5.0, false, false, 0.1), 3.0, 1e-6, "5 - 20*0.1")
	t.near(WmPhys.next_vertical(0.0, false, false, 0.1), -2.0, 1e-6, "beginnt zu fallen")
	var v := WmPhys.next_vertical(0.0, true, true, 0.016)
	t.near(WmPhys.next_vertical(v, false, false, 0.016), 8.0 - 20.0 * 0.016, 1e-6, "Sprung nur einmalig")


static func _test_fly(t) -> void:
	var fwd := Vector2(0, -1)
	var right := Vector2(1, 0)
	var keys := {}
	t.eq(WmFly.fly_delta(keys, fwd, right, 10.0, 0.1), Vector3.ZERO, "keine Tasten -> 0")
	t.eq(WmFly.fly_delta({"W": true}, fwd, right, 10.0, 0.1), Vector3(0, 0, -1), "W")
	t.eq(WmFly.fly_delta({"S": true}, fwd, right, 10.0, 0.1), Vector3(0, 0, 1), "S")
	t.eq(WmFly.fly_delta({"D": true}, fwd, right, 10.0, 0.1), Vector3(1, 0, 0), "D")
	t.eq(WmFly.fly_delta({"A": true}, fwd, right, 10.0, 0.1), Vector3(-1, 0, 0), "A")
	t.eq(WmFly.fly_delta({"Space": true}, fwd, right, 10.0, 0.1), Vector3(0, 1, 0), "Space hoch")
	t.eq(WmFly.fly_delta({"ShiftLeft": true}, fwd, right, 10.0, 0.1), Vector3(0, -1, 0), "Shift runter")
	# Diagonale normalisiert
	var diag := WmFly.fly_delta({"W": true, "D": true}, fwd, right, 10.0, 0.1)
	t.near(Vector2(diag.x, diag.z).length(), 1.0, 1e-6, "Diagonale Länge 1")
