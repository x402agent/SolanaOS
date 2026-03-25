package ai.openclaw.app.arcade

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import androidx.core.view.WindowCompat
import org.godotengine.godot.Godot
import org.godotengine.godot.GodotActivity

class SmbGodotActivity : GodotActivity() {
  companion object {
    private const val tag = "SmbGodotActivity"

    fun createIntent(context: Context): Intent = Intent(context, SmbGodotActivity::class.java)
  }

  override fun getCommandLine(): MutableList<String> =
    super.getCommandLine().apply {
      add("--rendering-method")
      add("gl_compatibility")
      add("--rendering-driver")
      add("opengl3")
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    super.onCreate(savedInstanceState)
    applyImmersiveFlags()
  }

  override fun onGodotSetupCompleted() {
    Log.i(tag, "Godot setup completed with Compatibility/OpenGL renderer request")
  }

  override fun onGodotMainLoopStarted() {
    Log.i(tag, "Godot main loop started")
  }

  override fun onGodotForceQuit(instance: Godot) {
    Log.w(tag, "Godot requested force quit")
    super.onGodotForceQuit(instance)
  }

  override fun onResume() {
    super.onResume()
    applyImmersiveFlags()
  }

  private fun applyImmersiveFlags() {
    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility =
      View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
        View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
        View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
        View.SYSTEM_UI_FLAG_FULLSCREEN or
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
  }
}
