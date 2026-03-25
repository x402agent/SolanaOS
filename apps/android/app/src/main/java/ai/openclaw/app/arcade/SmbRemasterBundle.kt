package ai.openclaw.app.arcade

import android.content.Context

internal const val smbRemasterAssetRoot = "arcade/platformer/remaster"

internal data class SmbRemasterBundleStatus(
  val projectReady: Boolean,
  val binaryReady: Boolean,
  val exportCacheReady: Boolean,
  val uidCacheReady: Boolean,
  val addonsReady: Boolean,
  val audioReady: Boolean,
  val spriteReady: Boolean,
  val sceneReady: Boolean,
  val scriptReady: Boolean,
  val audioBusReady: Boolean,
  val entityMapReady: Boolean,
  val selectorMapReady: Boolean,
) {
  val ready: Boolean
    get() =
      projectReady &&
        binaryReady &&
        exportCacheReady &&
        uidCacheReady &&
        addonsReady &&
        audioReady &&
        spriteReady &&
        sceneReady &&
        scriptReady &&
        audioBusReady &&
        entityMapReady &&
        selectorMapReady
}

internal fun loadSmbRemasterBundleStatus(context: Context): SmbRemasterBundleStatus =
  SmbRemasterBundleStatus(
    projectReady = assetFileExists(context, "$smbRemasterAssetRoot/project.godot"),
    binaryReady = assetFileExists(context, "$smbRemasterAssetRoot/project.binary"),
    exportCacheReady = assetDirHasEntries(context, "$smbRemasterAssetRoot/.godot/exported"),
    uidCacheReady = assetFileExists(context, "$smbRemasterAssetRoot/.godot/uid_cache.bin"),
    addonsReady = assetDirHasEntries(context, "$smbRemasterAssetRoot/addons"),
    audioReady = assetDirHasEntries(context, "$smbRemasterAssetRoot/Assets/Audio"),
    spriteReady = assetDirHasEntries(context, "$smbRemasterAssetRoot/Assets/Sprites"),
    sceneReady = assetDirHasEntries(context, "$smbRemasterAssetRoot/Scenes"),
    scriptReady = assetDirHasEntries(context, "$smbRemasterAssetRoot/Scripts"),
    audioBusReady = assetFileExists(context, "$smbRemasterAssetRoot/default_bus_layout.tres"),
    entityMapReady = assetFileExists(context, "$smbRemasterAssetRoot/EntityIDMap.json"),
    selectorMapReady = assetFileExists(context, "$smbRemasterAssetRoot/SelectorKeyMap.json"),
  )

private fun assetDirHasEntries(context: Context, assetPath: String): Boolean =
  runCatching { !context.assets.list(assetPath).isNullOrEmpty() }.getOrDefault(false)

private fun assetFileExists(context: Context, assetPath: String): Boolean =
  runCatching {
    context.assets.open(assetPath).close()
    true
  }.getOrDefault(false)
