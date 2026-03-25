# ── Android entry points ──────────────────────────────────────────
-keep class ai.openclaw.app.NodeApp { *; }
-keep class ai.openclaw.app.MainActivity { *; }
-keep class ai.openclaw.app.NodeForegroundService { *; }
-keep class ai.openclaw.app.receiver.BootReceiver { *; }
-keep class ai.openclaw.app.node.DeviceNotificationListenerService { *; }
-keep class ai.openclaw.app.solana.MobileWalletAuthActivity { *; }

# ── Bouncy Castle ─────────────────────────────────────────────────
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**

# ── CameraX ───────────────────────────────────────────────────────
-keep class androidx.camera.** { *; }

# ── kotlinx.serialization ────────────────────────────────────────
-keep class kotlinx.serialization.** { *; }
-keep @kotlinx.serialization.Serializable class * { *; }
-keepclassmembers class **$$serializer { *; }
-keepclassmembers class * {
    @kotlinx.serialization.Serializable *;
}
-keepattributes *Annotation*, InnerClasses

# ── OkHttp ────────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.internal.platform.** { *; }

# ── Misc suppressions ────────────────────────────────────────────
-dontwarn com.sun.jna.**
-dontwarn javax.naming.**
-dontwarn java.net.spi.InetAddressResolverProvider
-dontwarn lombok.Generated
-dontwarn org.xbill.DNS.spi.**
-dontwarn org.slf4j.impl.StaticLoggerBinder
-dontwarn sun.net.spi.nameservice.NameServiceDescriptor
