# Inspector-Panel (rechts andockbar): Artikelsuche mit Autocomplete,
# Artikel-/Platz-/Ort-Ansicht. Port von src/app/ui/Inspector.tsx.
extends CanvasLayer

const WmArticle = preload("res://src/core/article.gd")
const WmGew = preload("res://src/core/gew.gd")

const WIDTH_KEY := "wm-inspector-width"
const WIDTH_MIN := 240.0

var _data: Dictionary = {}
var _panel: PanelContainer
var _body: VBoxContainer
var _search: LineEdit
var _suggest_panel: PanelContainer
var _suggest_list: ItemList
var _resize: Control
var _width := 420.0
var _article_list: Array = []
var _hl := 0
var _drag: Array = []


func _ready() -> void:
	_width = WmPrefs.get_float(WIDTH_KEY, 420.0)
	_width = maxf(_width, WIDTH_MIN)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.offset_top = 140
	margin.offset_bottom = -120
	add_child(margin)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 0)
	margin.add_child(hbox)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hbox.add_child(spacer)

	_resize = Control.new()
	_resize.custom_minimum_size = Vector2(7, 0)
	_resize.mouse_filter = Control.MOUSE_FILTER_STOP
	_resize.gui_input.connect(_on_resize_input)
	_resize.tooltip_text = "Breite ändern"
	hbox.add_child(_resize)

	_panel = PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.07, 0.08, 0.11, 0.9)
	style.set_corner_radius_all(0)
	style.set_content_margin_all(10)
	_panel.add_theme_stylebox_override("panel", style)
	_panel.custom_minimum_size = Vector2(_width, 0)
	hbox.add_child(_panel)

	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	_panel.add_child(vb)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 6)
	vb.add_child(header)
	var header_title := Label.new()
	header_title.text = "Inspector"
	header_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(header_title)
	var close_btn := Button.new()
	close_btn.text = "✕"
	close_btn.flat = true
	close_btn.tooltip_text = "Inspector schließen"
	close_btn.pressed.connect(func(): set_panel_visible(false))
	header.add_child(close_btn)

	var search_row := HBoxContainer.new()
	search_row.add_theme_constant_override("separation", 6)
	vb.add_child(search_row)
	_search = LineEdit.new()
	_search.placeholder_text = "Artikelnummer suchen…"
	_search.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_search.text_changed.connect(_on_search_changed)
	_search.gui_input.connect(_on_search_input)
	search_row.add_child(_search)
	var clear_btn := Button.new()
	clear_btn.text = "✕"
	clear_btn.flat = true
	clear_btn.pressed.connect(_on_clear)
	search_row.add_child(clear_btn)

	_suggest_panel = PanelContainer.new()
	_suggest_panel.visible = false
	_suggest_panel.custom_minimum_size = Vector2(0, 200)
	var sstyle := StyleBoxFlat.new()
	sstyle.bg_color = Color(0.12, 0.14, 0.18, 0.98)
	sstyle.set_corner_radius_all(8)
	sstyle.set_content_margin_all(6)
	_suggest_panel.add_theme_stylebox_override("panel", sstyle)
	vb.add_child(_suggest_panel)
	_suggest_list = ItemList.new()
	_suggest_list.item_activated.connect(_on_suggest_activated)
	_suggest_list.item_clicked.connect(_on_suggest_clicked)
	_suggest_panel.add_child(_suggest_list)

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vb.add_child(scroll)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(_body)

	Store.selection_changed.connect(_refresh)
	Store.selected_article_changed.connect(_on_article_changed)
	_refresh()


func set_data(data: Dictionary) -> void:
	_data = data
	_article_list = WmArticle.alle_artikel(data)
	_refresh()


func set_panel_visible(on: bool) -> void:
	_panel.visible = on
	_resize.visible = on


func _on_article_changed() -> void:
	if Store.selected_article() == "":
		_search.text = ""
	_suggest_panel.visible = false
	_refresh()


func _on_clear() -> void:
	Store.set_selected_article("")
	_search.text = ""
	_search.release_focus()
	_refresh()


# ---- Suche / Autocomplete ---------------------------------------------------

func _on_search_changed(_text: String) -> void:
	var q := _search.text
	if q.strip_edges().is_empty():
		_suggest_panel.visible = false
		return
	_hl = 0
	_suggest_list.clear()
	for v: Dictionary in WmArticle.filter_artikel(_article_list, q):
		var idx := _suggest_list.add_item("%s   %s   %s" % [v["artikelnummer"], v["bezeichnung1"], WmGew.fmt_de(v["gesamt"])])
		_suggest_list.set_item_metadata(idx, v["artikelnummer"])
	_suggest_panel.visible = _suggest_list.item_count > 0
	if _suggest_list.item_count > 0:
		_suggest_list.select(_hl)


func _on_search_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_DOWN:
				_hl = mini(_hl + 1, _suggest_list.item_count - 1)
				_suggest_list.select(_hl)
				_suggest_list.ensure_current_is_visible()
				_search.accept_event()
			KEY_UP:
				_hl = maxi(_hl - 1, 0)
				_suggest_list.select(_hl)
				_search.accept_event()
			KEY_ENTER:
				if _suggest_list.item_count > 0:
					_select_article(str(_suggest_list.get_item_metadata(_hl)))
					_search.accept_event()
			KEY_ESCAPE:
				_suggest_panel.visible = false
				_search.accept_event()


func _on_suggest_activated(index: int) -> void:
	_select_article(str(_suggest_list.get_item_metadata(index)))


func _on_suggest_clicked(index: int, _pos: Vector2, _button: int) -> void:
	_select_article(str(_suggest_list.get_item_metadata(index)))


func _select_article(nr: String) -> void:
	Store.set_selected_article(nr)
	_search.text = nr
	_suggest_panel.visible = false
	_search.release_focus()
	_refresh()


# ---- Inhalt ----------------------------------------------------------------

func _refresh() -> void:
	for c in _body.get_children():
		c.queue_free()
	var art := Store.selected_article()
	if art != "":
		_build_article(art)
		return
	var sel = Store.selection()
	if sel != null:
		if sel.has("platz") and sel["platz"] != null:
			_build_platz(sel["ort"], sel["platz"])
		else:
			_build_ort(sel["ort"])
		return
	_title("Lagerbestands-Viewer", "Artikelnummer suchen oder ein Lager anklicken.")


func _title(head: String, sub: String) -> void:
	var l := Label.new()
	l.text = head
	l.add_theme_font_size_override("font_size", 18)
	_body.add_child(l)
	if sub != "":
		var s := Label.new()
		s.text = sub
		s.add_theme_color_override("font_color", Color("#9aa5b1"))
		_body.add_child(s)


func _info_row(label: String, value: String, color: Color = Color("#e8ecf1")) -> void:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	_body.add_child(h)
	var l := Label.new()
	l.text = label
	l.custom_minimum_size = Vector2(90, 0)
	l.add_theme_color_override("font_color", Color("#9aa5b1"))
	h.add_child(l)
	var v := Label.new()
	v.text = value
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	v.add_theme_color_override("font_color", color)
	h.add_child(v)


func _build_article(nr: String) -> void:
	var plaetze := WmArticle.artikel_lagerplaetze(_data, nr)
	var ref: Dictionary = {}
	for a in _article_list:
		if str(a["artikelnummer"]) == nr:
			ref = a
			break
	_title("Artikel " + nr, str(ref.get("bezeichnung1", "")) + " · %d Lagerplätze" % plaetze.size())
	_make_table(["Lager", "Platz", "Bezeichnung", "Bestand"], plaetze, func(row: Dictionary) -> Array:
		return [row["ort"]["lagerkennung"], str(row["platz"]["kurz"] if str(row["platz"]["kurz"]) != "" else "#%d" % row["platz"]["platzId"]), row["platz"]["platzbezeichnung"], WmGew.fmt_de(row["bestand"])]
	, func(row: Dictionary) -> void:
		Store.set_selection({"ort": row["ort"], "platz": row["platz"]})
	)
	if plaetze.size() > 400:
		var n := Label.new()
		n.text = "… weitere Einträge (Liste gekürzt)"
		n.add_theme_color_override("font_color", Color("#9aa5b1"))
		_body.add_child(n)


func _build_platz(ort: Dictionary, platz: Dictionary) -> void:
	var total := 0.0
	for b: Dictionary in platz["bestaende"]:
		total += float(b["bestand"])
	var gewicht := WmGew.platz_gewicht(platz)
	var max := WmGew.platz_max_gewicht(platz)
	var ueber := max > 0.0 and gewicht > max
	var kurz := str(platz["kurz"]) if str(platz["kurz"]) != "" else "#%d" % int(platz["platzId"])
	_title(ort["lagerkennung"], "%s · Lagertechnik %s" % [ort["bezeichnung"], ort["lagertechnik"]])
	_info_row("Platz " + kurz, "Σ " + WmGew.fmt_de(total))
	_info_row("Last", WmGew.fmt_kg(gewicht) + (" / %s" % WmGew.fmt_kg(max) if max > 0.0 else ""), Color("#e74c3c") if ueber else Color("#e8ecf1"))
	if (platz["bestaende"] as Array).is_empty():
		var e := Label.new()
		e.text = "Keine Bestände auf diesem Platz"
		e.add_theme_color_override("font_color", Color("#9aa5b1"))
		_body.add_child(e)
	for b: Dictionary in platz["bestaende"]:
		var row := VBoxContainer.new()
		row.add_theme_constant_override("separation", 2)
		_body.add_child(row)
		var h := HBoxContainer.new()
		row.add_child(h)
		var art := Label.new()
		art.text = str(b["artikelnummer"])
		art.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(art)
		var menge := Label.new()
		menge.text = WmGew.fmt_de(b["bestand"])
		menge.add_theme_color_override("font_color", _bestand_color(float(b["bestand"])))
		h.add_child(menge)
		var bez := Label.new()
		bez.text = str(b["bezeichnung1"])
		bez.add_theme_color_override("font_color", Color("#9aa5b1"))
		row.add_child(bez)
		if float(b["gewicht"]) > 0.0:
			var g := Label.new()
			g.text = WmGew.fmt_kg(float(b["bestand"]) * float(b["gewicht"]))
			g.add_theme_color_override("font_color", Color("#9aa5b1"))
			row.add_child(g)


func _build_ort(ort: Dictionary) -> void:
	var rows := _ort_rows(ort)
	var gesamt := 0.0
	for r: Dictionary in rows:
		gesamt += float(r["bestand"])
	var belegt := 0
	var seen := {}
	for r: Dictionary in rows:
		if not seen.has(r["platzId"]):
			seen[r["platzId"]] = true
			belegt += 1
	var gewicht := WmGew.ort_gewicht(ort)
	var max := WmGew.ort_max_gewicht(ort)
	var ueber := max > 0.0 and gewicht > max
	_title(ort["lagerkennung"], "%s · Lagertechnik %s" % [ort["bezeichnung"], ort["lagertechnik"]])
	_info_row("%d Plätze · %d belegt" % [ort["plaetze"].size(), belegt], "Σ " + WmGew.fmt_de(gesamt))
	_info_row("Gesamtlast", WmGew.fmt_kg(gewicht) + (" / %s" % WmGew.fmt_kg(max) if max > 0.0 else ""), Color("#e74c3c") if ueber else Color("#e8ecf1"))
	_make_table(["Platz", "Artikel", "Bezeichnung", "Bestand"], rows, func(row: Dictionary) -> Array:
		return [str(row["platz"]), row["artikel"], row["bezeichnung"], WmGew.fmt_de(row["bestand"])]
	, func(_row: Dictionary) -> void:
		pass
	)


static func _ort_rows(ort: Dictionary) -> Array:
	var rows: Array = []
	for p: Dictionary in ort["plaetze"]:
		if (p["bestaende"] as Array).is_empty():
			continue
		for b: Dictionary in p["bestaende"]:
			rows.append({
				"platzId": p["platzId"],
				"platz": str(p["kurz"]) if str(p["kurz"]) != "" else "#%d" % int(p["platzId"]),
				"artikel": b["artikelnummer"],
				"bezeichnung": b["bezeichnung1"],
				"bestand": b["bestand"],
			})
	rows.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		if int(a["platzId"]) != int(b["platzId"]):
			return int(a["platzId"]) < int(b["platzId"])
		return str(a["artikel"]) < str(b["artikel"])
	)
	return rows


func _make_table(headers: Array, rows: Array, cell_of: Callable, on_click: Callable) -> void:
	var tree := Tree.new()
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.custom_minimum_size = Vector2(0, 160)
	tree.columns = headers.size()
	tree.hide_root = true
	tree.select_mode = Tree.SELECT_SINGLE
	for i in range(headers.size()):
		tree.set_column_title(i, str(headers[i]))
	for row: Dictionary in rows:
		var item := tree.create_item()
		var cells: Array = cell_of.call(row)
		for i in range(headers.size()):
			item.set_text(i, str(cells[i]))
		item.set_metadata(0, row)
	tree.item_activated.connect(func():
		var it := tree.get_selected()
		if it:
			on_click.call(it.get_metadata(0))
	)
	_body.add_child(tree)


static func _bestand_color(bestand: float) -> Color:
	if bestand < 100:
		return Color("#2ecc71")
	if bestand < 500:
		return Color("#e6b93c")
	return Color("#e74c3c")


# ---- Resize-Handle ---------------------------------------------------------

func _on_resize_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_drag = [event.global_position.x, _width]
		else:
			_drag = []
	elif event is InputEventMouseMotion and not _drag.is_empty():
		var new_w := clampf(_drag[1] + (_drag[0] - event.global_position.x), WIDTH_MIN, float(DisplayServer.window_get_size().x - 80))
		_width = new_w
		_panel.custom_minimum_size = Vector2(new_w, 0)
		WmPrefs.set_float(WIDTH_KEY, new_w)
