# Headless-Test-Runner: godot --headless -s res://tests/run_tests.gd
extends SceneTree

const TestCase = preload("res://tests/test_case.gd")


func _initialize() -> void:
	var modules := [
		preload("res://tests/perf_gen_test.gd"),
		preload("res://tests/query_test.gd"),
		preload("res://tests/layout_test.gd"),
		preload("res://tests/transform_test.gd"),
		preload("res://tests/boxes_test.gd"),
		preload("res://tests/gew_test.gd"),
		preload("res://tests/article_test.gd"),
		preload("res://tests/phys_fly_test.gd"),
		preload("res://tests/cell_test.gd"),
		preload("res://tests/editmath_test.gd"),
		preload("res://tests/undo_test.gd"),
	]
	var total_failures := 0
	for mod in modules:
		var tc := TestCase.new(mod.resource_path.get_file())
		mod.run(tc)
		tc.summary()
		total_failures += tc.failures
	if total_failures == 0:
		print("ALLE TESTS BESTANDEN")
	else:
		print("FEHLGESCHLAGENE TESTS: %d" % total_failures)
	quit(total_failures)
