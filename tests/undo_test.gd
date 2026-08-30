extends RefCounted

const ID := {"x": 0.0, "z": 0.0, "rotY": 0.0, "scale": {"x": 1.0, "y": 1.0, "z": 1.0}}


static func run(t) -> void:
	var state := {"A": ID.duplicate(true)}
	var get := func(key: String) -> Variant: return state[key].duplicate(true)
	var apply := func(key: String, tr: Dictionary) -> void: state[key] = tr.duplicate(true)
	var reset := func(key: String) -> void: state[key] = ID.duplicate(true)
	var u = preload("res://src/core/undo_controller.gd").new(get, apply, reset)

	var t1: Dictionary = state["A"].duplicate(true)
	t1["x"] = 5.0
	u.set_transform("A", t1)
	t.eq(state["A"]["x"], 5.0, "set angewendet")
	t.eq(u.has_undo(), true, "has_undo")
	u.undo()
	t.eq(state["A"]["x"], 0.0, "undo zurück")
	t.eq(u.has_redo(), true, "has_redo")
	u.redo()
	t.eq(state["A"]["x"], 5.0, "redo wieder")

	state["A"]["x"] = 9.0
	u.record_drag("A", state["A"].duplicate(true), t1)
	t.eq(state["A"]["x"], 9.0, "drag live bleibt")
	u.undo()
	t.eq(state["A"]["x"], 5.0, "drag undo -> Start")
	u.redo()
	t.eq(state["A"]["x"], 9.0, "drag redo -> Final")

	u.reset_transform("A")
	t.eq(state["A"]["x"], 0.0, "reset angewendet")
	u.undo()
	t.eq(state["A"]["x"], 9.0, "reset undo")

	u.undo()
	t.eq(state["A"]["x"], 5.0, "nächster undo -> drag-Start")
	u.undo()
	t.eq(state["A"]["x"], 0.0, "tiefster undo -> set-Anfang")