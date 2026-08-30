# Integrationstool: vergleicht Offline-Perf-Lager (100 Orte, Seed 42) mit Server-JSON.
# Aufruf: godot --headless -s res://tests/compare_server.gd -- /tmp/lager.json
extends SceneTree

const PerfGen = preload("res://src/core/perf_gen.gd")


func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		print("Aufruf: godot --headless -s res://tests/compare_server.gd -- <lager.json>")
		quit(1)
		return
	var f := FileAccess.open(args[0], FileAccess.READ)
	if f == null:
		print("Datei nicht lesbar: ", args[0])
		quit(1)
		return
	var json := JSON.new()
	if json.parse(f.get_as_text()) != OK:
		print("JSON-Fehler")
		quit(1)
		return
	var server: Dictionary = json.data
	var offline := PerfGen.generate_lager_daten(100, 42)
	var cs := _checksum(server)
	var co := _checksum(offline)
	print("Server : ", cs)
	print("Offline: ", co)
	if cs == co:
		print("IDENTISCH")
		quit(0)
	else:
		print("ABWEICHUNG")
		quit(2)


func _checksum(data: Dictionary) -> String:
	var parts: Array = []
	for ort: Dictionary in data["lagerorte"]:
		var pstr: Array = []
		for p: Dictionary in ort["plaetze"]:
			var bstr: Array = []
			for b: Dictionary in p["bestaende"]:
				bstr.append("%s:%d" % [str(b["artikelnummer"]), int(b["bestand"])])
			bstr.sort()
			pstr.append("%d|%s" % [int(p["platzId"]), "|".join(bstr)])
		pstr.sort()
		parts.append("%s:%s" % [ort["lagerkennung"], ",".join(pstr)])
	parts.sort()
	return "mandant=%d;%s" % [int(data["mandant"]), "&".join(parts)]
