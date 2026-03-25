package ai.openclaw.app.protocol

interface OpenClawWireValue {
  val rawValue: String
}

private inline fun <reified T> parseOpenClawWireValue(raw: String?): T?
  where T : Enum<T>,
        T : OpenClawWireValue {
  val normalized = raw?.trim().orEmpty()
  if (normalized.isEmpty()) return null
  return enumValues<T>().firstOrNull { it.rawValue == normalized }
}

private inline fun <reified T> openClawRawValues(): Set<String>
  where T : Enum<T>,
        T : OpenClawWireValue = enumValues<T>().mapTo(linkedSetOf()) { it.rawValue }

enum class OpenClawCapability(override val rawValue: String) : OpenClawWireValue {
  Canvas("canvas"),
  Camera("camera"),
  Sms("sms"),
  VoiceWake("voiceWake"),
  Location("location"),
  Device("device"),
  Notifications("notifications"),
  System("system"),
  Photos("photos"),
  Contacts("contacts"),
  Calendar("calendar"),
  Motion("motion"),
  ;

  companion object {
    fun fromRaw(raw: String?): OpenClawCapability? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawCapability>()
  }
}

enum class OpenClawCanvasCommand(override val rawValue: String) : OpenClawWireValue {
  Present("canvas.present"),
  Hide("canvas.hide"),
  Navigate("canvas.navigate"),
  Eval("canvas.eval"),
  Snapshot("canvas.snapshot"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas."

    fun fromRaw(raw: String?): OpenClawCanvasCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawCanvasCommand>()
  }
}

enum class OpenClawCanvasA2UICommand(override val rawValue: String) : OpenClawWireValue {
  Push("canvas.a2ui.push"),
  PushJSONL("canvas.a2ui.pushJSONL"),
  Reset("canvas.a2ui.reset"),
  ;

  companion object {
    const val NamespacePrefix: String = "canvas.a2ui."

    fun fromRaw(raw: String?): OpenClawCanvasA2UICommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawCanvasA2UICommand>()
  }
}

enum class OpenClawCameraCommand(override val rawValue: String) : OpenClawWireValue {
  List("camera.list"),
  Snap("camera.snap"),
  Clip("camera.clip"),
  ;

  companion object {
    const val NamespacePrefix: String = "camera."

    fun fromRaw(raw: String?): OpenClawCameraCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawCameraCommand>()
  }
}

enum class OpenClawSmsCommand(override val rawValue: String) : OpenClawWireValue {
  Send("sms.send"),
  ;

  companion object {
    const val NamespacePrefix: String = "sms."

    fun fromRaw(raw: String?): OpenClawSmsCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawSmsCommand>()
  }
}

enum class OpenClawLocationCommand(override val rawValue: String) : OpenClawWireValue {
  Get("location.get"),
  ;

  companion object {
    const val NamespacePrefix: String = "location."

    fun fromRaw(raw: String?): OpenClawLocationCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawLocationCommand>()
  }
}

enum class OpenClawDeviceCommand(override val rawValue: String) : OpenClawWireValue {
  Status("device.status"),
  Info("device.info"),
  Permissions("device.permissions"),
  Health("device.health"),
  ;

  companion object {
    const val NamespacePrefix: String = "device."

    fun fromRaw(raw: String?): OpenClawDeviceCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawDeviceCommand>()
  }
}

enum class OpenClawNotificationsCommand(override val rawValue: String) : OpenClawWireValue {
  List("notifications.list"),
  Actions("notifications.actions"),
  ;

  companion object {
    const val NamespacePrefix: String = "notifications."

    fun fromRaw(raw: String?): OpenClawNotificationsCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawNotificationsCommand>()
  }
}

enum class OpenClawSystemCommand(override val rawValue: String) : OpenClawWireValue {
  Notify("system.notify"),
  ;

  companion object {
    const val NamespacePrefix: String = "system."

    fun fromRaw(raw: String?): OpenClawSystemCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawSystemCommand>()
  }
}

enum class OpenClawPhotosCommand(override val rawValue: String) : OpenClawWireValue {
  Latest("photos.latest"),
  ;

  companion object {
    const val NamespacePrefix: String = "photos."

    fun fromRaw(raw: String?): OpenClawPhotosCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawPhotosCommand>()
  }
}

enum class OpenClawContactsCommand(override val rawValue: String) : OpenClawWireValue {
  Search("contacts.search"),
  Add("contacts.add"),
  ;

  companion object {
    const val NamespacePrefix: String = "contacts."

    fun fromRaw(raw: String?): OpenClawContactsCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawContactsCommand>()
  }
}

enum class OpenClawCalendarCommand(override val rawValue: String) : OpenClawWireValue {
  Events("calendar.events"),
  Add("calendar.add"),
  ;

  companion object {
    const val NamespacePrefix: String = "calendar."

    fun fromRaw(raw: String?): OpenClawCalendarCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawCalendarCommand>()
  }
}

enum class OpenClawMotionCommand(override val rawValue: String) : OpenClawWireValue {
  Activity("motion.activity"),
  Pedometer("motion.pedometer"),
  ;

  companion object {
    const val NamespacePrefix: String = "motion."

    fun fromRaw(raw: String?): OpenClawMotionCommand? = parseOpenClawWireValue(raw)

    val allRawValues: Set<String> = openClawRawValues<OpenClawMotionCommand>()
  }
}
