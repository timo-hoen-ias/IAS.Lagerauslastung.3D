# Datenquelle: standardmaessig das deterministische Perf-Lager (keine DB noetig).
# Versucht zuerst den Bun-Server (?db=perf); bei Fehler offline generieren.
extends Node

const PerfGen = preload("res://src/core/perf_gen.gd")

signal data_ready(data: Dictionary, source: String)
signal notice(message: String)

const API_URL := "http://127.0.0.1:3001/api/lager?db=perf"


static func api_url() -> String:
	var raw := OS.get_environment("WM_API_URL")
	return raw if raw != "" else API_URL

var _http: HTTPRequest
var _fallback_orte := 100
var _fallback_seed := 42


func _ready() -> void:
	_http = HTTPRequest.new()
	add_child(_http)
	_http.timeout = 8.0
	_http.request_completed.connect(_on_completed)
	load_perf()


func load_perf() -> void:
	_fallback_orte = _env_int("PERF_ORTE", 100)
	_fallback_seed = _env_int("PERF_SEED", 42)
	var err := _http.request(api_url())
	if err != OK:
		notice.emit("HTTP-Fehler: %s" % error_string(err))
		_load_offline()


func _on_completed(result: int, response_code: int, _headers: PackedStringArray, body: PackedByteArray) -> void:
	if result != HTTPRequest.RESULT_SUCCESS or response_code != 200:
		notice.emit("Server nicht erreichbar (result=%d, http=%d) -> Offline-Perf-Lager" % [result, response_code])
		_load_offline()
		return
	var json := JSON.new()
	if json.parse(body.get_string_from_utf8()) != OK:
		notice.emit("JSON-Parse-Fehler -> Offline-Perf-Lager")
		_load_offline()
		return
	var data: Dictionary = json.data
	data_ready.emit(data, "server (?db=perf)")


func _load_offline() -> void:
	var data := PerfGen.generate_lager_daten(_fallback_orte, _fallback_seed)
	data_ready.emit(data, "offline perf-lager (seed=%d, orte=%d)" % [_fallback_seed, _fallback_orte])


func _env_int(name: String, fallback: int) -> int:
	var raw := OS.get_environment(name)
	return raw.to_int() if raw.is_valid_int() else fallback
