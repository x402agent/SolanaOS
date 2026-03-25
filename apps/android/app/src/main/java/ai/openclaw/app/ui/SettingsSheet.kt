package ai.openclaw.app.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ai.openclaw.app.BuildConfig
import ai.openclaw.app.LocationMode
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.node.DeviceNotificationListenerService

@Composable
fun SettingsSheet(viewModel: MainViewModel) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  val instanceId by viewModel.instanceId.collectAsState()
  val displayName by viewModel.displayName.collectAsState()
  val cameraEnabled by viewModel.cameraEnabled.collectAsState()
  val locationMode by viewModel.locationMode.collectAsState()
  val locationPreciseEnabled by viewModel.locationPreciseEnabled.collectAsState()
  val preventSleep by viewModel.preventSleep.collectAsState()
  val autoStartOnBoot by viewModel.autoStartOnBoot.collectAsState()
  val canvasDebugStatusEnabled by viewModel.canvasDebugStatusEnabled.collectAsState()
  val openRouterApiKey by viewModel.openRouterApiKey.collectAsState()
  val openRouterModel by viewModel.openRouterModel.collectAsState()
  val chatOpenRouterAvailable by viewModel.chatOpenRouterAvailable.collectAsState()
  val chatStatusText by viewModel.chatStatusText.collectAsState()
  val gatewayConnected by viewModel.isConnected.collectAsState()
  val gatewayStatusText by viewModel.statusText.collectAsState()
  val grokConfigured by viewModel.grokConfigured.collectAsState()
  val grokStatusText by viewModel.grokStatusText.collectAsState()
  val convexConfigured by viewModel.convexConfigured.collectAsState()
  val convexHealth by viewModel.convexHealth.collectAsState()
  val convexStatusText by viewModel.convexStatusText.collectAsState()
  val canvasUrl by viewModel.canvasCurrentUrl.collectAsState()
  val canvasHydrated by viewModel.canvasA2uiHydrated.collectAsState()
  val bitaxeBaseUrl by viewModel.bitaxeResolvedBaseUrl.collectAsState()
  val bitaxeStatusText by viewModel.bitaxeStatusText.collectAsState()
  val solanaTrackerConfigured by viewModel.solanaTrackerConfigured.collectAsState()
  val solanaTrackerStatusText by viewModel.solanaTrackerStatusText.collectAsState()

  val listState = rememberLazyListState()
  val deviceModel =
    remember {
      listOfNotNull(Build.MANUFACTURER, Build.MODEL)
        .joinToString(" ")
        .trim()
        .ifEmpty { "Android" }
    }
  val appVersion =
    remember {
      val versionName = BuildConfig.VERSION_NAME.trim().ifEmpty { "dev" }
      if (BuildConfig.DEBUG && !versionName.contains("dev", ignoreCase = true)) {
        "$versionName-dev"
      } else {
        versionName
      }
    }
  val listItemColors =
    ListItemDefaults.colors(
      containerColor = Color.Transparent,
      headlineColor = mobileText,
      supportingColor = mobileTextSecondary,
      trailingIconColor = mobileTextSecondary,
      leadingIconColor = mobileTextSecondary,
    )
  var openRouterApiKeyInput by remember(openRouterApiKey) { mutableStateOf(openRouterApiKey) }
  var openRouterModelInput by remember(openRouterModel) { mutableStateOf(openRouterModel.ifBlank { BuildConfig.OPENROUTER_MODEL }) }

  val permissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
      val cameraOk = perms[Manifest.permission.CAMERA] == true
      viewModel.setCameraEnabled(cameraOk)
    }

  var pendingLocationRequest by remember { mutableStateOf(false) }
  var pendingPreciseToggle by remember { mutableStateOf(false) }

  val locationPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
      val fineOk = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true
      val coarseOk = perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
      val granted = fineOk || coarseOk

      if (pendingPreciseToggle) {
        pendingPreciseToggle = false
        viewModel.setLocationPreciseEnabled(fineOk)
        return@rememberLauncherForActivityResult
      }

      if (pendingLocationRequest) {
        pendingLocationRequest = false
        viewModel.setLocationMode(if (granted) LocationMode.WhileUsing else LocationMode.Off)
      }
    }

  var micPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val audioPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      micPermissionGranted = granted
    }

  val smsPermissionAvailable =
    remember {
      context.packageManager?.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) == true
    }
  val photosPermission =
    if (Build.VERSION.SDK_INT >= 33) {
      Manifest.permission.READ_MEDIA_IMAGES
    } else {
      Manifest.permission.READ_EXTERNAL_STORAGE
    }
  val motionPermissionRequired = true
  val motionAvailable = remember(context) { hasMotionCapabilities(context) }

  var notificationsPermissionGranted by
    remember {
      mutableStateOf(hasNotificationsPermission(context))
    }
  val notificationsPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      notificationsPermissionGranted = granted
    }

  var notificationListenerEnabled by
    remember {
      mutableStateOf(isNotificationListenerEnabled(context))
    }

  var photosPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, photosPermission) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val photosPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      photosPermissionGranted = granted
    }

  var contactsPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) ==
          PackageManager.PERMISSION_GRANTED &&
          ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CONTACTS) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val contactsPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
      val readOk = perms[Manifest.permission.READ_CONTACTS] == true
      val writeOk = perms[Manifest.permission.WRITE_CONTACTS] == true
      contactsPermissionGranted = readOk && writeOk
    }

  var calendarPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) ==
          PackageManager.PERMISSION_GRANTED &&
          ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val calendarPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { perms ->
      val readOk = perms[Manifest.permission.READ_CALENDAR] == true
      val writeOk = perms[Manifest.permission.WRITE_CALENDAR] == true
      calendarPermissionGranted = readOk && writeOk
    }

  var motionPermissionGranted by
    remember {
      mutableStateOf(
        !motionPermissionRequired ||
          ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val motionPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      motionPermissionGranted = granted
    }

  var smsPermissionGranted by
    remember {
      mutableStateOf(
        ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) ==
          PackageManager.PERMISSION_GRANTED,
      )
    }
  val smsPermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      smsPermissionGranted = granted
      viewModel.refreshGatewayConnection()
    }
  val runtimeReadyCount =
    listOf(
      gatewayConnected,
      grokConfigured,
      convexConfigured,
      solanaTrackerConfigured,
      canvasHydrated || !canvasUrl.isNullOrBlank(),
    ).count { it }
  val capabilityChecks =
    listOf(
      cameraEnabled,
      micPermissionGranted,
      notificationsPermissionGranted,
      notificationListenerEnabled,
      photosPermissionGranted,
      contactsPermissionGranted,
      calendarPermissionGranted,
      if (motionAvailable) motionPermissionGranted else false,
      if (smsPermissionAvailable) smsPermissionGranted else false,
      locationMode != LocationMode.Off,
    )
  val grantedCapabilityCount = capabilityChecks.count { it }
  val locationStateLabel =
    when {
      locationMode == LocationMode.Off -> "Off"
      locationPreciseEnabled -> "Precise"
      else -> "While Using"
    }

  DisposableEffect(lifecycleOwner, context) {
    val observer =
      LifecycleEventObserver { _, event ->
        if (event == Lifecycle.Event.ON_RESUME) {
          micPermissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
              PackageManager.PERMISSION_GRANTED
          notificationsPermissionGranted = hasNotificationsPermission(context)
          notificationListenerEnabled = isNotificationListenerEnabled(context)
          photosPermissionGranted =
            ContextCompat.checkSelfPermission(context, photosPermission) ==
              PackageManager.PERMISSION_GRANTED
          contactsPermissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) ==
              PackageManager.PERMISSION_GRANTED &&
              ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CONTACTS) ==
              PackageManager.PERMISSION_GRANTED
          calendarPermissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALENDAR) ==
              PackageManager.PERMISSION_GRANTED &&
              ContextCompat.checkSelfPermission(context, Manifest.permission.WRITE_CALENDAR) ==
              PackageManager.PERMISSION_GRANTED
          motionPermissionGranted =
            !motionPermissionRequired ||
              ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) ==
              PackageManager.PERMISSION_GRANTED
          smsPermissionGranted =
            ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) ==
              PackageManager.PERMISSION_GRANTED
        }
      }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
  }

  fun setCameraEnabledChecked(checked: Boolean) {
    if (!checked) {
      viewModel.setCameraEnabled(false)
      return
    }

    val cameraOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED
    if (cameraOk) {
      viewModel.setCameraEnabled(true)
    } else {
      permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
    }
  }

  fun requestLocationPermissions() {
    val fineOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarseOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (fineOk || coarseOk) {
      viewModel.setLocationMode(LocationMode.WhileUsing)
    } else {
      pendingLocationRequest = true
      locationPermissionLauncher.launch(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
      )
    }
  }

  fun setPreciseLocationChecked(checked: Boolean) {
    if (!checked) {
      viewModel.setLocationPreciseEnabled(false)
      return
    }
    val fineOk =
      ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (fineOk) {
      viewModel.setLocationPreciseEnabled(true)
    } else {
      pendingPreciseToggle = true
      locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION))
    }
  }

  Box(
    modifier =
      Modifier
        .fillMaxSize()
        .background(mobileBackgroundGradient),
  ) {
    LazyColumn(
      state = listState,
      modifier =
        Modifier
          .fillMaxWidth()
          .fillMaxHeight()
          .imePadding()
          .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Bottom)),
      contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      item {
        SolanaHeroTitle(
          eyebrow = "System",
          title = "Device Configuration",
          subtitle = "Manage capabilities, backend readiness, permissions, and diagnostics without hunting through individual toggles.",
        )
      }
      item {
        SolanaBackplaneCard(
          title = "Service Health",
          subtitle = "These services support pairing, chat, market data, dashboard sync, and device tools.",
          links =
            listOf(
              SolanaBackendLink(
                label = "Gateway",
                state = if (gatewayConnected) "Online" else "Offline",
                detail = gatewayStatusText,
                tone = SolanaPanelTone.Green,
                active = gatewayConnected,
              ),
              SolanaBackendLink(
                label = "Chat Runtime",
                state = if (gatewayConnected) "Ready" else "Waiting",
                detail = chatStatusText,
                tone = SolanaPanelTone.Purple,
                active = gatewayConnected,
              ),
              SolanaBackendLink(
                label = "Grok / xAI",
                state = if (grokConfigured) "Ready" else "Missing",
                detail = grokStatusText,
                tone = SolanaPanelTone.Orange,
                active = grokConfigured,
              ),
              SolanaBackendLink(
                label = "Convex",
                state = if (convexConfigured) "Enabled" else "Missing",
                detail = convexStatusText,
                tone = SolanaPanelTone.Green,
                active = convexConfigured,
              ),
              SolanaBackendLink(
                label = "Tracker",
                state = if (solanaTrackerConfigured) "Ready" else "Missing",
                detail = solanaTrackerStatusText,
                tone = SolanaPanelTone.Purple,
                active = solanaTrackerConfigured,
              ),
              SolanaBackendLink(
                label = "Canvas",
                state = if (canvasHydrated) "Hydrated" else if (canvasUrl.isNullOrBlank()) "Idle" else "Loaded",
                detail = if (canvasHydrated) "Dashboard screen is ready." else "Dashboard screen is waiting for live content.",
                tone = SolanaPanelTone.Orange,
                active = canvasHydrated || !canvasUrl.isNullOrBlank(),
              ),
              SolanaBackendLink(
                label = "Bitaxe API",
                state = if (bitaxeBaseUrl.isNotBlank()) "Bound" else "Auto",
                detail = if (bitaxeBaseUrl.isNotBlank()) bitaxeStatusText else "The miner service follows the paired workspace until you choose a custom endpoint.",
                tone = SolanaPanelTone.Purple,
                active = bitaxeBaseUrl.isNotBlank(),
              ),
            ),
          tone = SolanaPanelTone.Purple,
        )
      }
      item {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          SolanaMetricTile(
            label = "Links",
            value = "$runtimeReadyCount/5",
            tone = SolanaPanelTone.Green,
            modifier = Modifier.weight(1f),
          )
          SolanaMetricTile(
            label = "Capabilities",
            value = "$grantedCapabilityCount/${capabilityChecks.size}",
            tone = SolanaPanelTone.Purple,
            modifier = Modifier.weight(1f),
          )
          SolanaMetricTile(
            label = "Location",
            value = locationStateLabel,
            tone = SolanaPanelTone.Orange,
            modifier = Modifier.weight(1f),
          )
        }
      }
      item {
        SolanaBackplaneCard(
          title = "Capability Readiness",
          subtitle = "These are the native permissions and device surfaces the runtime can actually use right now.",
          links =
            listOf(
              SolanaBackendLink(
                label = "Voice",
                state = if (micPermissionGranted) "Granted" else "Missing",
                detail = if (micPermissionGranted) "Foreground voice capture is available." else "Microphone access is still blocked.",
                tone = SolanaPanelTone.Green,
                active = micPermissionGranted,
              ),
              SolanaBackendLink(
                label = "Camera",
                state = if (cameraEnabled) "Enabled" else "Disabled",
                detail = if (cameraEnabled) "Gateway photo and short clip capture can run in foreground." else "Camera tools are currently turned off.",
                tone = SolanaPanelTone.Orange,
                active = cameraEnabled,
              ),
              SolanaBackendLink(
                label = "Notifications",
                state =
                  when {
                    notificationsPermissionGranted && notificationListenerEnabled -> "Full Access"
                    notificationsPermissionGranted || notificationListenerEnabled -> "Partial"
                    else -> "Missing"
                  },
                detail = "Post notifications: ${if (notificationsPermissionGranted) "granted" else "missing"} · Listener: ${if (notificationListenerEnabled) "enabled" else "disabled"}",
                tone = SolanaPanelTone.Purple,
                active = notificationsPermissionGranted && notificationListenerEnabled,
              ),
              SolanaBackendLink(
                label = "Data Access",
                state =
                  "${listOf(photosPermissionGranted, contactsPermissionGranted, calendarPermissionGranted).count { it }}/3",
                detail =
                  "Photos ${if (photosPermissionGranted) "ready" else "blocked"} · Contacts ${if (contactsPermissionGranted) "ready" else "blocked"} · Calendar ${if (calendarPermissionGranted) "ready" else "blocked"}",
                tone = SolanaPanelTone.Green,
                active = photosPermissionGranted || contactsPermissionGranted || calendarPermissionGranted,
              ),
              SolanaBackendLink(
                label = "Location",
                state = locationStateLabel,
                detail =
                  if (locationMode == LocationMode.Off) {
                    "Location sharing is disabled."
                  } else if (locationPreciseEnabled) {
                    "Foreground location is enabled with precise GPS when available."
                  } else {
                    "Foreground location is enabled with balanced accuracy."
                  },
                tone = SolanaPanelTone.Orange,
                active = locationMode != LocationMode.Off,
              ),
            ),
          tone = SolanaPanelTone.Green,
        )
      }
      item { HorizontalDivider(color = mobileBorder) }

    // Order parity: Node → Voice → Camera → Messaging → Location → Screen.
      item {
        Text(
          "NODE",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
    item {
      OutlinedTextField(
        value = displayName,
        onValueChange = viewModel::setDisplayName,
        label = { Text("Name", style = mobileCaption1, color = mobileTextSecondary) },
        modifier = Modifier.fillMaxWidth(),
        textStyle = mobileBody.copy(color = mobileText),
        colors = settingsTextFieldColors(),
      )
    }
      item { Text("Instance ID: $instanceId", style = mobileCallout.copy(fontFamily = FontFamily.Monospace), color = mobileTextSecondary) }
      item { Text("Device: $deviceModel", style = mobileCallout, color = mobileTextSecondary) }
      item { Text("Version: $appVersion", style = mobileCallout, color = mobileTextSecondary) }
      item {
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Start on Boot", style = mobileHeadline) },
          supportingContent = {
            Text(
              "Automatically restore the SolanaOS foreground service after the device reboots once onboarding is complete.",
              style = mobileCallout,
            )
          },
          trailingContent = {
            Switch(
              checked = autoStartOnBoot,
              onCheckedChange = viewModel::setAutoStartOnBoot,
            )
          },
        )
      }

      item { HorizontalDivider(color = mobileBorder) }
      item { HorizontalDivider(color = mobileBorder) }

      // Voice
      item {
        Text(
          "VOICE",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
      item {
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Microphone permission", style = mobileHeadline) },
          supportingContent = {
            Text(
              if (micPermissionGranted) {
                "Granted. Use the Voice tab mic button to capture transcript while the app is open."
              } else {
                "Required for foreground Voice tab transcription."
              },
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = {
                if (micPermissionGranted) {
                  openAppSettings(context)
                } else {
                  audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
              },
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(
                if (micPermissionGranted) "Manage" else "Grant",
                style = mobileCallout.copy(fontWeight = FontWeight.Bold),
              )
            }
          },
        )
      }
      item {
        Text(
          "Voice wake and talk modes were removed. Voice now uses one mic on/off flow in the Voice tab while the app is open.",
          style = mobileCallout,
          color = mobileTextSecondary,
        )
      }

      item { HorizontalDivider(color = mobileBorder) }

    // Camera
      item {
        Text(
          "CAMERA",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
    item {
      ListItem(
        modifier = Modifier.settingsRowModifier(),
        colors = listItemColors,
        headlineContent = { Text("Allow Camera", style = mobileHeadline) },
        supportingContent = { Text("Allows the gateway to request photos or short video clips (foreground only).", style = mobileCallout) },
        trailingContent = { Switch(checked = cameraEnabled, onCheckedChange = ::setCameraEnabledChecked) },
      )
    }
    item {
      Text(
        "Tip: grant Microphone permission for video clips with audio.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )
    }

      item { HorizontalDivider(color = mobileBorder) }

    // Messaging
      item {
        Text(
          "MESSAGING",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
    item {
      val buttonLabel =
        when {
          !smsPermissionAvailable -> "Unavailable"
          smsPermissionGranted -> "Manage"
          else -> "Grant"
        }
      ListItem(
        modifier = Modifier.settingsRowModifier(),
        colors = listItemColors,
        headlineContent = { Text("SMS Permission", style = mobileHeadline) },
        supportingContent = {
          Text(
            if (smsPermissionAvailable) {
              "Allow the gateway to send SMS from this device."
            } else {
              "SMS requires a device with telephony hardware."
            },
            style = mobileCallout,
          )
        },
        trailingContent = {
          Button(
            onClick = {
              if (!smsPermissionAvailable) return@Button
              if (smsPermissionGranted) {
                openAppSettings(context)
              } else {
                smsPermissionLauncher.launch(Manifest.permission.SEND_SMS)
              }
            },
            enabled = smsPermissionAvailable,
            colors = settingsPrimaryButtonColors(),
            shape = RoundedCornerShape(14.dp),
          ) {
            Text(buttonLabel, style = mobileCallout.copy(fontWeight = FontWeight.Bold))
          }
        },
      )
    }

      item { HorizontalDivider(color = mobileBorder) }

    // Notifications
      item {
        Text(
          "NOTIFICATIONS",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
      item {
        val buttonLabel =
          if (notificationsPermissionGranted) {
            "Manage"
          } else {
            "Grant"
          }
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("System Notifications", style = mobileHeadline) },
          supportingContent = {
            Text(
              "Required for `system.notify` and Android foreground service alerts.",
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = {
                if (notificationsPermissionGranted || Build.VERSION.SDK_INT < 33) {
                  openAppSettings(context)
                } else {
                  notificationsPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
              },
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(buttonLabel, style = mobileCallout.copy(fontWeight = FontWeight.Bold))
            }
          },
        )
      }
      item {
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Notification Listener Access", style = mobileHeadline) },
          supportingContent = {
            Text(
              "Required for `notifications.list` and `notifications.actions`.",
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = { openNotificationListenerSettings(context) },
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(
                if (notificationListenerEnabled) "Manage" else "Enable",
                style = mobileCallout.copy(fontWeight = FontWeight.Bold),
              )
            }
          },
        )
      }
      item { HorizontalDivider(color = mobileBorder) }

    // Data access
      item {
        Text(
          "DATA ACCESS",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
      item {
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Photos Permission", style = mobileHeadline) },
          supportingContent = {
            Text(
              "Required for `photos.latest`.",
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = {
                if (photosPermissionGranted) {
                  openAppSettings(context)
                } else {
                  photosPermissionLauncher.launch(photosPermission)
                }
              },
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(
                if (photosPermissionGranted) "Manage" else "Grant",
                style = mobileCallout.copy(fontWeight = FontWeight.Bold),
              )
            }
          },
        )
      }
      item {
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Contacts Permission", style = mobileHeadline) },
          supportingContent = {
            Text(
              "Required for `contacts.search` and `contacts.add`.",
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = {
                if (contactsPermissionGranted) {
                  openAppSettings(context)
                } else {
                  contactsPermissionLauncher.launch(arrayOf(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS))
                }
              },
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(
                if (contactsPermissionGranted) "Manage" else "Grant",
                style = mobileCallout.copy(fontWeight = FontWeight.Bold),
              )
            }
          },
        )
      }
      item {
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Calendar Permission", style = mobileHeadline) },
          supportingContent = {
            Text(
              "Required for `calendar.events` and `calendar.add`.",
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = {
                if (calendarPermissionGranted) {
                  openAppSettings(context)
                } else {
                  calendarPermissionLauncher.launch(arrayOf(Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR))
                }
              },
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(
                if (calendarPermissionGranted) "Manage" else "Grant",
                style = mobileCallout.copy(fontWeight = FontWeight.Bold),
              )
            }
          },
        )
      }
      item {
        val motionButtonLabel =
          when {
            !motionAvailable -> "Unavailable"
            !motionPermissionRequired -> "Manage"
            motionPermissionGranted -> "Manage"
            else -> "Grant"
          }
        ListItem(
          modifier = Modifier.settingsRowModifier(),
          colors = listItemColors,
          headlineContent = { Text("Motion Permission", style = mobileHeadline) },
          supportingContent = {
            Text(
              if (!motionAvailable) {
                "This device does not expose accelerometer or step-counter motion sensors."
              } else {
                "Required for `motion.activity` and `motion.pedometer`."
              },
              style = mobileCallout,
            )
          },
          trailingContent = {
            Button(
              onClick = {
                if (!motionAvailable) return@Button
                if (!motionPermissionRequired || motionPermissionGranted) {
                  openAppSettings(context)
                } else {
                  motionPermissionLauncher.launch(Manifest.permission.ACTIVITY_RECOGNITION)
                }
              },
              enabled = motionAvailable,
              colors = settingsPrimaryButtonColors(),
              shape = RoundedCornerShape(14.dp),
            ) {
              Text(motionButtonLabel, style = mobileCallout.copy(fontWeight = FontWeight.Bold))
            }
          },
        )
      }
      item { HorizontalDivider(color = mobileBorder) }

    // Location
      item {
        Text(
          "LOCATION",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
      item {
        Column(modifier = Modifier.settingsRowModifier(), verticalArrangement = Arrangement.spacedBy(0.dp)) {
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            colors = listItemColors,
            headlineContent = { Text("Off", style = mobileHeadline) },
            supportingContent = { Text("Disable location sharing.", style = mobileCallout) },
            trailingContent = {
              RadioButton(
                selected = locationMode == LocationMode.Off,
                onClick = { viewModel.setLocationMode(LocationMode.Off) },
              )
            },
          )
          HorizontalDivider(color = mobileBorder)
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            colors = listItemColors,
            headlineContent = { Text("While Using", style = mobileHeadline) },
            supportingContent = { Text("Only while SolanaOS is open.", style = mobileCallout) },
            trailingContent = {
              RadioButton(
                selected = locationMode == LocationMode.WhileUsing,
                onClick = { requestLocationPermissions() },
              )
            },
          )
          HorizontalDivider(color = mobileBorder)
          ListItem(
            modifier = Modifier.fillMaxWidth(),
            colors = listItemColors,
            headlineContent = { Text("Precise Location", style = mobileHeadline) },
            supportingContent = { Text("Use precise GPS when available.", style = mobileCallout) },
            trailingContent = {
              Switch(
                checked = locationPreciseEnabled,
                onCheckedChange = ::setPreciseLocationChecked,
                enabled = locationMode != LocationMode.Off,
              )
            },
          )
        }
      }
      item { HorizontalDivider(color = mobileBorder) }

    // Screen
      item {
        Text(
          "SCREEN",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
          color = mobileAccent,
        )
      }
    item {
      ListItem(
        modifier = Modifier.settingsRowModifier(),
        colors = listItemColors,
        headlineContent = { Text("Prevent Sleep", style = mobileHeadline) },
        supportingContent = { Text("Keeps the screen awake while SolanaOS is open.", style = mobileCallout) },
        trailingContent = { Switch(checked = preventSleep, onCheckedChange = viewModel::setPreventSleep) },
      )
    }

      item { HorizontalDivider(color = mobileBorder) }

      if (BuildConfig.DEBUG) {
        item {
          Text(
            "DEBUG",
            style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.sp),
            color = mobileAccent,
          )
        }
        item {
          ListItem(
            modifier = Modifier.settingsRowModifier(),
            colors = listItemColors,
            headlineContent = { Text("Debug Canvas Status", style = mobileHeadline) },
            supportingContent = { Text("Show status text in the canvas when debug is enabled.", style = mobileCallout) },
            trailingContent = {
              Switch(
                checked = canvasDebugStatusEnabled,
                onCheckedChange = viewModel::setCanvasDebugStatusEnabled,
              )
            },
          )
        }
      }

      item { Spacer(modifier = Modifier.height(24.dp)) }
    }
  }
}

@Composable
private fun settingsTextFieldColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    cursorColor = mobileAccent,
  )

private fun Modifier.settingsRowModifier() =
  this
    .fillMaxWidth()
    .border(width = 1.dp, color = mobileBorder, shape = RoundedCornerShape(14.dp))
    .background(mobileSurfaceStrong, RoundedCornerShape(14.dp))

@Composable
private fun settingsPrimaryButtonColors() =
  ButtonDefaults.buttonColors(
    containerColor = mobileAccent,
    contentColor = Color.White,
    disabledContainerColor = mobileAccent.copy(alpha = 0.45f),
    disabledContentColor = Color.White.copy(alpha = 0.9f),
  )

@Composable
private fun settingsDangerButtonColors() =
  ButtonDefaults.buttonColors(
    containerColor = mobileDanger,
    contentColor = Color.White,
    disabledContainerColor = mobileDanger.copy(alpha = 0.45f),
    disabledContentColor = Color.White.copy(alpha = 0.9f),
  )

private fun openAppSettings(context: Context) {
  val intent =
    Intent(
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
      Uri.fromParts("package", context.packageName, null),
    )
  context.startActivity(intent)
}

private fun openNotificationListenerSettings(context: Context) {
  val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
  runCatching {
    context.startActivity(intent)
  }.getOrElse {
    openAppSettings(context)
  }
}

private fun hasNotificationsPermission(context: Context): Boolean {
  if (Build.VERSION.SDK_INT < 33) return true
  return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
    PackageManager.PERMISSION_GRANTED
}

private fun isNotificationListenerEnabled(context: Context): Boolean {
  return DeviceNotificationListenerService.isAccessEnabled(context)
}

private fun hasMotionCapabilities(context: Context): Boolean {
  val sensorManager = context.getSystemService(SensorManager::class.java) ?: return false
  return sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null ||
    sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
}
