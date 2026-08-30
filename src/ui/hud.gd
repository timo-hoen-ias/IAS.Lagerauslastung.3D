# HUD: Titel/Datenquelle, Modus- & Werkzeug-Buttons, Hilfe, Speed-Slider,
# Readout (POS-X/Z/MODUS), Crosshair (Ego), Legende, Messstatus.
extends CanvasLayer

const WmTransform = preload("res://src/core/transform.gd")

signal mode_changed(mode: String)
signal edit_toggled(on: bool)
signal measure_toggled(on: bool)
signal lighting_toggled(on: bool)
signal walls_toggled(on: bool)
signal speed_changed(v: float)
signal inspector_toggled(on: bool)

const MODES := [["orbit", "Orbit"], ["walk", "Ego"], ["topdown", "Top-Down"]]
const HELP_LINES := [
	"Orbit: WASD fliegen · Leertaste/Shift hoch/runter",
	"Ego: WASD · Shift Sprint · Leertaste Springen · ESC: Maus frei (UI)",
	"Bearbeiten: Regal ziehen · Q/E · Pfeile · []",
	"Tab: Modus · Platz/Regal anklicken: Bestände",
]

var _source: Label
var _counts: Label
var _ws: Label
var _buchungen: Label
var _buchung_count := 0
var _mode := "orbit"
var _edit := false
var _measure := false
var _lighting := true
var _walls := false
var _speed := 10.0
var _measure_label: Label
var _readout_label: Label
var _crosshair: Control
var _help_panel: Control
var _edit_panel: VBoxContainer
var _edit_dims: Label
var _mode_buttons := {}
var _toggle_buttons := {}
var _undo: Variant
var _loading_overlay: PanelContainer
var _loading_label: Label
var _error_overlay: PanelContainer
var _error_label: Label


func _ready() -> void:
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.09, 0.11, 0.15, 0.82)
	style.set_corner_radius_all(10)
	style.set_content_margin_all(12)
	var style_btn := StyleBoxFlat.new()
	style_btn.bg_color = Color(0.16, 0.2, 0.28, 0.9)
	style_btn.set_corner_radius_all(6)
	style_btn.set_content_margin_all(6)
	var style_btn_active := StyleBoxFlat.new()
	style_btn_active.bg_color = Color(0.29, 0.62, 0.9, 0.9)
	style_btn_active.set_corner_radius_all(6)
	style_btn_active.set_content_margin_all(6)

	# --- Top links: Status
	var top := MarginContainer.new()
	top.set_anchors_preset(Control.PRESET_TOP_LEFT)
	top.offset_left = 12
	top.offset_top = 12
	add_child(top)
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", style)
	panel.custom_minimum_size = Vector2(280, 0)
	top.add_child(panel)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 4)
	panel.add_child(vb)
	var title := Label.new()
	title.text = "Lagerbestands-Viewer (Godot)"
	title.add_theme_font_size_override("font_size", 19)
	title.add_theme_color_override("font_color", Color("#e8ecf1"))
	vb.add_child(title)
	_source = _label(vb, "…")
	_source.add_theme_color_override("font_color", Color("#f1c40f"))
	_counts = _label(vb, "…")
	_ws = _label(vb, "ws: …")
	_ws.add_theme_color_override("font_color", Color("#9aa5b1"))
	_buchungen = _label(vb, "Live-Buchungen: 0")

	# --- Top rechts: Modus + Werkzeuge
	var top_right := MarginContainer.new()
	top_right.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	top_right.offset_top = 12
	top_right.offset_right = -12
	top_right.offset_left = -600
	add_child(top_right)
	call_deferred(&"_pin_top_right", top_right, 12.0)
	var tr_panel := PanelContainer.new()
	tr_panel.add_theme_stylebox_override("panel", style)
	top_right.add_child(tr_panel)
	var tr_vb := VBoxContainer.new()
	tr_vb.add_theme_constant_override("separation", 6)
	tr_panel.add_child(tr_vb)

	var mode_row := HBoxContainer.new()
	mode_row.add_theme_constant_override("separation", 6)
	tr_vb.add_child(mode_row)
	for entry: Array in MODES:
		var b := _button(str(entry[0]), str(entry[1]), style_btn, style_btn_active)
		b.pressed.connect(func(): _emit_mode(str(entry[0])))
		mode_row.add_child(b)
		_mode_buttons[str(entry[0])] = b

	var tool_row := HBoxContainer.new()
	tool_row.add_theme_constant_override("separation", 6)
	tr_vb.add_child(tool_row)
	_toggle_buttons["edit"] = _make_toggle(tool_row, "Bearbeiten", style_btn, style_btn_active, func(on): edit_toggled.emit(on))
	_toggle_buttons["measure"] = _make_toggle(tool_row, "Messen", style_btn, style_btn_active, func(on): measure_toggled.emit(on))
	_toggle_buttons["lighting"] = _make_toggle(tool_row, "Beleuchtung", style_btn, style_btn_active, func(on): lighting_toggled.emit(on))
	_toggle_buttons["walls"] = _make_toggle(tool_row, "Wände", style_btn, style_btn_active, func(on): walls_toggled.emit(on))
	_toggle_buttons["inspector"] = _make_toggle(tool_row, "Inspector", style_btn, style_btn_active, func(on): inspector_toggled.emit(on))
	var help_btn := _button("help", "Hilfe", style_btn, style_btn_active)
	help_btn.pressed.connect(_toggle_help)
	tool_row.add_child(help_btn)

	# --- Hilfe-Overlay
	_help_panel = PanelContainer.new()
	_help_panel.visible = false
	_help_panel.add_theme_stylebox_override("panel", style)
	tr_vb.add_child(_help_panel)
	var hvb := VBoxContainer.new()
	hvb.add_theme_constant_override("separation", 4)
	_help_panel.add_child(hvb)
	for line: String in HELP_LINES:
		_label(hvb, line)

	_build_edit_panel(tr_vb, style_btn, style_btn_active)

	# --- Bottom links: Legende
	var legend := MarginContainer.new()
	legend.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	legend.offset_left = 12
	legend.offset_bottom = -12
	add_child(legend)
	var lpanel := PanelContainer.new()
	lpanel.add_theme_stylebox_override("panel", style)
	legend.add_child(lpanel)
	var lvb := VBoxContainer.new()
	lvb.add_theme_constant_override("separation", 4)
	lpanel.add_child(lvb)
	var lt := Label.new()
	lt.text = "Bestand je Platz"
	lt.add_theme_font_size_override("font_size", 14)
	lvb.add_child(lt)
	for entry: Array in [[Color("#5d6673"), "leer"], [Color("#27ae60"), "< 100"], [Color("#f1c40f"), "100–499"], [Color("#e74c3c"), "≥ 500"]]:
		_legend_row(lvb, entry[0], entry[1])

	# --- Bottom rechts: Speed + Readout + Messstatus
	var bottom_right := MarginContainer.new()
	bottom_right.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	bottom_right.offset_right = -12
	bottom_right.offset_bottom = -12
	bottom_right.offset_left = -450
	bottom_right.offset_top = -180
	add_child(bottom_right)
	call_deferred(&"_pin_bottom_right", bottom_right, 12.0)
	var br_panel := PanelContainer.new()
	br_panel.add_theme_stylebox_override("panel", style)
	bottom_right.add_child(br_panel)
	var br_vb := VBoxContainer.new()
	br_vb.add_theme_constant_override("separation", 6)
	br_panel.add_child(br_vb)

	_readout_label = _label(br_vb, "POS-X 0,0 · POS-Z 0,0 · MODUS ORBIT")
	_readout_label.add_theme_color_override("font_color", Color("#7ec8ff"))
	_measure_label = _label(br_vb, "")
	_measure_label.add_theme_color_override("font_color", Color("#7ec8ff"))

	var speed_row := HBoxContainer.new()
	speed_row.add_theme_constant_override("separation", 8)
	br_vb.add_child(speed_row)
	var sp_label := Label.new()
	sp_label.text = "Geschwindigkeit"
	sp_label.add_theme_color_override("font_color", Color("#9aa5b1"))
	speed_row.add_child(sp_label)
	var slider := HSlider.new()
	slider.min_value = 1.0
	slider.max_value = 30.0
	slider.step = 0.5
	slider.value = _speed
	slider.custom_minimum_size = Vector2(140, 0)
	slider.value_changed.connect(func(v: float):
		_speed = v
		speed_changed.emit(v)
	)
	speed_row.add_child(slider)
	var speed_val := Label.new()
	speed_val.text = "%s m/s" % "%.1f" % _speed
	speed_val.custom_minimum_size = Vector2(50, 0)
	speed_row.add_child(speed_val)
	slider.value_changed.connect(func(v: float): speed_val.text = "%s m/s" % "%.1f" % v)

	# --- Crosshair (Ego)
	_crosshair = CrosshairUI.new()
	_crosshair.set_anchors_preset(Control.PRESET_CENTER)
	_crosshair.offset_top = -11
	_crosshair.offset_bottom = 11
	_crosshair.offset_left = -11
	_crosshair.offset_right = 11
	_crosshair.visible = false
	_crosshair.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_crosshair)

	_refresh_buttons()
	Store.selected_rack_changed.connect(_refresh_edit_panel)
	Store.transforms_changed.connect(_refresh_edit_panel)
	_refresh_edit_panel()


func _build_edit_panel(parent: Control, s_btn: StyleBoxFlat, s_active: StyleBoxFlat) -> void:
	_edit_panel = VBoxContainer.new()
	_edit_panel.visible = false
	_edit_panel.add_theme_constant_override("separation", 4)
	parent.add_child(_edit_panel)
	var title := Label.new()
	title.text = "Regal bearbeiten"
	title.add_theme_font_size_override("font_size", 14)
	_edit_panel.add_child(title)
	var row1 := HBoxContainer.new()
	row1.add_theme_constant_override("separation", 4)
	_edit_panel.add_child(row1)
	_edit_btn(row1, "↑", s_btn, s_active, func(): _move(0.0, -1.0))
	_edit_btn(row1, "←", s_btn, s_active, func(): _move(-1.0, 0.0))
	_edit_btn(row1, "→", s_btn, s_active, func(): _move(1.0, 0.0))
	_edit_btn(row1, "↓", s_btn, s_active, func(): _move(0.0, 1.0))
	var row2 := HBoxContainer.new()
	row2.add_theme_constant_override("separation", 4)
	_edit_panel.add_child(row2)
	_edit_btn(row2, "⟲ −45°", s_btn, s_active, func(): _rotate(-45.0))
	_edit_btn(row2, "+45° ⟳", s_btn, s_active, func(): _rotate(45.0))
	var row3 := HBoxContainer.new()
	row3.add_theme_constant_override("separation", 4)
	_edit_panel.add_child(row3)
	_edit_btn(row3, "− Größe", s_btn, s_active, func(): _scale_step(-0.5))
	_edit_btn(row3, "+ Größe", s_btn, s_active, func(): _scale_step(0.5))
	_edit_btn(row3, "Reset", s_btn, s_active, func(): _reset())
	_edit_dims = Label.new()
	_edit_dims.add_theme_color_override("font_color", Color("#9aa5b1"))
	_edit_panel.add_child(_edit_dims)
	var hint := Label.new()
	hint.text = "Ziehen = Bewegen · Q/E · Pfeile · []"
	hint.add_theme_color_override("font_color", Color("#7a8590"))
	hint.add_theme_font_size_override("font_size", 11)
	_edit_panel.add_child(hint)


func _edit_btn(parent: Control, label: String, s_btn: StyleBoxFlat, s_active: StyleBoxFlat, cb: Callable) -> void:
	var b := _button(label, label, s_btn, s_active)
	b.pressed.connect(cb)
	parent.add_child(b)


func _move(dx: float, dz: float) -> void:
	var key := Store.selected_rack()
	if key == "":
		return
	_undo.set_transform(key, WmTransform.move_rack(Store.get_transform(key), dx, dz))


func _rotate(deg: float) -> void:
	var key := Store.selected_rack()
	if key == "":
		return
	_undo.set_transform(key, WmTransform.rotate_rack(Store.get_transform(key), deg))


func _scale_step(d: float) -> void:
	var key := Store.selected_rack()
	if key == "":
		return
	var t := Store.get_transform(key)
	_undo.set_transform(key, WmTransform.scale_rack(t, float(t["scale"]["x"]) + d))


func _reset() -> void:
	var key := Store.selected_rack()
	if key == "":
		return
	_undo.reset_transform(key)


func set_undo(u: Variant) -> void:
	_undo = u


func show_loading(text: String) -> void:
	if _loading_overlay == null:
		_loading_overlay = PanelContainer.new()
		_loading_overlay.set_anchors_preset(Control.PRESET_CENTER)
		var st := StyleBoxFlat.new()
		st.bg_color = Color(0.09, 0.11, 0.15, 0.9)
		st.set_corner_radius_all(10)
		st.set_content_margin_all(16)
		_loading_overlay.add_theme_stylebox_override("panel", st)
		_loading_label = Label.new()
		_loading_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_loading_label.add_theme_font_size_override("font_size", 16)
		_loading_overlay.add_child(_loading_label)
		add_child(_loading_overlay)
	_loading_label.text = text
	_loading_overlay.visible = true


func hide_loading() -> void:
	if _loading_overlay != null:
		_loading_overlay.visible = false


func show_error(text: String) -> void:
	if _error_overlay == null:
		_error_overlay = PanelContainer.new()
		_error_overlay.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		_error_overlay.offset_left = -340
		_error_overlay.offset_top = 12
		_error_overlay.offset_right = -12
		_error_overlay.custom_minimum_size = Vector2(280, 0)
		var st := StyleBoxFlat.new()
		st.bg_color = Color(0.42, 0.13, 0.13, 0.92)
		st.set_corner_radius_all(8)
		st.set_content_margin_all(12)
		_error_overlay.add_theme_stylebox_override("panel", st)
		_error_label = Label.new()
		_error_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_error_label.add_theme_font_size_override("font_size", 12)
		_error_overlay.add_child(_error_label)
		add_child(_error_overlay)
	_error_label.text = text
	_error_overlay.visible = true


func _refresh_edit_panel() -> void:
	if _edit_panel == null:
		return
	var key := Store.selected_rack()
	_edit_panel.visible = _edit and key != ""
	if not _edit_panel.visible:
		return
	var t := Store.get_transform(key)
	var s: Dictionary = t["scale"]
	_edit_dims.text = "B %.2f · H %.2f · D %.2f m" % [s["x"], s["y"], s["z"]]


func set_edit(on: bool) -> void:
	_edit = on
	_refresh_edit_panel()


func _emit_mode(mode: String) -> void:
	_mode = mode
	_refresh_buttons()
	mode_changed.emit(mode)


func set_mode(mode: String) -> void:
	_mode = mode
	_refresh_buttons()


func _make_toggle(parent: Control, label: String, s_btn: StyleBoxFlat, s_active: StyleBoxFlat, on_toggle: Callable) -> Button:
	var b := _button(label, label, s_btn, s_active)
	b.pressed.connect(func():
		b.button_pressed = not b.button_pressed
		b.add_theme_stylebox_override("normal", s_active if b.button_pressed else s_btn)
		on_toggle.call(b.button_pressed)
	)
	parent.add_child(b)
	return b


func _button(icon_text: String, label: String, s_btn: StyleBoxFlat, s_active: StyleBoxFlat) -> Button:
	var b := Button.new()
	b.text = label
	b.add_theme_stylebox_override("normal", s_btn)
	b.add_theme_stylebox_override("hover", s_btn)
	b.add_theme_stylebox_override("pressed", s_active)
	b.add_theme_stylebox_override("focus", s_btn)
	b.custom_minimum_size = Vector2(0, 28)
	b.add_theme_font_size_override("font_size", 13)
	return b


func _toggle_help() -> void:
	_help_panel.visible = not _help_panel.visible


func _pin_top_right(ctrl: Control, margin: float) -> void:
	await get_tree().process_frame
	ctrl.offset_left = -(ctrl.size.x + margin)
	ctrl.offset_right = -margin
	ctrl.offset_top = margin


func _pin_bottom_right(ctrl: Control, margin: float) -> void:
	await get_tree().process_frame
	ctrl.offset_left = -(ctrl.size.x + margin)
	ctrl.offset_right = -margin
	ctrl.offset_bottom = -margin
	ctrl.offset_top = -ctrl.size.y - margin


func _refresh_buttons() -> void:
	for m: String in _mode_buttons:
		var b: Button = _mode_buttons[m]
		b.button_pressed = (m == _mode)


# ---- Öffentliche API --------------------------------------------------------

func set_source(source: String) -> void:
	_source.text = "Datenquelle: " + source


func set_counts(orte: int, plaetze: int) -> void:
	_counts.text = "%d Lagerorte · %d Plätze" % [orte, plaetze]


func set_ws_state(state: String) -> void:
	_ws.text = state


func add_buchung(_event: Dictionary) -> void:
	_buchung_count += 1
	_buchungen.text = "Live-Buchungen: %d" % _buchung_count


func set_readout(x: float, z: float, mode_label: String) -> void:
	_readout_label.text = "POS-X %.1f · POS-Z %.1f · MODUS %s" % [x, z, mode_label]


func set_measure_status(text: String) -> void:
	_measure_label.text = text


func set_crosshair_visible(on: bool) -> void:
	_crosshair.visible = on


func set_lighting_btn(on: bool) -> void:
	_lighting = on


func set_walls_btn(on: bool) -> void:
	_walls = on


func _label(parent: Control, text: String) -> Label:
	var l := Label.new()
	l.text = text
	parent.add_child(l)
	return l


func _legend_row(parent: Control, color: Color, label: String) -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	parent.add_child(row)
	var swatch := ColorRect.new()
	swatch.color = color
	swatch.custom_minimum_size = Vector2(14, 14)
	swatch.size = Vector2(14, 14)
	row.add_child(swatch)
	_label(row, label)
