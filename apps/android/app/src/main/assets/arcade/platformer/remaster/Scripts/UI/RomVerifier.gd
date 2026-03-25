class_name ROMVerifier
extends Node

const VALID_HASHES := [
	"6a54024d5abe423b53338c9b418e0c2ffd86fed529556348e52ffca6f9b53b1a",
	"c9b34443c0414f3b91ef496d8cfee9fdd72405d673985afa11fb56732c96152b"
]

@onready var fallback_button: Button = %SelectRom

# implemented as per https://github.com/SeppNel/Godot-File-Picker/tree/main
var android_picker
var file_dialog: FileDialog
var using_android_picker := false

func haptic_feedback() -> void:
	Input.vibrate_handheld(3, 0.5)

func _ready() -> void:
	Global.get_node("GameHUD").hide()

	OnScreenControls.should_show = false
	if fallback_button and not fallback_button.pressed.is_connected(on_screen_tapped):
		fallback_button.pressed.connect(on_screen_tapped)
	file_dialog = get_node_or_null("FileDialog")
	if file_dialog == null:
		file_dialog = FileDialog.new()
		file_dialog.name = "FileDialog"
		file_dialog.file_mode = FileDialog.FILE_MODE_OPEN_FILE
		file_dialog.access = FileDialog.ACCESS_FILESYSTEM
		add_child(file_dialog)
	if not file_dialog.file_selected.is_connected(on_desktop_file_selected):
		file_dialog.file_selected.connect(on_desktop_file_selected)
	await get_tree().physics_frame
	android_picker = Engine.get_singleton("GodotFilePicker")
	using_android_picker = android_picker != null and android_picker.has_method("openFilePicker")
	if using_android_picker and android_picker.has_signal("file_picked"):
		if not android_picker.file_picked.is_connected(on_android_file_selected):
			android_picker.file_picked.connect(on_android_file_selected)
	if fallback_button:
		fallback_button.visible = not using_android_picker

func on_screen_tapped() -> void:
	haptic_feedback()
	if using_android_picker:
		android_picker.openFilePicker("*/*")
	elif file_dialog != null:
		file_dialog.popup_centered_ratio(0.85)
	else:
		extension_error("ROM picker unavailable on this runtime.")

func on_android_file_selected(temp_path: String, _mime_type: String) -> void:
	handle_rom(temp_path)
	if temp_path != "" and temp_path != Global.ROM_PATH:
		DirAccess.remove_absolute(temp_path)

func on_desktop_file_selected(path: String) -> void:
	handle_rom(path)

func handle_rom(path: String) -> bool:
	if path.get_extension() in ["zip", "7z", "rar", "tar", "gz", "gzip", "bz2"]:
		zip_error()
		return false
	if not is_valid_rom(path):
		if path.get_extension() in ["nes", "nez", "fds", "qd", "unf", "unif", "nsf", "nsfe"]:
			error()
		else: extension_error()
		return false
	#Global.rom_path = path # ??????
	Global.rom_path = Global.ROM_PATH
	copy_rom(path)
	verified()
	return true

func copy_rom(file_path: String) -> void:
	DirAccess.copy_absolute(file_path, Global.ROM_PATH)

static func get_hash(file_path: String) -> String:
	var file := FileAccess.open(file_path, FileAccess.READ)
	if not file:
		return ""
	var file_bytes := file.get_buffer(40976)
	var data := file_bytes.slice(16)
	return Marshalls.raw_to_base64(data).sha256_text()

static func is_valid_rom(rom_path := "") -> bool:
	return get_hash(rom_path) in VALID_HASHES


func error(message := "INVALID ROM HEADER!\n\nARE YOU SURE THIS IS A VANILLA ROM OF SMB1?") -> void:
	%Error.show()
	%Error.text = message
	%ZipError.hide()
	%ExtensionError.hide()
	$ErrorSFX.play()

func zip_error(message := "ERROR EXTRACTING ROM!\n\nENSURE YOUR ROM ISN'T STORED IN A COMPRESSED FILE FORMAT!") -> void:
	%ZipError.show()
	%ZipError.text = message
	%Error.hide()
	%ExtensionError.hide()
	$ErrorSFX.play()
	
func extension_error(message := "ERROR VERIFYING ROM!\n\nARE YOU SURE THIS IS A ROM IMAGE FILE?") -> void:
	%ExtensionError.show()
	%ExtensionError.text = message
	%Error.hide()
	%ZipError.hide()
	$ErrorSFX.play()

func verified() -> void:
	$BGM.queue_free()
	%DefaultText.queue_free()
	%SuccessMSG.show()
	$SuccessSFX.play()
	await get_tree().create_timer(3, false).timeout
	
	var target_scene := "res://Scenes/Levels/TitleScreen.tscn"
	if not Global.rom_assets_exist:
		target_scene = "res://Scenes/Levels/RomResourceGenerator.tscn"
	Global.transition_to_scene(target_scene)

func _exit_tree() -> void:
	Global.get_node("GameHUD").show()
	OnScreenControls.should_show = true
