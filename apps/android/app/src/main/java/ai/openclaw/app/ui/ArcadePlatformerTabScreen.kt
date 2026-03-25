package ai.openclaw.app.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import androidx.core.graphics.withSave
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.foundation.rememberScrollState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.verticalScroll
import kotlin.math.abs
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sqrt
import kotlinx.coroutines.delay
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private const val platformerViewportWidth = 256f
private const val platformerViewportHeight = 240f
private const val platformerPhysicsScale = 0.25f
private const val platformerPlayerWidth = 14f
private const val platformerPlayerHeight = 16f
private const val platformerCoinSize = 8f
private const val platformerEnemyWidth = 14f
private const val platformerEnemyHeight = 12f
private const val platformerEnemySpeed = 28f
private const val platformerGoalWidth = 10f
private const val platformerAssetRoot = "arcade/platformer"
private const val platformerRemasterRoot = "$platformerAssetRoot/remaster"
private const val platformerRemasterAssetsRoot = "$platformerRemasterRoot/Assets"
private val arcadeJson = Json { ignoreUnknownKeys = true }
private val platformerBrickFrame = PlatformerSpriteFrame(0, 64, 16, 16)
private val platformerQuestionFrames =
  listOf(
    PlatformerSpriteFrame(0, 0, 16, 16),
    PlatformerSpriteFrame(16, 0, 16, 16),
    PlatformerSpriteFrame(32, 0, 16, 16),
    PlatformerSpriteFrame(16, 0, 16, 16),
  )
private val platformerCoinFrames =
  listOf(
    PlatformerSpriteFrame(0, 0, 8, 8),
    PlatformerSpriteFrame(8, 0, 8, 8),
    PlatformerSpriteFrame(16, 0, 8, 8),
    PlatformerSpriteFrame(8, 0, 8, 8),
  )
private val platformerPlayerIdleFrame = PlatformerSpriteFrame(0, 0, 32, 32)
private val platformerPlayerRunFrames =
  listOf(
    PlatformerSpriteFrame(64, 0, 32, 32),
    PlatformerSpriteFrame(128, 0, 32, 32),
    PlatformerSpriteFrame(96, 0, 32, 32),
  )
private val platformerPlayerJumpFrame = PlatformerSpriteFrame(192, 0, 32, 32)
private val platformerGoombaFrames =
  listOf(
    PlatformerSpriteFrame(0, 0, 16, 16),
    PlatformerSpriteFrame(16, 0, 16, 16),
  )
private val platformerFlagPoleFrame = PlatformerSpriteFrame(0, 0, 16, 176)
private val platformerFlagFrame = PlatformerSpriteFrame(0, 0, 16, 16)

private data class PlatformerSpriteFrame(
  val x: Int,
  val y: Int,
  val width: Int,
  val height: Int,
)

private data class PlatformerVisualAssets(
  val themeAssets: Map<PlatformerCourseTheme, PlatformerThemeAssets>,
  val playerSprites: Map<PlatformerRunnerCharacter, Bitmap?>,
  val playerLifeIcons: Map<PlatformerRunnerCharacter, Bitmap?>,
  val controlIcons: PlatformerControlIcons,
  val coin: Bitmap?,
  val questionBlock: Bitmap?,
  val flagPole: Bitmap?,
  val flag: Bitmap?,
)

private data class PlatformerThemeAssets(
  val hills: Bitmap?,
  val bush: Bitmap?,
  val clouds: Bitmap?,
  val terrain: Bitmap?,
  val enemy: Bitmap?,
)

private data class PlatformerControlIcons(
  val left: Bitmap?,
  val right: Bitmap?,
  val jump: Bitmap?,
  val run: Bitmap?,
)

private enum class PlatformerCourseTheme(
  val label: String,
  val hillsAssetPath: String,
  val bushAssetPath: String,
  val cloudAssetPath: String,
  val terrainAssetPath: String,
  val enemyAssetPath: String,
  val musicAssetPath: String,
) {
  Overworld(
    label = "Overworld",
    hillsAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Hills/Overworld.png",
    bushAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Bushes/Bush.png",
    cloudAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/CloudOverlays/CloudOverlay.png",
    terrainAssetPath = "$platformerRemasterAssetsRoot/Sprites/Tilesets/Terrain/Overworld.png",
    enemyAssetPath = "$platformerRemasterAssetsRoot/Sprites/Enemies/Goomba.png",
    musicAssetPath = "$platformerRemasterAssetsRoot/Audio/BGM/Overworld.mp3",
  ),
  Beach(
    label = "Beach",
    hillsAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Hills/BeachHills.png",
    bushAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Bushes/UnderwaterBush.png",
    cloudAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/BeachWater.png",
    terrainAssetPath = "$platformerRemasterAssetsRoot/Sprites/Tilesets/Terrain/Beach.png",
    enemyAssetPath = "$platformerRemasterAssetsRoot/Sprites/Enemies/CheepCheep.png",
    musicAssetPath = "$platformerRemasterAssetsRoot/Audio/BGM/Beach.mp3",
  ),
  GhostHouse(
    label = "Ghost House",
    hillsAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Hills/GhostHouse.png",
    bushAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Bushes/GhostHouseBush.png",
    cloudAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/BooMenuBG.png",
    terrainAssetPath = "$platformerRemasterAssetsRoot/Sprites/Tilesets/Terrain/GhostHouse.png",
    enemyAssetPath = "$platformerRemasterAssetsRoot/Sprites/Enemies/Boo.png",
    musicAssetPath = "$platformerRemasterAssetsRoot/Audio/BGM/BooMenu.mp3",
  ),
  Castle(
    label = "Castle",
    hillsAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Hills/Castle.png",
    bushAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Bushes/CastleBush.png",
    cloudAssetPath = "$platformerRemasterAssetsRoot/Sprites/Backgrounds/Lighting.png",
    terrainAssetPath = "$platformerRemasterAssetsRoot/Sprites/Tilesets/Terrain/Castle.png",
    enemyAssetPath = "$platformerRemasterAssetsRoot/Sprites/Enemies/DryBones.png",
    musicAssetPath = "$platformerRemasterAssetsRoot/Audio/BGM/Castle.mp3",
  ),
}

private enum class PlatformerRunnerCharacter(
  val label: String,
  val spriteAssetPath: String,
  val lifeIconAssetPath: String,
) {
  Mario(
    label = "Mario",
    spriteAssetPath = "$platformerRemasterAssetsRoot/Sprites/Players/Mario/Small.png",
    lifeIconAssetPath = "$platformerRemasterAssetsRoot/Sprites/Players/Mario/LifeIcon.png",
  ),
  Luigi(
    label = "Luigi",
    spriteAssetPath = "$platformerRemasterAssetsRoot/Sprites/Players/Luigi/Small.png",
    lifeIconAssetPath = "$platformerRemasterAssetsRoot/Sprites/Players/Luigi/LifeIcon.png",
  ),
  Toad(
    label = "Toad",
    spriteAssetPath = "$platformerRemasterAssetsRoot/Sprites/Players/Toad/Small.png",
    lifeIconAssetPath = "$platformerRemasterAssetsRoot/Sprites/Players/Toad/LifeIcon.png",
  ),
}

private data class PlatformerCourseDefinition(
  val id: String,
  val name: String,
  val subtitle: String,
  val theme: PlatformerCourseTheme,
  val buildState: () -> PlatformerState,
)

private data class PlatformerBundleStatus(
  val audioReady: Boolean,
  val spriteReady: Boolean,
  val sceneReady: Boolean,
  val scriptReady: Boolean,
  val uiReady: Boolean,
  val levelReady: Boolean,
  val projectReady: Boolean,
  val addonsReady: Boolean,
  val audioBusReady: Boolean,
  val entityMapReady: Boolean,
  val selectorMapReady: Boolean,
)

private enum class PlatformerSoundEffect {
  Jump,
  Coin,
  Stomp,
  Kick,
  Damage,
  Clear,
  Pipe,
}

private class PlatformerAudioController(context: Context) {
  private val appContext = context.applicationContext
  private val audioAttributes =
    AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_GAME)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
  private val soundPool =
    SoundPool.Builder()
      .setMaxStreams(5)
      .setAudioAttributes(audioAttributes)
      .build()
  private val soundIds =
    mapOf(
      PlatformerSoundEffect.Jump to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/SmallJump.wav", "$platformerAssetRoot/audio/sfx/small_jump.wav"),
      PlatformerSoundEffect.Coin to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/Coin.wav", "$platformerAssetRoot/audio/sfx/coin.wav"),
      PlatformerSoundEffect.Stomp to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/Stomp.wav"),
      PlatformerSoundEffect.Kick to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/Kick.wav", "$platformerAssetRoot/audio/sfx/kick.wav"),
      PlatformerSoundEffect.Damage to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/Damage.wav", "$platformerAssetRoot/audio/sfx/damage.wav"),
      PlatformerSoundEffect.Clear to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/CourseClear.wav", "$platformerAssetRoot/audio/sfx/course_clear.wav"),
      PlatformerSoundEffect.Pipe to loadSound("$platformerRemasterAssetsRoot/Audio/SFX/Pipe.wav"),
    )
  private var currentMusicAssetPath: String? = null
  private var musicPlayer: MediaPlayer? = null

  fun setMusicTrack(assetPath: String, enabled: Boolean) {
    if (currentMusicAssetPath != assetPath) {
      stopAndReleaseMusic()
      currentMusicAssetPath = assetPath
      musicPlayer =
        loadMusic(
          assetPath,
          if (assetPath.endsWith("/Overworld.mp3")) "$platformerAssetRoot/audio/bgm/overworld.mp3" else null,
        )
    }
    setMusicEnabled(enabled)
  }

  fun play(effect: PlatformerSoundEffect) {
    val soundId = soundIds[effect] ?: return
    soundPool.play(soundId, 0.78f, 0.78f, 1, 0, 1f)
  }

  fun setMusicEnabled(enabled: Boolean) {
    val player = musicPlayer ?: return
    if (enabled) {
      if (!player.isPlaying) player.start()
    } else if (player.isPlaying) {
      player.pause()
    }
  }

  fun stopMusic() {
    val player = musicPlayer ?: return
    if (player.isPlaying) player.pause()
    player.seekTo(0)
  }

  fun release() {
    stopAndReleaseMusic()
    runCatching { soundPool.release() }
  }

  private fun loadSound(vararg assetPaths: String?): Int? =
    assetPaths
      .filterNotNull()
      .firstNotNullOfOrNull { assetPath ->
        runCatching {
          appContext.assets.openFd(assetPath).use { descriptor ->
            soundPool.load(descriptor, 1)
          }
        }.getOrNull()
      }

  private fun loadMusic(vararg assetPaths: String?): MediaPlayer? =
    assetPaths
      .filterNotNull()
      .firstNotNullOfOrNull { assetPath ->
        runCatching {
          appContext.assets.openFd(assetPath).use { descriptor ->
            MediaPlayer().apply {
              setAudioAttributes(audioAttributes)
              setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
              isLooping = true
              setVolume(0.34f, 0.34f)
              prepare()
            }
          }
        }.getOrNull()
      }

  private fun stopAndReleaseMusic() {
    runCatching {
      musicPlayer?.let { player ->
        if (player.isPlaying) player.stop()
        player.release()
      }
    }
    musicPlayer = null
  }
}

@Serializable
internal data class ClassicPhysicsProfile(
  @SerialName("AIR_ACCEL") val airAccel: Float = 3.8076f,
  @SerialName("AIR_SKID") val airSkid: Float = 2.5384f,
  @SerialName("DECEL") val decel: Float = 3.4736f,
  @SerialName("FALL_GRAVITY") val fallGravity: Float = 25f,
  @SerialName("GROUND_RUN_ACCEL") val groundRunAccel: Float = 3.8f,
  @SerialName("GROUND_WALK_ACCEL") val groundWalkAccel: Float = 2.5f,
  @SerialName("JUMP_GRAVITY") val jumpGravity: Float = 8f,
  @SerialName("JUMP_HEIGHT") val jumpHeight: Float = 273f,
  @SerialName("MAX_FALL_SPEED") val maxFallSpeed: Float = 273f,
  @SerialName("RUN_SKID") val runSkid: Float = 6.9f,
  @SerialName("WALK_SKID") val walkSkid: Float = 30f,
  @SerialName("RUN_SPEED") val runSpeed: Float = 175f,
  @SerialName("WALK_SPEED") val walkSpeed: Float = 106f,
)

internal data class PlatformerInput(
  val leftHeld: Boolean = false,
  val rightHeld: Boolean = false,
  val runHeld: Boolean = false,
  val jumpPressed: Boolean = false,
)

internal data class PlatformerRect(
  val x: Float,
  val y: Float,
  val width: Float,
  val height: Float,
)

internal data class PlatformerCoin(
  val x: Float,
  val y: Float,
  val collected: Boolean = false,
)

internal data class PlatformerEnemy(
  val x: Float,
  val y: Float,
  val patrolMinX: Float,
  val patrolMaxX: Float,
  val direction: Int = -1,
  val alive: Boolean = true,
)

internal data class PlatformerPlayer(
  val x: Float,
  val y: Float,
  val vx: Float = 0f,
  val vy: Float = 0f,
  val onGround: Boolean = false,
  val facingRight: Boolean = true,
)

internal data class PlatformerState(
  val player: PlatformerPlayer,
  val platforms: List<PlatformerRect>,
  val coins: List<PlatformerCoin>,
  val enemies: List<PlatformerEnemy>,
  val worldWidth: Float,
  val worldHeight: Float,
  val goalX: Float,
  val score: Int = 0,
  val crashed: Boolean = false,
  val cleared: Boolean = false,
)

@Serializable
internal data class ClassicPlatformerSpawnAsset(
  val x: Float = 24f,
  val y: Float = 192f,
)

@Serializable
internal data class ClassicPlatformerRectAsset(
  val x: Float,
  val y: Float,
  val width: Float,
  val height: Float,
)

@Serializable
internal data class ClassicPlatformerCoinAsset(
  val x: Float,
  val y: Float,
)

@Serializable
internal data class ClassicPlatformerEnemyAsset(
  val x: Float,
  val y: Float,
  val patrolMinX: Float,
  val patrolMaxX: Float,
)

@Serializable
internal data class ClassicPlatformerLevelAsset(
  val name: String = "Seeker Training Run",
  val worldWidth: Float = 1888f,
  val worldHeight: Float = platformerViewportHeight,
  val goalX: Float = 1818f,
  val spawn: ClassicPlatformerSpawnAsset = ClassicPlatformerSpawnAsset(),
  val platforms: List<ClassicPlatformerRectAsset> = emptyList(),
  val coins: List<ClassicPlatformerCoinAsset> = emptyList(),
  val enemies: List<ClassicPlatformerEnemyAsset> = emptyList(),
)

internal fun parseClassicPhysicsProfile(raw: String): ClassicPhysicsProfile =
  arcadeJson.decodeFromString(raw)

internal fun parseClassicPlatformerLevel(raw: String): ClassicPlatformerLevelAsset =
  arcadeJson.decodeFromString(raw)

internal fun ClassicPlatformerLevelAsset.toPlatformerState(): PlatformerState =
  PlatformerState(
    player = PlatformerPlayer(x = spawn.x, y = spawn.y, onGround = true, facingRight = true),
    platforms = platforms.map { PlatformerRect(x = it.x, y = it.y, width = it.width, height = it.height) },
    coins = coins.map { PlatformerCoin(x = it.x, y = it.y) },
    enemies =
      enemies.map {
        PlatformerEnemy(
          x = it.x,
          y = it.y,
          patrolMinX = it.patrolMinX,
          patrolMaxX = it.patrolMaxX,
        )
      },
    worldWidth = worldWidth,
    worldHeight = worldHeight,
    goalX = goalX,
  )

internal fun defaultPlatformerState(): PlatformerState {
  val platforms =
    listOf(
      PlatformerRect(0f, 208f, 292f, 32f),
      PlatformerRect(344f, 208f, 300f, 32f),
      PlatformerRect(700f, 208f, 290f, 32f),
      PlatformerRect(1048f, 208f, 250f, 32f),
      PlatformerRect(1356f, 208f, 220f, 32f),
      PlatformerRect(1618f, 208f, 240f, 32f),
      PlatformerRect(398f, 164f, 48f, 12f),
      PlatformerRect(470f, 144f, 48f, 12f),
      PlatformerRect(812f, 156f, 48f, 12f),
      PlatformerRect(884f, 136f, 48f, 12f),
      PlatformerRect(1178f, 164f, 52f, 12f),
      PlatformerRect(1440f, 168f, 40f, 12f),
      PlatformerRect(1498f, 152f, 40f, 12f),
      PlatformerRect(1556f, 136f, 40f, 12f),
    )
  val coins =
    listOf(
      PlatformerCoin(178f, 182f),
      PlatformerCoin(418f, 138f),
      PlatformerCoin(494f, 118f),
      PlatformerCoin(748f, 182f),
      PlatformerCoin(836f, 130f),
      PlatformerCoin(908f, 110f),
      PlatformerCoin(1088f, 182f),
      PlatformerCoin(1204f, 138f),
      PlatformerCoin(1462f, 144f),
      PlatformerCoin(1520f, 128f),
      PlatformerCoin(1684f, 182f),
    )
  val enemies =
    listOf(
      PlatformerEnemy(x = 436f, y = 196f, patrolMinX = 368f, patrolMaxX = 602f),
      PlatformerEnemy(x = 782f, y = 196f, patrolMinX = 724f, patrolMaxX = 954f),
      PlatformerEnemy(x = 1110f, y = 196f, patrolMinX = 1072f, patrolMaxX = 1250f),
      PlatformerEnemy(x = 1664f, y = 196f, patrolMinX = 1636f, patrolMaxX = 1812f),
    )
  return PlatformerState(
    player = PlatformerPlayer(x = 24f, y = 192f, onGround = true, facingRight = true),
    platforms = platforms,
    coins = coins,
    enemies = enemies,
    worldWidth = 1888f,
    worldHeight = platformerViewportHeight,
    goalX = 1818f,
  )
}

private fun overworldCourseState(levelAsset: ClassicPlatformerLevelAsset? = null): PlatformerState =
  levelAsset?.toPlatformerState() ?: defaultPlatformerState()

private fun beachCourseState(): PlatformerState =
  PlatformerState(
    player = PlatformerPlayer(x = 28f, y = 192f, onGround = true, facingRight = true),
    platforms =
      listOf(
        PlatformerRect(0f, 208f, 244f, 32f),
        PlatformerRect(298f, 208f, 182f, 32f),
        PlatformerRect(536f, 208f, 242f, 32f),
        PlatformerRect(836f, 208f, 180f, 32f),
        PlatformerRect(1080f, 208f, 214f, 32f),
        PlatformerRect(1350f, 208f, 254f, 32f),
        PlatformerRect(340f, 160f, 42f, 12f),
        PlatformerRect(414f, 144f, 42f, 12f),
        PlatformerRect(640f, 170f, 54f, 12f),
        PlatformerRect(882f, 154f, 42f, 12f),
        PlatformerRect(946f, 134f, 42f, 12f),
        PlatformerRect(1178f, 164f, 48f, 12f),
        PlatformerRect(1420f, 156f, 44f, 12f),
        PlatformerRect(1488f, 138f, 44f, 12f),
      ),
    coins =
      listOf(
        PlatformerCoin(128f, 182f),
        PlatformerCoin(356f, 134f),
        PlatformerCoin(430f, 118f),
        PlatformerCoin(666f, 144f),
        PlatformerCoin(710f, 144f),
        PlatformerCoin(900f, 128f),
        PlatformerCoin(964f, 110f),
        PlatformerCoin(1128f, 182f),
        PlatformerCoin(1204f, 138f),
        PlatformerCoin(1440f, 130f),
        PlatformerCoin(1510f, 112f),
      ),
    enemies =
      listOf(
        PlatformerEnemy(x = 352f, y = 196f, patrolMinX = 314f, patrolMaxX = 462f),
        PlatformerEnemy(x = 652f, y = 196f, patrolMinX = 566f, patrolMaxX = 748f),
        PlatformerEnemy(x = 1138f, y = 196f, patrolMinX = 1092f, patrolMaxX = 1272f),
        PlatformerEnemy(x = 1464f, y = 196f, patrolMinX = 1364f, patrolMaxX = 1582f),
      ),
    worldWidth = 1650f,
    worldHeight = platformerViewportHeight,
    goalX = 1572f,
  )

private fun ghostCourseState(): PlatformerState =
  PlatformerState(
    player = PlatformerPlayer(x = 22f, y = 192f, onGround = true, facingRight = true),
    platforms =
      listOf(
        PlatformerRect(0f, 208f, 198f, 32f),
        PlatformerRect(252f, 208f, 170f, 32f),
        PlatformerRect(476f, 208f, 178f, 32f),
        PlatformerRect(710f, 208f, 166f, 32f),
        PlatformerRect(930f, 208f, 188f, 32f),
        PlatformerRect(1172f, 208f, 168f, 32f),
        PlatformerRect(1392f, 208f, 206f, 32f),
        PlatformerRect(286f, 166f, 46f, 12f),
        PlatformerRect(364f, 150f, 46f, 12f),
        PlatformerRect(540f, 146f, 54f, 12f),
        PlatformerRect(774f, 154f, 44f, 12f),
        PlatformerRect(1000f, 142f, 50f, 12f),
        PlatformerRect(1234f, 156f, 42f, 12f),
        PlatformerRect(1466f, 138f, 54f, 12f),
      ),
    coins =
      listOf(
        PlatformerCoin(120f, 182f),
        PlatformerCoin(308f, 138f),
        PlatformerCoin(386f, 122f),
        PlatformerCoin(560f, 118f),
        PlatformerCoin(794f, 126f),
        PlatformerCoin(1018f, 114f),
        PlatformerCoin(1248f, 130f),
        PlatformerCoin(1490f, 112f),
        PlatformerCoin(1542f, 112f),
      ),
    enemies =
      listOf(
        PlatformerEnemy(x = 322f, y = 196f, patrolMinX = 270f, patrolMaxX = 408f),
        PlatformerEnemy(x = 560f, y = 196f, patrolMinX = 500f, patrolMaxX = 640f),
        PlatformerEnemy(x = 1008f, y = 196f, patrolMinX = 946f, patrolMaxX = 1086f),
        PlatformerEnemy(x = 1488f, y = 196f, patrolMinX = 1410f, patrolMaxX = 1568f),
      ),
    worldWidth = 1642f,
    worldHeight = platformerViewportHeight,
    goalX = 1564f,
  )

private fun castleCourseState(): PlatformerState =
  PlatformerState(
    player = PlatformerPlayer(x = 24f, y = 192f, onGround = true, facingRight = true),
    platforms =
      listOf(
        PlatformerRect(0f, 208f, 214f, 32f),
        PlatformerRect(270f, 208f, 190f, 32f),
        PlatformerRect(516f, 208f, 200f, 32f),
        PlatformerRect(772f, 208f, 174f, 32f),
        PlatformerRect(1002f, 208f, 184f, 32f),
        PlatformerRect(1242f, 208f, 198f, 32f),
        PlatformerRect(1498f, 208f, 212f, 32f),
        PlatformerRect(322f, 170f, 40f, 12f),
        PlatformerRect(392f, 150f, 40f, 12f),
        PlatformerRect(588f, 162f, 56f, 12f),
        PlatformerRect(846f, 148f, 44f, 12f),
        PlatformerRect(1060f, 134f, 44f, 12f),
        PlatformerRect(1288f, 160f, 48f, 12f),
        PlatformerRect(1562f, 142f, 52f, 12f),
      ),
    coins =
      listOf(
        PlatformerCoin(136f, 182f),
        PlatformerCoin(340f, 142f),
        PlatformerCoin(410f, 122f),
        PlatformerCoin(612f, 136f),
        PlatformerCoin(866f, 122f),
        PlatformerCoin(1080f, 108f),
        PlatformerCoin(1304f, 136f),
        PlatformerCoin(1582f, 118f),
      ),
    enemies =
      listOf(
        PlatformerEnemy(x = 350f, y = 196f, patrolMinX = 286f, patrolMaxX = 448f),
        PlatformerEnemy(x = 610f, y = 196f, patrolMinX = 536f, patrolMaxX = 700f),
        PlatformerEnemy(x = 1080f, y = 196f, patrolMinX = 1016f, patrolMaxX = 1166f),
        PlatformerEnemy(x = 1584f, y = 196f, patrolMinX = 1516f, patrolMaxX = 1680f),
      ),
    worldWidth = 1756f,
    worldHeight = platformerViewportHeight,
    goalX = 1678f,
  )

private fun platformerCourseDefinitions(
  importedClassicLevel: ClassicPlatformerLevelAsset? = null,
): List<PlatformerCourseDefinition> =
  listOf(
    PlatformerCourseDefinition(
      id = "training",
      name = importedClassicLevel?.name ?: "Stage 1-8BIT",
      subtitle = "Imported overworld geometry and motion profile loaded from bundled Android assets.",
      theme = PlatformerCourseTheme.Overworld,
      buildState = { overworldCourseState(importedClassicLevel) },
    ),
    PlatformerCourseDefinition(
      id = "beach",
      name = "Beach Drift",
      subtitle = "A looser lane with beach terrain, water overlay, and Cheep Cheep pressure.",
      theme = PlatformerCourseTheme.Beach,
      buildState = ::beachCourseState,
    ),
    PlatformerCourseDefinition(
      id = "ghost",
      name = "Boo Relay",
      subtitle = "Ghost-house visuals, darker audio, and tighter jumps through the same native loop.",
      theme = PlatformerCourseTheme.GhostHouse,
      buildState = ::ghostCourseState,
    ),
    PlatformerCourseDefinition(
      id = "castle",
      name = "Castle Shift",
      subtitle = "Harder timings with castle art, Dry Bones pressure, and a longer final push.",
      theme = PlatformerCourseTheme.Castle,
      buildState = ::castleCourseState,
    ),
  )

private fun rememberPlatformerBundleStatus(context: Context): PlatformerBundleStatus =
  PlatformerBundleStatus(
    audioReady = assetDirHasEntries(context, "$platformerRemasterRoot/Assets/Audio"),
    spriteReady = assetDirHasEntries(context, "$platformerRemasterRoot/Assets/Sprites"),
    sceneReady = assetDirHasEntries(context, "$platformerRemasterRoot/Scenes"),
    scriptReady = assetDirHasEntries(context, "$platformerRemasterRoot/Scripts"),
    uiReady = assetDirHasEntries(context, "$platformerRemasterRoot/Assets/Sprites/UI"),
    levelReady = assetDirHasEntries(context, "$platformerRemasterRoot/Scenes/Levels"),
    projectReady = assetFileExists(context, "$platformerRemasterRoot/project.godot"),
    addonsReady = assetDirHasEntries(context, "$platformerRemasterRoot/addons"),
    audioBusReady = assetFileExists(context, "$platformerRemasterRoot/default_bus_layout.tres"),
    entityMapReady = assetFileExists(context, "$platformerRemasterRoot/EntityIDMap.json"),
    selectorMapReady = assetFileExists(context, "$platformerRemasterRoot/SelectorKeyMap.json"),
  )

private fun assetDirHasEntries(context: Context, assetPath: String): Boolean =
  runCatching { !context.assets.list(assetPath).isNullOrEmpty() }.getOrDefault(false)

private fun assetFileExists(context: Context, assetPath: String): Boolean =
  runCatching {
    context.assets.open(assetPath).close()
    true
  }.getOrDefault(false)

internal fun stepPlatformer(
  state: PlatformerState,
  input: PlatformerInput,
  physics: ClassicPhysicsProfile,
  dt: Float,
): PlatformerState {
  if (state.crashed || state.cleared) return state

  val moveDir =
    when {
      input.leftHeld && !input.rightHeld -> -1
      input.rightHeld && !input.leftHeld -> 1
      else -> 0
    }

  val walkSpeed = physics.walkSpeed * platformerPhysicsScale
  val runSpeed = physics.runSpeed * platformerPhysicsScale
  val maxSpeed = if (input.runHeld) runSpeed else walkSpeed
  val accelPerSecond =
    when {
      moveDir == 0 -> physics.decel * 60f * platformerPhysicsScale
      state.player.onGround && input.runHeld -> physics.groundRunAccel * 60f * platformerPhysicsScale
      state.player.onGround -> physics.groundWalkAccel * 60f * platformerPhysicsScale
      else -> physics.airAccel * 60f * platformerPhysicsScale
    }
  val gravityPerSecond =
    if (state.player.vy < 0f && !state.player.onGround) {
      physics.jumpGravity * 60f * platformerPhysicsScale
    } else {
      physics.fallGravity * 60f * platformerPhysicsScale
    }
  val maxFallSpeed = physics.maxFallSpeed * platformerPhysicsScale
  val jumpVelocity = sqrt(2f * gravityPerSecond * (physics.jumpHeight * platformerPhysicsScale * 0.92f))

  var player = state.player
  var nextVx = player.vx
  val targetVx = moveDir * maxSpeed
  nextVx =
    when {
      moveDir == 0 -> moveToward(nextVx, 0f, accelPerSecond * dt)
      else -> moveToward(nextVx, targetVx, accelPerSecond * dt)
    }

  var nextVy = player.vy
  if (input.jumpPressed && player.onGround) {
    nextVy = -jumpVelocity
    player = player.copy(onGround = false)
  }
  nextVy = (nextVy + gravityPerSecond * dt).coerceAtMost(maxFallSpeed)

  val steppedEnemies =
    state.enemies.map { enemy ->
      if (!enemy.alive) {
        enemy
      } else {
        val candidateX = enemy.x + enemy.direction * platformerEnemySpeed * dt
        if (candidateX <= enemy.patrolMinX) {
          enemy.copy(x = enemy.patrolMinX, direction = 1)
        } else if (candidateX >= enemy.patrolMaxX) {
          enemy.copy(x = enemy.patrolMaxX, direction = -1)
        } else {
          enemy.copy(x = candidateX)
        }
      }
    }

  val movedX = resolveHorizontalMove(player.x, player.y, nextVx, state.platforms, dt)
  nextVx = movedX.second
  val movedY = resolveVerticalMove(movedX.first, player.y, nextVy, state.platforms, dt)
  nextVy = movedY.second
  player =
    player.copy(
      x = movedX.first.coerceIn(0f, state.worldWidth - platformerPlayerWidth),
      y = movedY.first,
      vx = nextVx,
      vy = nextVy,
      onGround = movedY.third,
      facingRight = when {
        abs(nextVx) < 0.01f -> player.facingRight
        else -> nextVx >= 0f
      },
    )

  var coins = state.coins
  if (coins.any { !it.collected }) {
    coins =
      coins.map { coin ->
        if (coin.collected) {
          coin
        } else if (intersects(player.x, player.y, platformerPlayerWidth, platformerPlayerHeight, coin.x, coin.y, platformerCoinSize, platformerCoinSize)) {
          coin.copy(collected = true)
        } else {
          coin
        }
      }
  }

  var enemies = steppedEnemies
  var crashed = false
  enemies =
    steppedEnemies.map { enemy ->
      if (!enemy.alive) {
        enemy
      } else if (intersects(player.x, player.y, platformerPlayerWidth, platformerPlayerHeight, enemy.x, enemy.y, platformerEnemyWidth, platformerEnemyHeight)) {
        val stomped = player.vy > 0f && player.y + platformerPlayerHeight <= enemy.y + 8f
        if (stomped) {
          player = player.copy(vy = -jumpVelocity * 0.52f, onGround = false)
          enemy.copy(alive = false)
        } else {
          crashed = true
          enemy
        }
      } else {
        enemy
      }
    }

  if (player.y > state.worldHeight + 40f) crashed = true
  val cleared = player.x + platformerPlayerWidth >= state.goalX
  val score = coins.count { it.collected }

  return state.copy(
    player = player,
    coins = coins,
    enemies = enemies,
    score = score,
    crashed = crashed,
    cleared = cleared,
  )
}

@Composable
fun ArcadePlatformerTabScreen() {
  val context = LocalContext.current
  val physics = rememberClassicPhysicsProfile(context)
  val importedClassicLevel = rememberClassicPlatformerLevel(context)
  val assets = rememberPlatformerAssets(context)
  val audio = rememberPlatformerAudio(context)
  val courses = remember(importedClassicLevel) { platformerCourseDefinitions(importedClassicLevel) }
  val bundleStatus = remember(context) { rememberPlatformerBundleStatus(context) }
  val classicPhysicsReady = remember(context) { assetFileExists(context, "arcade/classic_physics.json") }
  var selectedCourseId by rememberSaveable { mutableStateOf(courses.first().id) }
  var selectedCharacter by rememberSaveable { mutableStateOf(PlatformerRunnerCharacter.Mario) }
  val selectedCourse = remember(selectedCourseId, courses) { courses.firstOrNull { it.id == selectedCourseId } ?: courses.first() }
  val themeAssets = assets.themeAssets[selectedCourse.theme]
  val playerSprite = assets.playerSprites[selectedCharacter]
  val playerLifeIcon = assets.playerLifeIcons[selectedCharacter]
  var state by remember { mutableStateOf(selectedCourse.buildState()) }
  var running by rememberSaveable { mutableStateOf(false) }
  var bestScore by rememberSaveable { mutableIntStateOf(0) }
  var leftHeld by remember { mutableStateOf(false) }
  var rightHeld by remember { mutableStateOf(false) }
  var runHeld by remember { mutableStateOf(false) }
  var jumpQueued by remember { mutableStateOf(false) }
  var animationTick by remember { mutableIntStateOf(0) }
  var lastScore by remember { mutableIntStateOf(state.score) }
  var lastAliveEnemies by remember { mutableIntStateOf(state.enemies.count { it.alive }) }
  var lastCrashed by remember { mutableStateOf(state.crashed) }
  var lastCleared by remember { mutableStateOf(state.cleared) }

  fun resetGame() {
    state = selectedCourse.buildState()
    running = false
    leftHeld = false
    rightHeld = false
    runHeld = false
    jumpQueued = false
    lastScore = state.score
    lastAliveEnemies = state.enemies.count { it.alive }
    lastCrashed = state.crashed
    lastCleared = state.cleared
    audio.stopMusic()
  }

  fun requestGameplayStart() {
    if (!running && !state.crashed && !state.cleared) {
      running = true
    }
  }

  LaunchedEffect(selectedCourse.id) {
    resetGame()
    audio.play(PlatformerSoundEffect.Pipe)
  }

  LaunchedEffect(running, state.crashed, state.cleared, physics) {
    while (running && !state.crashed && !state.cleared) {
      delay(16L)
      state =
        stepPlatformer(
          state = state,
          input =
            PlatformerInput(
              leftHeld = leftHeld,
              rightHeld = rightHeld,
              runHeld = runHeld,
              jumpPressed = jumpQueued,
            ),
          physics = physics,
          dt = 1f / 60f,
        )
      if (jumpQueued) jumpQueued = false
      bestScore = maxOf(bestScore, state.score)
    }
  }

  LaunchedEffect(Unit) {
    while (true) {
      delay(110L)
      animationTick += 1
    }
  }

  LaunchedEffect(selectedCourse.theme, running, state.crashed, state.cleared) {
    audio.setMusicTrack(
      assetPath = selectedCourse.theme.musicAssetPath,
      enabled = running && !state.crashed && !state.cleared,
    )
  }

  LaunchedEffect(state.score, state.crashed, state.cleared, state.enemies) {
    if (state.score > lastScore) {
      audio.play(PlatformerSoundEffect.Coin)
    }
    val aliveEnemies = state.enemies.count { it.alive }
    if (aliveEnemies < lastAliveEnemies) {
      audio.play(PlatformerSoundEffect.Stomp)
    }
    if (state.crashed && !lastCrashed) {
      audio.play(PlatformerSoundEffect.Damage)
    }
    if (state.cleared && !lastCleared) {
      audio.play(PlatformerSoundEffect.Clear)
    }
    lastScore = state.score
    lastAliveEnemies = aliveEnemies
    lastCrashed = state.crashed
    lastCleared = state.cleared
  }

  Column(
    modifier =
      Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    SolanaHeroTitle(
      eyebrow = "Arcade Runtime",
      title = selectedCourse.name,
      subtitle = selectedCourse.subtitle,
    )

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      SolanaStatusPill(
        label =
          when {
            state.cleared -> "Cleared"
            state.crashed -> "Down"
            running -> "Live"
            else -> "Standby"
          },
        active = !state.crashed,
        tone =
          when {
            state.cleared -> SolanaPanelTone.Purple
            state.crashed -> SolanaPanelTone.Orange
            else -> SolanaPanelTone.Green
          },
      )
      SolanaStatusPill(
        label = selectedCourse.theme.label,
        active = true,
        tone = SolanaPanelTone.Purple,
      )
      SolanaStatusPill(
        label = selectedCharacter.label,
        active = true,
        tone = SolanaPanelTone.Orange,
      )
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
      SolanaSectionLabel("Stage Select", tone = SolanaPanelTone.Purple)
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        courses.forEach { course ->
          PlatformerSelectChip(
            label = course.name,
            active = selectedCourse.id == course.id,
            tone = if (selectedCourse.id == course.id) SolanaPanelTone.Purple else SolanaPanelTone.Neutral,
          ) {
            selectedCourseId = course.id
          }
        }
      }
      SolanaSectionLabel("Character", tone = SolanaPanelTone.Orange)
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        PlatformerRunnerCharacter.entries.forEach { character ->
          PlatformerSelectChip(
            label = character.label,
            active = selectedCharacter == character,
            tone = if (selectedCharacter == character) SolanaPanelTone.Orange else SolanaPanelTone.Neutral,
            bitmap = assets.playerLifeIcons[character],
          ) {
            selectedCharacter = character
          }
        }
      }
    }

    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      SolanaMetricTile(
        label = "Coins",
        value = "${state.score}/${state.coins.size}",
        tone = SolanaPanelTone.Green,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Enemies",
        value = state.enemies.count { it.alive }.toString(),
        tone = SolanaPanelTone.Purple,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Zone",
        value = "${(state.player.x / state.worldWidth * 100f).toInt()}%",
        tone = SolanaPanelTone.Orange,
        modifier = Modifier.weight(1f),
      )
      SolanaMetricTile(
        label = "Best",
        value = bestScore.toString(),
        tone = SolanaPanelTone.Green,
        modifier = Modifier.weight(1f),
      )
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Green) {
      SolanaSectionLabel(selectedCourse.name)
      Text(
        "Tap Play or press LEFT, RIGHT, or JUMP to start immediately.",
        style = mobileCaption1,
        color = mobileTextSecondary,
      )
      Box(modifier = Modifier.fillMaxWidth()) {
        val boardModifier =
          Modifier
            .fillMaxWidth()
            .aspectRatio(platformerViewportWidth / platformerViewportHeight)

        Surface(
          modifier = boardModifier,
          shape = RoundedCornerShape(6.dp),
          color = mobileCodeBg,
          border = BorderStroke(1.dp, mobileBorder),
        ) {
          Box(modifier = Modifier.fillMaxSize()) {
            Canvas(modifier = Modifier.fillMaxSize()) {
              val scale = min(size.width / platformerViewportWidth, size.height / platformerViewportHeight)
              val boardWidth = platformerViewportWidth * scale
              val boardHeight = platformerViewportHeight * scale
              val originX = (size.width - boardWidth) / 2f
              val originY = (size.height - boardHeight) / 2f
              val cameraX =
                (state.player.x + platformerPlayerWidth / 2f - platformerViewportWidth / 2f)
                  .coerceIn(0f, state.worldWidth - platformerViewportWidth)

              drawRect(
                brush = Brush.verticalGradient(platformerThemeGradient(selectedCourse.theme)),
              )

              for (index in 0..12) {
                val lineY = originY + (index / 12f) * boardHeight
                drawLine(
                  color = mobileSuccess.copy(alpha = 0.05f),
                  start = Offset(originX, lineY),
                  end = Offset(originX + boardWidth, lineY),
                  strokeWidth = 1f,
                )
              }

              fun worldX(x: Float): Float = originX + ((x - cameraX) / platformerViewportWidth) * boardWidth
              fun worldY(y: Float): Float = originY + (y / platformerViewportHeight) * boardHeight
              fun worldW(width: Float): Float = (width / platformerViewportWidth) * boardWidth
              fun worldH(height: Float): Float = (height / platformerViewportHeight) * boardHeight

              drawParallaxLayer(
                bitmap = themeAssets?.clouds,
                cameraX = cameraX,
                parallax = 0.12f,
                left = originX,
                top = worldY(0f),
                width = boardWidth,
                height = worldH(72f),
                alpha = if (selectedCourse.theme == PlatformerCourseTheme.GhostHouse) 0.34f else 0.56f,
              )
              drawParallaxLayer(
                bitmap = themeAssets?.hills,
                cameraX = cameraX,
                parallax = 0.22f,
                left = originX,
                top = worldY(74f),
                width = boardWidth,
                height = worldH(116f),
                alpha = 0.98f,
              )
              drawParallaxLayer(
                bitmap = themeAssets?.bush,
                cameraX = cameraX,
                parallax = 0.46f,
                left = originX,
                top = worldY(148f),
                width = boardWidth,
                height = worldH(56f),
                alpha = 0.92f,
              )

              val goalPoleX = worldX(state.goalX)
              drawBitmapRegion(
                bitmap = assets.flagPole,
                source = platformerFlagPoleFrame,
                left = goalPoleX,
                top = worldY(32f),
                width = worldW(16f),
                height = worldH(176f),
              )
              drawBitmapRegion(
                bitmap = assets.flag,
                source = platformerFlagFrame,
                left = goalPoleX - worldW(12f),
                top = worldY(58f),
                width = worldW(18f),
                height = worldH(18f),
              )

              val questionFrame = platformerQuestionFrames[animationTick % platformerQuestionFrames.size]
              state.platforms.forEach { platform ->
                val px = worldX(platform.x)
                val py = worldY(platform.y)
                val pw = worldW(platform.width)
                val ph = worldH(platform.height)
                val floatingPlatform = platform.height <= 16f
                drawTiledBitmapRegion(
                  bitmap = if (floatingPlatform) assets.questionBlock else themeAssets?.terrain,
                  source = if (floatingPlatform) questionFrame else platformerBrickFrame,
                  left = px,
                  top = py,
                  width = pw,
                  height = ph,
                  tileWidth = worldW(16f),
                  tileHeight = worldH(16f),
                )
              }

              val coinFrame = platformerCoinFrames[animationTick % platformerCoinFrames.size]
              state.coins.forEach { coin ->
                if (coin.collected) return@forEach
                drawBitmapRegion(
                  bitmap = assets.coin,
                  source = coinFrame,
                  left = worldX(coin.x),
                  top = worldY(coin.y),
                  width = worldW(platformerCoinSize + 2f),
                  height = worldH(platformerCoinSize + 2f),
                )
              }

              val goombaFrame = platformerGoombaFrames[animationTick % platformerGoombaFrames.size]
              state.enemies.forEach { enemy ->
                if (!enemy.alive) return@forEach
                drawBitmapRegion(
                  bitmap = themeAssets?.enemy,
                  source = goombaFrame,
                  left = worldX(enemy.x - 1f),
                  top = worldY(enemy.y - 2f),
                  width = worldW(16f),
                  height = worldH(16f),
                  flipX = enemy.direction > 0,
                )
              }

              val playerFrame =
                when {
                  !state.player.onGround -> platformerPlayerJumpFrame
                  abs(state.player.vx) > 1.2f -> platformerPlayerRunFrames[animationTick % platformerPlayerRunFrames.size]
                  else -> platformerPlayerIdleFrame
                }
              drawBitmapRegion(
                bitmap = playerSprite,
                source = playerFrame,
                left = worldX(state.player.x - 1f),
                top = worldY(state.player.y - 4f),
                width = worldW(18f),
                height = worldH(20f),
                flipX = !state.player.facingRight,
              )

              if (state.crashed || state.cleared) {
                drawRect(color = Color.Black.copy(alpha = 0.58f))
              }
            }

            if (state.crashed || state.cleared) {
              Column(
                modifier = Modifier.fillMaxSize().padding(20.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
              ) {
                Text(
                  if (state.cleared) "STAGE CLEAR" else "RUN LOST",
                  style = mobileTitle2,
                  color = if (state.cleared) mobileAccent else mobileOrange,
                )
                Text(
                  if (state.cleared) "You cleared the neon course. Reset and run it again." else "An enemy or gap took the run offline. Reset and try again.",
                  style = mobileCallout,
                  color = mobileText,
                  modifier = Modifier.padding(top = 8.dp),
                )
              }
            }
          }
        }
      }
    }

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Purple) {
      SolanaSectionLabel("Controls", tone = SolanaPanelTone.Purple)
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
          playerLifeIcon?.let { icon ->
            Image(
              bitmap = icon.asImageBitmap(),
              contentDescription = selectedCharacter.label,
              modifier = Modifier.size(24.dp),
            )
          }
          Text(
            text = "${selectedCharacter.label} · ${selectedCourse.theme.label}",
            style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
            color = mobileText,
          )
        }
        Text(
          text = if (running) "MUSIC LIVE" else "MUSIC STANDBY",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
          color = mobileTextSecondary,
        )
      }
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        PlatformerActionButton(
          label = if (running) "Pause" else if (state.cleared) "Cleared" else if (state.crashed) "Crashed" else "Play",
          enabled = !state.crashed && !state.cleared,
          tone = SolanaPanelTone.Green,
          modifier = Modifier.weight(1f),
          bitmap = assets.controlIcons.run,
        ) {
          running = !running
        }
        PlatformerActionButton(
          label = "Reset",
          enabled = true,
          tone = SolanaPanelTone.Orange,
          modifier = Modifier.weight(1f),
          bitmap = assets.controlIcons.jump,
        ) {
          resetGame()
        }
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          PlatformerHoldButton(
            label = "LEFT",
            tone = SolanaPanelTone.Purple,
            bitmap = assets.controlIcons.left,
            onPressedChange = {
              leftHeld = it
              if (it) requestGameplayStart()
            },
          )
          PlatformerHoldButton(
            label = "RIGHT",
            tone = SolanaPanelTone.Purple,
            bitmap = assets.controlIcons.right,
            onPressedChange = {
              rightHeld = it
              if (it) requestGameplayStart()
            },
          )
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          PlatformerHoldButton(
            label = "SPRINT",
            tone = SolanaPanelTone.Green,
            bitmap = assets.controlIcons.run,
            onPressedChange = { runHeld = it },
          )
          PlatformerActionButton(
            label = "Jump",
            enabled = true,
            tone = SolanaPanelTone.Orange,
            modifier = Modifier.width(96.dp),
            bitmap = assets.controlIcons.jump,
          ) {
            if (state.player.onGround && !state.crashed && !state.cleared) {
              audio.play(PlatformerSoundEffect.Jump)
            }
            jumpQueued = true
            requestGameplayStart()
          }
        }
      }
    }

    SolanaBackplaneCard(
      title = "Remaster Bundle",
      subtitle = "Seekr now bundles the SMB remaster project metadata alongside the mirrored assets, scenes, and scripts. The current gameplay tab still runs the native Android training loop, but the Godot project mirror is validated here for launcher readiness.",
      links =
        listOf(
          SolanaBackendLink(
            label = "Project",
            state = if (bundleStatus.projectReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/project.godot",
            tone = SolanaPanelTone.Green,
            active = bundleStatus.projectReady,
          ),
          SolanaBackendLink(
            label = "Addons",
            state = if (bundleStatus.addonsReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/addons",
            tone = SolanaPanelTone.Purple,
            active = bundleStatus.addonsReady,
          ),
          SolanaBackendLink(
            label = "Audio",
            state = if (bundleStatus.audioReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/Assets/Audio",
            tone = SolanaPanelTone.Green,
            active = bundleStatus.audioReady,
          ),
          SolanaBackendLink(
            label = "Sprites",
            state = if (bundleStatus.spriteReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/Assets/Sprites",
            tone = SolanaPanelTone.Purple,
            active = bundleStatus.spriteReady,
          ),
          SolanaBackendLink(
            label = "Scenes",
            state = if (bundleStatus.sceneReady) "Reference" else "Missing",
            detail = "$platformerRemasterRoot/Scenes",
            tone = SolanaPanelTone.Orange,
            active = bundleStatus.sceneReady,
          ),
          SolanaBackendLink(
            label = "Scripts",
            state = if (bundleStatus.scriptReady) "Reference" else "Missing",
            detail = "$platformerRemasterRoot/Scripts",
            tone = SolanaPanelTone.Green,
            active = bundleStatus.scriptReady,
          ),
          SolanaBackendLink(
            label = "UI",
            state = if (bundleStatus.uiReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/Assets/Sprites/UI",
            tone = SolanaPanelTone.Purple,
            active = bundleStatus.uiReady,
          ),
          SolanaBackendLink(
            label = "Levels",
            state = if (bundleStatus.levelReady) "Reference" else "Missing",
            detail = "$platformerRemasterRoot/Scenes/Levels",
            tone = SolanaPanelTone.Orange,
            active = bundleStatus.levelReady,
          ),
          SolanaBackendLink(
            label = "Audio Bus",
            state = if (bundleStatus.audioBusReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/default_bus_layout.tres",
            tone = SolanaPanelTone.Green,
            active = bundleStatus.audioBusReady,
          ),
          SolanaBackendLink(
            label = "Entity IDs",
            state = if (bundleStatus.entityMapReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/EntityIDMap.json",
            tone = SolanaPanelTone.Purple,
            active = bundleStatus.entityMapReady,
          ),
          SolanaBackendLink(
            label = "Input Map",
            state = if (bundleStatus.selectorMapReady) "Bundled" else "Missing",
            detail = "$platformerRemasterRoot/SelectorKeyMap.json",
            tone = SolanaPanelTone.Orange,
            active = bundleStatus.selectorMapReady,
          ),
          SolanaBackendLink(
            label = "Course Data",
            state = if (importedClassicLevel != null) "Loaded" else "Fallback",
            detail = "arcade/classic_platformer_level.json",
            tone = SolanaPanelTone.Green,
            active = importedClassicLevel != null,
          ),
          SolanaBackendLink(
            label = "Physics",
            state = if (classicPhysicsReady) "Loaded" else "Fallback",
            detail = "arcade/classic_physics.json",
            tone = SolanaPanelTone.Purple,
            active = classicPhysicsReady,
          ),
        ),
    )

    SolanaPanel(modifier = Modifier.fillMaxWidth(), tone = SolanaPanelTone.Orange) {
      SolanaSectionLabel("Operator Notes", tone = SolanaPanelTone.Orange)
      Text(
        "> Physics and the primary training lane still load from bundled JSON assets while the gameplay loop remains Android-native.\n> The SMB remaster bundle now includes project metadata, addon/plugin content, audio bus layout, and selector/entity maps so the packaged mirror matches the real Godot project more closely.\n> A full Seekr SMB boot still requires a Godot runtime/activity integration; this panel now reports that readiness honestly instead of treating partial scene mirroring as complete.\n> Hold LEFT or RIGHT to move, hold RUN for faster acceleration, tap JUMP to clear gaps and stomp through the lane.",
        style = mobileCallout,
        color = mobileText,
      )
    }
  }
}

@Composable
private fun PlatformerActionButton(
  label: String,
  enabled: Boolean,
  tone: SolanaPanelTone,
  modifier: Modifier = Modifier,
  bitmap: Bitmap? = null,
  onClick: () -> Unit,
) {
  val borderColor = platformerToneColor(tone)
  val bgColor = platformerToneBackground(tone)
  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = modifier.height(46.dp),
    shape = RoundedCornerShape(4.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = bgColor,
        contentColor = borderColor,
        disabledContainerColor = mobileSurfaceStrong,
        disabledContentColor = mobileTextTertiary,
      ),
    border = BorderStroke(1.dp, borderColor),
  ) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
      bitmap?.let {
        Image(
          bitmap = it.asImageBitmap(),
          contentDescription = null,
          modifier = Modifier.size(18.dp),
        )
      }
      Text(label.uppercase(), style = mobileHeadline)
    }
  }
}

@Composable
private fun PlatformerHoldButton(
  label: String,
  tone: SolanaPanelTone,
  bitmap: Bitmap? = null,
  onPressedChange: (Boolean) -> Unit,
) {
  var pressed by remember { mutableStateOf(false) }
  val borderColor = platformerToneColor(tone)
  val bgColor = if (pressed) borderColor.copy(alpha = 0.18f) else platformerToneBackground(tone)

  Surface(
    modifier =
      Modifier
        .size(width = 96.dp, height = 46.dp)
        .pointerInput(onPressedChange) {
          detectTapGestures(
            onPress = {
              pressed = true
              onPressedChange(true)
              tryAwaitRelease()
              pressed = false
              onPressedChange(false)
            },
          )
        },
    shape = RoundedCornerShape(4.dp),
    color = bgColor,
    border = BorderStroke(1.dp, borderColor),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        bitmap?.let {
          Image(
            bitmap = it.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
          )
        }
        Text(
          text = label.uppercase(),
          style = mobileHeadline.copy(fontWeight = if (pressed) FontWeight.Bold else FontWeight.SemiBold),
          color = borderColor,
        )
      }
    }
  }
}

@Composable
private fun PlatformerSelectChip(
  label: String,
  active: Boolean,
  tone: SolanaPanelTone,
  bitmap: Bitmap? = null,
  onClick: () -> Unit,
) {
  val borderColor = if (active) platformerToneColor(tone) else mobileBorderStrong
  val background = if (active) platformerToneBackground(tone) else mobileSurfaceStrong
  Surface(
    onClick = onClick,
    shape = RoundedCornerShape(999.dp),
    color = background,
    border = BorderStroke(1.dp, borderColor),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      bitmap?.let {
        Image(
          bitmap = it.asImageBitmap(),
          contentDescription = null,
          modifier = Modifier.size(18.dp),
        )
      }
      Text(
        text = label,
        style = mobileCaption1.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
        color = if (active) borderColor else mobileTextSecondary,
      )
    }
  }
}

private fun platformerToneColor(tone: SolanaPanelTone): Color =
  when (tone) {
    SolanaPanelTone.Green -> mobileSuccess
    SolanaPanelTone.Purple -> mobileAccent
    SolanaPanelTone.Orange -> mobileOrange
    SolanaPanelTone.Neutral -> mobileBorderStrong
  }

private fun platformerToneBackground(tone: SolanaPanelTone): Color =
  when (tone) {
    SolanaPanelTone.Green -> mobileSuccessSoft
    SolanaPanelTone.Purple -> mobileAccentSoft
    SolanaPanelTone.Orange -> mobileOrangeSoft
    SolanaPanelTone.Neutral -> mobileSurfaceStrong
  }

private fun platformerThemeGradient(theme: PlatformerCourseTheme): List<Color> =
  when (theme) {
    PlatformerCourseTheme.Overworld ->
      listOf(Color(0xFF5CC7FF), Color(0xFF8DEBFF), Color(0xFFD5F6FF))
    PlatformerCourseTheme.Beach ->
      listOf(Color(0xFF6BCBFF), Color(0xFF7BE0FF), Color(0xFFF4F1C9))
    PlatformerCourseTheme.GhostHouse ->
      listOf(Color(0xFF1D1F3B), Color(0xFF34315C), Color(0xFF6B6F90))
    PlatformerCourseTheme.Castle ->
      listOf(Color(0xFF2A2022), Color(0xFF5A3A34), Color(0xFF8D644E))
  }

@Composable
private fun rememberClassicPhysicsProfile(context: Context): ClassicPhysicsProfile =
  remember(context) {
    runCatching {
      context.assets.open("arcade/classic_physics.json").bufferedReader().use { reader ->
        parseClassicPhysicsProfile(reader.readText())
      }
    }.getOrDefault(ClassicPhysicsProfile())
  }

@Composable
private fun rememberPlatformerAudio(context: Context): PlatformerAudioController {
  val controller = remember(context) { PlatformerAudioController(context) }
  DisposableEffect(controller) {
    onDispose { controller.release() }
  }
  return controller
}

private fun loadBitmapAsset(context: Context, assetPath: String): Bitmap? =
  loadBitmapAsset(context, listOf(assetPath))

private fun loadBitmapAsset(
  context: Context,
  assetPaths: List<String>,
): Bitmap? =
  assetPaths.firstNotNullOfOrNull { assetPath ->
    runCatching {
      context.assets.open(assetPath).use { stream ->
        BitmapFactory.decodeStream(stream)
      }
    }.getOrNull()
  }

private fun loadBitmapAsset(
  context: Context,
  vararg assetPaths: String,
): Bitmap? = loadBitmapAsset(context, assetPaths.toList())

@Composable
private fun rememberClassicPlatformerLevel(context: Context): ClassicPlatformerLevelAsset? =
  remember(context) {
    runCatching {
      context.assets.open("arcade/classic_platformer_level.json").bufferedReader().use { reader ->
        parseClassicPlatformerLevel(reader.readText())
      }
    }.getOrNull()
  }

@Composable
private fun rememberPlatformerAssets(context: Context): PlatformerVisualAssets =
  remember(context) {
    PlatformerVisualAssets(
      themeAssets =
        PlatformerCourseTheme.entries.associateWith { theme ->
          PlatformerThemeAssets(
            hills = loadBitmapAsset(context, theme.hillsAssetPath, "$platformerAssetRoot/backgrounds/overworld_hills.png"),
            bush = loadBitmapAsset(context, theme.bushAssetPath, "$platformerAssetRoot/backgrounds/bush.png"),
            clouds = loadBitmapAsset(context, theme.cloudAssetPath, "$platformerAssetRoot/backgrounds/cloud_overlay.png"),
            terrain = loadBitmapAsset(context, theme.terrainAssetPath, "$platformerAssetRoot/tiles/terrain_overworld.png"),
            enemy = loadBitmapAsset(context, theme.enemyAssetPath, "$platformerAssetRoot/enemies/goomba.png"),
          )
        },
      playerSprites =
        PlatformerRunnerCharacter.entries.associateWith { character ->
          when (character) {
            PlatformerRunnerCharacter.Mario -> loadBitmapAsset(context, character.spriteAssetPath, "$platformerAssetRoot/players/mario_small.png")
            else -> loadBitmapAsset(context, character.spriteAssetPath)
          }
        },
      playerLifeIcons =
        PlatformerRunnerCharacter.entries.associateWith { character ->
          loadBitmapAsset(context, character.lifeIconAssetPath)
        },
      controlIcons =
        PlatformerControlIcons(
          left = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/UI/OnScreenControls/Left.png"),
          right = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/UI/OnScreenControls/Right.png"),
          jump = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/UI/OnScreenControls/A.png"),
          run = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/UI/OnScreenControls/B.png"),
        ),
      coin = loadBitmapAsset(context, "$platformerAssetRoot/ui/coin_icon.png"),
      questionBlock = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/Blocks/QuestionBlock.png", "$platformerAssetRoot/blocks/question_block.png"),
      flagPole = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/Tilesets/FlagPole.png", "$platformerAssetRoot/tiles/flagpole.png"),
      flag = loadBitmapAsset(context, "$platformerRemasterAssetsRoot/Sprites/Tilesets/Flag.png", "$platformerAssetRoot/tiles/flag.png"),
    )
  }

private fun DrawScope.drawParallaxLayer(
  bitmap: Bitmap?,
  cameraX: Float,
  parallax: Float,
  left: Float,
  top: Float,
  width: Float,
  height: Float,
  alpha: Float,
) {
  if (bitmap == null) return
  val layerWidth = width * 1.15f
  val shift = ((cameraX * parallax / platformerViewportWidth) * width) % layerWidth
  for (index in -1..2) {
    drawBitmap(
      bitmap = bitmap,
      source = null,
      left = left + index * layerWidth - shift,
      top = top,
      width = layerWidth,
      height = height,
      alpha = alpha,
    )
  }
}

private fun DrawScope.drawTiledBitmapRegion(
  bitmap: Bitmap?,
  source: PlatformerSpriteFrame,
  left: Float,
  top: Float,
  width: Float,
  height: Float,
  tileWidth: Float,
  tileHeight: Float,
) {
  if (bitmap == null || tileWidth <= 0f || tileHeight <= 0f) return
  var tileTop = top
  var remainingHeight = height
  while (remainingHeight > 0.5f) {
    val drawHeight = min(tileHeight, remainingHeight)
    val sourceHeightRatio = drawHeight / tileHeight
    var tileLeft = left
    var remainingWidth = width
    while (remainingWidth > 0.5f) {
      val drawWidth = min(tileWidth, remainingWidth)
      val sourceWidthRatio = drawWidth / tileWidth
      drawBitmapRegion(
        bitmap = bitmap,
        source = source,
        left = tileLeft,
        top = tileTop,
        width = drawWidth,
        height = drawHeight,
        sourceWidthRatio = sourceWidthRatio,
        sourceHeightRatio = sourceHeightRatio,
      )
      tileLeft += drawWidth
      remainingWidth -= drawWidth
    }
    tileTop += drawHeight
    remainingHeight -= drawHeight
  }
}

private fun DrawScope.drawBitmapRegion(
  bitmap: Bitmap?,
  source: PlatformerSpriteFrame,
  left: Float,
  top: Float,
  width: Float,
  height: Float,
  alpha: Float = 1f,
  flipX: Boolean = false,
  sourceWidthRatio: Float = 1f,
  sourceHeightRatio: Float = 1f,
) {
  if (bitmap == null || width <= 0f || height <= 0f) return
  val srcWidth = (source.width * sourceWidthRatio).roundToInt().coerceAtLeast(1)
  val srcHeight = (source.height * sourceHeightRatio).roundToInt().coerceAtLeast(1)
  val srcRect = Rect(source.x, source.y, source.x + srcWidth, source.y + srcHeight)
  drawBitmap(
    bitmap = bitmap,
    source = srcRect,
    left = left,
    top = top,
    width = width,
    height = height,
    alpha = alpha,
    flipX = flipX,
  )
}

private fun DrawScope.drawBitmap(
  bitmap: Bitmap?,
  source: Rect?,
  left: Float,
  top: Float,
  width: Float,
  height: Float,
  alpha: Float = 1f,
  flipX: Boolean = false,
) {
  if (bitmap == null || width <= 0f || height <= 0f) return
  drawIntoCanvas { canvas ->
    val paint =
      Paint().apply {
        isAntiAlias = false
        isFilterBitmap = false
        this.alpha = (alpha * 255f).roundToInt().coerceIn(0, 255)
      }
    val destination = RectF(left, top, left + width, top + height)
    val nativeCanvas = canvas.nativeCanvas
    nativeCanvas.withSave {
      if (flipX) {
        scale(-1f, 1f, destination.centerX(), destination.centerY())
      }
      drawBitmap(bitmap, source, destination, paint)
    }
  }
}

private fun moveToward(current: Float, target: Float, maxDelta: Float): Float =
  when {
    current < target -> min(current + maxDelta, target)
    current > target -> kotlin.math.max(current - maxDelta, target)
    else -> current
  }

private fun resolveHorizontalMove(
  x: Float,
  y: Float,
  vx: Float,
  platforms: List<PlatformerRect>,
  dt: Float,
): Pair<Float, Float> {
  var nextX = x + vx * dt
  var nextVx = vx
  for (platform in platforms) {
    if (!intersects(nextX, y, platformerPlayerWidth, platformerPlayerHeight, platform.x, platform.y, platform.width, platform.height)) continue
    if (vx > 0f) {
      nextX = platform.x - platformerPlayerWidth
      nextVx = 0f
    } else if (vx < 0f) {
      nextX = platform.x + platform.width
      nextVx = 0f
    }
  }
  return nextX to nextVx
}

private fun resolveVerticalMove(
  x: Float,
  y: Float,
  vy: Float,
  platforms: List<PlatformerRect>,
  dt: Float,
): Triple<Float, Float, Boolean> {
  var nextY = y + vy * dt
  var nextVy = vy
  var onGround = false
  for (platform in platforms) {
    if (!intersects(x, nextY, platformerPlayerWidth, platformerPlayerHeight, platform.x, platform.y, platform.width, platform.height)) continue
    if (vy > 0f) {
      nextY = platform.y - platformerPlayerHeight
      nextVy = 0f
      onGround = true
    } else if (vy < 0f) {
      nextY = platform.y + platform.height
      nextVy = 0f
    }
  }
  return Triple(nextY, nextVy, onGround)
}

private fun intersects(
  ax: Float,
  ay: Float,
  aw: Float,
  ah: Float,
  bx: Float,
  by: Float,
  bw: Float,
  bh: Float,
): Boolean = ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
