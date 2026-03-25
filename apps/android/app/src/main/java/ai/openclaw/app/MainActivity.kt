package ai.openclaw.app

import ai.openclaw.app.arcade.SmbGodotActivity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.core.view.WindowCompat
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import ai.openclaw.app.ui.SolanaOSTheme
import ai.openclaw.app.ui.RootScreen
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
  companion object {
    private const val launchSmbExtra = "openclaw.arcade.launch_smb"
  }

  private val viewModel: MainViewModel by viewModels()
  private lateinit var permissionRequester: PermissionRequester

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    permissionRequester = PermissionRequester(this)
    viewModel.attachMobileWalletActivity(this)
    viewModel.handleDeepLink(intent)
    viewModel.camera.attachLifecycleOwner(this)
    viewModel.camera.attachPermissionRequester(permissionRequester)
    viewModel.sms.attachPermissionRequester(permissionRequester)

    lifecycleScope.launch {
      repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.preventSleep.collect { enabled ->
          if (enabled) {
            window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
          } else {
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
          }
        }
      }
    }

    setContent {
      SolanaOSTheme {
        Surface(modifier = Modifier) {
          RootScreen(viewModel = viewModel)
        }
      }
    }

    // Keep startup path lean: start foreground service after first frame.
    window.decorView.post { NodeForegroundService.start(this) }
    maybeLaunchSmb(intent)
  }

  override fun onStart() {
    super.onStart()
    viewModel.setForeground(true)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    viewModel.handleDeepLink(intent)
    maybeLaunchSmb(intent)
  }

  override fun onStop() {
    viewModel.setForeground(false)
    super.onStop()
  }

  override fun onDestroy() {
    viewModel.detachMobileWalletActivity(this)
    super.onDestroy()
  }

  private fun maybeLaunchSmb(intent: Intent?) {
    if (intent?.getBooleanExtra(launchSmbExtra, false) != true) return
    intent.removeExtra(launchSmbExtra)
    startActivity(SmbGodotActivity.createIntent(this))
  }
}
