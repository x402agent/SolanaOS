package ai.openclaw.app.receiver

import android.util.Log
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import ai.openclaw.app.NodeForegroundService
import ai.openclaw.app.SecurePrefs

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val action = intent?.action ?: return
    if (action !in supportedActions) return

    val prefs = SecurePrefs(context)
    if (!prefs.onboardingCompleted.value) return
    if (!prefs.autoStartOnBoot.value) return

    try {
      NodeForegroundService.start(context)
    } catch (t: Throwable) {
      Log.w(TAG, "Failed to start foreground service for action=$action", t)
    }
  }

  companion object {
    private const val TAG = "BootReceiver"
    private val supportedActions: Set<String> =
      setOf(
        Intent.ACTION_BOOT_COMPLETED,
        Intent.ACTION_MY_PACKAGE_REPLACED,
      )
  }
}
