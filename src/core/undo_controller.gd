# Wrapper um Godots UndoRedo (RefCounted, läuft im Export).
# Transform-Änderungen werden als eine Aktion je Geste/Tastendruck erfasst.
class_name WmUndo
extends RefCounted

var _ur := UndoRedo.new()
var _get: Callable = Callable()
var _apply: Callable = Callable()
var _reset: Callable = Callable()


func _init(get_t: Callable, apply_t: Callable, reset_t: Callable) -> void:
	_get = get_t
	_apply = apply_t
	_reset = reset_t


func set_transform(key: String, new_t: Dictionary) -> void:
	var prev = _get.call(key)
	if prev == new_t:
		return
	_ur.create_action("Set %s" % key)
	_ur.add_do_method(_apply.bind(key, new_t))
	_ur.add_undo_method(_apply.bind(key, prev))
	_ur.commit_action()
	_apply.call(key, new_t)


# Ganze Drag-Geste = 1 Aktion (do=final, undo=Start). Live schon angewendet.
func record_drag(key: String, final_t: Dictionary, start_t: Dictionary) -> void:
	if final_t == start_t:
		return
	_ur.create_action("Drag %s" % key)
	_ur.add_do_method(_apply.bind(key, final_t))
	_ur.add_undo_method(_apply.bind(key, start_t))
	_ur.commit_action()


func reset_transform(key: String) -> void:
	var prev = _get.call(key)
	_ur.create_action("Reset %s" % key)
	_ur.add_do_method(_reset.bind(key))
	_ur.add_undo_method(_apply.bind(key, prev))
	_ur.commit_action()
	_reset.call(key)


func undo() -> void:
	_ur.undo()


func redo() -> void:
	_ur.redo()


func has_undo() -> bool:
	return _ur.has_undo()


func has_redo() -> bool:
	return _ur.has_redo()


func clear() -> void:
	_ur.clear_history()