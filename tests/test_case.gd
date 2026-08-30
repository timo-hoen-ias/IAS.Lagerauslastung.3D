# Minimaler Test-Helfer (kein GUT-Addon noetig, ponytail).
extends RefCounted

var failures := 0
var assertions := 0
var name := ""


func _init(n: String) -> void:
	name = n


func ok(cond: bool, msg: String = "") -> void:
	assertions += 1
	if not cond:
		failures += 1
		print("  FAIL [%s] %s" % [name, msg])


func eq(a: Variant, b: Variant, msg: String = "") -> void:
	assertions += 1
	if a != b:
		failures += 1
		print("  FAIL [%s] %s  (expected=%s, got=%s)" % [name, msg, str(b), str(a)])


func near(a: float, b: float, eps: float = 1e-6, msg: String = "") -> void:
	ok(absf(a - b) <= eps, "%s (got %s, expected %s)" % [msg, a, b])


func summary() -> void:
	print("  [%s] %d assertions, %d failures" % [name, assertions, failures])
