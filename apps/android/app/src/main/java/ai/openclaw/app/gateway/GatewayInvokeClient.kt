package ai.openclaw.app.gateway

import ai.openclaw.app.node.InvokeCommandAvailability
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID

data class GatewayInvokeCommandDescriptor(
  val command: String,
  val namespace: String,
  val title: String,
  val detail: String,
  val defaultParamsJson: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

data class GatewayInvokeExecutionResult(
  val invokeId: String,
  val command: String,
  val ok: Boolean,
  val payloadJson: String?,
  val error: GatewaySession.ErrorShape?,
)

object GatewayInvokeCatalog {
  val all: List<GatewayInvokeCommandDescriptor> =
    listOf(
      GatewayInvokeCommandDescriptor("canvas.present", "canvas", "Present Canvas", "Open the runtime canvas with a URL.", """{"url":"https://os.mawdbot.com"}""", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.hide", "canvas", "Hide Canvas", "Hide the runtime canvas surface.", "{}", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.navigate", "canvas", "Navigate Canvas", "Navigate the current canvas to a URL.", """{"url":"https://os.mawdbot.com"}""", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.eval", "canvas", "Eval JS", "Run JavaScript inside the canvas WebView.", """{"javaScript":"document.title"}""", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.snapshot", "canvas", "Canvas Snapshot", "Capture the canvas as base64 JPEG.", """{"format":"jpeg","quality":0.82,"maxWidth":1280}""", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.a2ui.push", "canvas.a2ui", "Push A2UI", "Push a single A2UI message.", """{"messages":[{"type":"assistant","text":"Bridge console ping"}]}""", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.a2ui.pushJSONL", "canvas.a2ui", "Push A2UI JSONL", "Push newline-delimited A2UI messages.", """{"jsonl":"{\"type\":\"assistant\",\"text\":\"Bridge console ping\"}"}""", requiresForeground = true),
      GatewayInvokeCommandDescriptor("canvas.a2ui.reset", "canvas.a2ui", "Reset A2UI", "Reset hydrated A2UI state.", "{}", requiresForeground = true),
      GatewayInvokeCommandDescriptor("system.notify", "system", "System Notify", "Post a local Android notification.", """{"title":"SolanaOS","body":"Bridge console test"}"""),
      GatewayInvokeCommandDescriptor("camera.list", "camera", "List Cameras", "Return available cameras.", "{}", requiresForeground = true, availability = InvokeCommandAvailability.CameraEnabled),
      GatewayInvokeCommandDescriptor("camera.snap", "camera", "Snap Camera", "Capture a single still image.", """{"cameraId":"back","flashMode":"off"}""", requiresForeground = true, availability = InvokeCommandAvailability.CameraEnabled),
      GatewayInvokeCommandDescriptor("camera.clip", "camera", "Record Clip", "Capture a short MP4 clip.", """{"cameraId":"back","durationMs":2500}""", requiresForeground = true, availability = InvokeCommandAvailability.CameraEnabled),
      GatewayInvokeCommandDescriptor("location.get", "location", "Get Location", "Read one location fix.", """{"desiredAccuracy":"balanced","timeoutMs":10000}""", availability = InvokeCommandAvailability.LocationEnabled),
      GatewayInvokeCommandDescriptor("device.status", "device", "Device Status", "Battery, thermal, memory, and network summary.", "{}"),
      GatewayInvokeCommandDescriptor("device.info", "device", "Device Info", "Static Android/app identity fields.", "{}"),
      GatewayInvokeCommandDescriptor("device.permissions", "device", "Permissions", "Permission grant state for device handlers.", "{}"),
      GatewayInvokeCommandDescriptor("device.health", "device", "Health", "Detailed battery, memory, and power state.", "{}"),
      GatewayInvokeCommandDescriptor("notifications.list", "notifications", "List Notifications", "Return active notification feed.", "{}"),
      GatewayInvokeCommandDescriptor("notifications.actions", "notifications", "Notification Action", "Open, dismiss, or reply to a notification.", """{"key":"notif-key","action":"open"}"""),
      GatewayInvokeCommandDescriptor("photos.latest", "photos", "Latest Photos", "Return recent photos from device storage.", """{"limit":1,"maxWidth":1600}"""),
      GatewayInvokeCommandDescriptor("contacts.search", "contacts", "Search Contacts", "Find matching contacts.", """{"query":"Solana"}"""),
      GatewayInvokeCommandDescriptor("contacts.add", "contacts", "Add Contact", "Insert a new contact.", """{"givenName":"SolanaOS","familyName":"Operator","phones":[{"label":"mobile","value":"+15555550123"}]}"""),
      GatewayInvokeCommandDescriptor("calendar.events", "calendar", "Calendar Events", "Read calendar events in a time range.", """{"startISO":"2026-03-22T00:00:00Z","endISO":"2026-03-23T00:00:00Z"}"""),
      GatewayInvokeCommandDescriptor("calendar.add", "calendar", "Add Calendar Event", "Create a calendar event.", """{"title":"Bridge Test","startISO":"2026-03-22T19:00:00Z","endISO":"2026-03-22T19:30:00Z"}"""),
      GatewayInvokeCommandDescriptor("motion.activity", "motion", "Motion Activity", "Classify motion activity from sensors.", "{}",
        availability = InvokeCommandAvailability.MotionActivityAvailable),
      GatewayInvokeCommandDescriptor("motion.pedometer", "motion", "Pedometer", "Return step-count samples.", """{"startISO":"2026-03-22T00:00:00Z","endISO":"2026-03-22T23:59:59Z"}""",
        availability = InvokeCommandAvailability.MotionPedometerAvailable),
      GatewayInvokeCommandDescriptor("sms.send", "sms", "Send SMS", "Send an SMS from the device.", """{"to":"+15555550123","message":"SolanaOS bridge test"}""",
        availability = InvokeCommandAvailability.SmsAvailable),
      GatewayInvokeCommandDescriptor("debug.logs", "debug", "Debug Logs", "Return debug log snapshots.", "{}", availability = InvokeCommandAvailability.DebugBuild),
      GatewayInvokeCommandDescriptor("debug.ed25519", "debug", "Debug Ed25519", "Run local signature diagnostics.", "{}", availability = InvokeCommandAvailability.DebugBuild),
    )

  private val byCommand: Map<String, GatewayInvokeCommandDescriptor> = all.associateBy { it.command }

  fun find(command: String): GatewayInvokeCommandDescriptor? = byCommand[command.trim()]
}

class GatewayInvokeClient(
  private val json: Json,
  private val requestDetailed: suspend (method: String, paramsJson: String?, timeoutMs: Long) -> GatewaySession.RequestResult,
  private val targetNodeId: () -> String?,
) {
  suspend fun invoke(
    command: String,
    paramsJson: String?,
    timeoutMs: Long = 15_000L,
  ): GatewayInvokeExecutionResult {
    val descriptor = GatewayInvokeCatalog.find(command)
      ?: throw IllegalArgumentException("Unknown invoke command: $command")
    val invokeId = UUID.randomUUID().toString()
    val parsedParams = parseParams(paramsJson)
    val payload =
      buildJsonObject {
        put("id", JsonPrimitive(invokeId))
        put("command", JsonPrimitive(descriptor.command))
        put("timeoutMs", JsonPrimitive(timeoutMs))
        targetNodeId()?.trim()?.takeIf { it.isNotEmpty() }?.let { put("nodeId", JsonPrimitive(it)) }
        when {
          parsedParams != null -> put("params", parsedParams)
          !paramsJson.isNullOrBlank() -> put("paramsJSON", JsonPrimitive(paramsJson))
          else -> put("params", JsonNull)
        }
      }
    val response = requestDetailed("node.invoke.request", payload.toString(), timeoutMs + 2_000L)
    return GatewayInvokeExecutionResult(
      invokeId = invokeId,
      command = descriptor.command,
      ok = response.ok,
      payloadJson = response.payloadJson,
      error = response.error,
    )
  }

  private fun parseParams(raw: String?): JsonElement? {
    val trimmed = raw?.trim().orEmpty()
    if (trimmed.isEmpty()) return null
    return try {
      json.parseToJsonElement(trimmed)
    } catch (_: Throwable) {
      null
    }
  }
}
