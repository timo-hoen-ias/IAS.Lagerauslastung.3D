# Live-Buchungen: WebSocket zum Bun-Server (/api/buchung/ws) mit Reconnect.
extends Node

signal buchung_received(event: Dictionary)
signal state_changed(state: String)

const WS_URL := "ws://127.0.0.1:3001/api/buchung/ws"
const RETRY_MIN_MS := 1500
const RETRY_MAX_MS := 15000


static func ws_url() -> String:
	var raw := OS.get_environment("WM_WS_URL")
	return raw if raw != "" else WS_URL

var _socket := WebSocketPeer.new()
var _connected := false
var _retry_ms := RETRY_MIN_MS
var _retry := 0.0


func _ready() -> void:
	_connect()


func _connect() -> void:
	if _socket.get_ready_state() != WebSocketPeer.STATE_CLOSED:
		_socket.close()
	_socket = WebSocketPeer.new()
	var err := _socket.connect_to_url(ws_url())
	state_changed.emit("ws: verbinde…" if err == OK else "ws: Verbindung fehlgeschlagen")


func _process(delta: float) -> void:
	var st := _socket.get_ready_state()
	if st == WebSocketPeer.STATE_OPEN:
		_socket.poll()
		while _socket.get_available_packet_count() > 0:
			_handle_packet(_socket.get_packet())
		if not _connected:
			_connected = true
			_retry_ms = RETRY_MIN_MS
			state_changed.emit("ws: verbunden")
	elif st == WebSocketPeer.STATE_CLOSED:
		if _connected:
			_connected = false
			state_changed.emit("ws: getrennt")
		_retry -= delta
		if _retry <= 0.0:
			_retry = float(_retry_ms) / 1000.0
			_retry_ms = mini(_retry_ms * 2, RETRY_MAX_MS)
			_connect()


func is_connected_ws() -> bool:
	return _connected


func _handle_packet(bytes: PackedByteArray) -> void:
	var json := JSON.new()
	if json.parse(bytes.get_string_from_utf8()) != OK:
		return
	var msg: Dictionary = json.data
	match str(msg.get("type", "")):
		"event":
			var evt: Variant = msg.get("event")
			if evt is Dictionary:
				buchung_received.emit(evt)
		"replay":
			for e: Variant in msg.get("events", []):
				if e is Dictionary:
					buchung_received.emit(e)
