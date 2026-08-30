extends RefCounted

const WmEditMath = preload("res://src/core/editmath.gd")


static func run(t) -> void:
	_test_axis_dir(t)
	_test_ray_plane(t)
	_test_axis_plane_normal(t)
	_test_project(t)
	_test_angle(t)
	_test_wrap(t)


static func _test_axis_dir(t) -> void:
	t.eq(WmEditMath.axis_dir("x", 0.0), Vector3(1, 0, 0), "x bei 0°")
	t.eq(WmEditMath.axis_dir("z", 0.0), Vector3(0, 0, 1), "z bei 0°")
	t.near(WmEditMath.axis_dir("x", PI / 2.0).x, 0.0, 1e-9, "x 90° x-Komp")
	t.near(WmEditMath.axis_dir("x", PI / 2.0).z, 1.0, 1e-9, "x 90° z-Komp")
	t.near(WmEditMath.axis_dir("z", PI / 2.0).x, -1.0, 1e-9, "z 90° x-Komp")
	t.near(WmEditMath.axis_dir("z", PI / 2.0).z, 0.0, 1e-9, "z 90° z-Komp")
	t.eq(WmEditMath.axis_dir("y", 1.0), Vector3.UP, "y immer UP")
	t.eq(WmEditMath.axis_dir("?", 0.0), Vector3.ZERO, "unbekannte Achse")


static func _test_ray_plane(t) -> void:
	var hit = WmEditMath.ray_plane_hit(Vector3(0, 10, 0), Vector3.DOWN, Vector3.ZERO, Vector3.UP)
	t.ok(hit != null, "Treffer nicht null")
	t.near(hit.y, 0.0, 1e-9, "Treffer auf y=0")
	t.near(hit.x, 0.0, 1e-9, "Treffer x=0")
	t.near(hit.z, 0.0, 1e-9, "Treffer z=0")
	t.eq(WmEditMath.ray_plane_hit(Vector3.ZERO, Vector3.RIGHT, Vector3.ZERO, Vector3.UP), null, "parallel -> null")
	t.eq(WmEditMath.ray_plane_hit(Vector3(0, 5, 0), Vector3.UP, Vector3.ZERO, Vector3.UP), null, "Ebene hinter Ursprung -> null")


static func _test_axis_plane_normal(t) -> void:
	var n := WmEditMath.axis_plane_normal(Vector3.RIGHT, Vector3(0, 0, -1))
	t.near(n.x, 0.0, 1e-9, "Normalen x")
	t.near(n.y, 0.0, 1e-9, "Normalen y")
	t.near(n.z, -1.0, 1e-9, "Normalen z (gegen Kamera)")
	var len := WmEditMath.axis_plane_normal(Vector3.RIGHT, Vector3(0, 0, -1)).length()
	t.near(len, 1.0, 1e-9, "normalisiert")


static func _test_project(t) -> void:
	t.near(WmEditMath.project_axis(Vector3(5, 0, 7), Vector3(2, 0, 1), Vector3.RIGHT), 3.0, 1e-9, "proj x")
	t.near(WmEditMath.project_axis(Vector3(5, 0, 7), Vector3(2, 0, 1), Vector3(0, 0, 1)), 6.0, 1e-9, "proj z")


static func _test_angle(t) -> void:
	t.near(WmEditMath.angle_signed(Vector3.ZERO, Vector3(1, 0, 0)), PI / 2.0, 1e-9, "Osten -> +90°")
	t.near(WmEditMath.angle_signed(Vector3.ZERO, Vector3(0, 0, 1)), 0.0, 1e-9, "Süden -> 0°")
	t.near(WmEditMath.angle_signed(Vector3.ZERO, Vector3(-1, 0, 0)), -PI / 2.0, 1e-9, "Westen -> -90°")


static func _test_wrap(t) -> void:
	t.near(WmEditMath.wrap_angle_rad(3.0 * PI), PI, 1e-9, "wrap 3π -> π")
	t.near(WmEditMath.wrap_angle_rad(1.5 * PI), -PI / 2.0, 1e-9, "wrap 1.5π -> -π/2")
	t.near(WmEditMath.wrap_angle_rad(-1.5 * PI), PI / 2.0, 1e-9, "wrap -1.5π -> π/2")
	t.near(WmEditMath.wrap_angle_rad(0.7), 0.7, 1e-9, "wrap im Bereich bleibt")