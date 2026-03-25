package ai.openclaw.app

import android.app.Application
import android.os.StrictMode
import ai.openclaw.app.solana.MobileWalletManager

class NodeApp : Application() {
  val runtime: NodeRuntime by lazy { NodeRuntime(this) }
  val mobileWalletManager: MobileWalletManager by lazy { MobileWalletManager(runtime.prefs) }

  override fun onCreate() {
    super.onCreate()
    if (BuildConfig.DEBUG) {
      StrictMode.setThreadPolicy(
        StrictMode.ThreadPolicy.Builder()
          // MediaTek's boost framework performs touch-path disk probes inside our process,
          // which makes detectDiskReads()/detectDiskWrites() too noisy to be actionable here.
          .detectNetwork()
          .detectCustomSlowCalls()
          .detectUnbufferedIo()
          .penaltyLog()
          .build(),
      )
      StrictMode.setVmPolicy(
        StrictMode.VmPolicy.Builder()
          .detectActivityLeaks()
          .detectLeakedClosableObjects()
          .detectLeakedRegistrationObjects()
          .detectLeakedSqlLiteObjects()
          .detectFileUriExposure()
          .detectCleartextNetwork()
          .penaltyLog()
          .build(),
      )
    }
  }
}
