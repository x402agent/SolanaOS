package ai.openclaw.app.ui

import ai.openclaw.app.arcade.SmbGodotActivity
import ai.openclaw.app.arcade.loadSmbRemasterBundleStatus
import ai.openclaw.app.arcade.smbRemasterAssetRoot
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun ArcadeSmbLauncherScreen() {
  val context = LocalContext.current
  val bundleStatus = remember(context) { loadSmbRemasterBundleStatus(context) }

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
      title = "SMB Remastered",
      subtitle =
        "Seekr now routes platformer mode through an embedded Godot runtime. The packaged SMB project is launched as a real Godot export instead of the placeholder Compose training loop.",
    )

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, if (bundleStatus.ready) mobileSuccess.copy(alpha = 0.28f) else mobileBorderStrong),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        Text(
          text = "Embedded Godot Launch",
          style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
          color = mobileText,
        )
        Text(
          text =
            if (bundleStatus.ready) {
              "The SMB bundle is present and the app can hand off to a dedicated Godot activity. First boot lands in the remaster disclaimer and ROM verifier flow, which still requires a legal base ROM before gameplay assets unlock."
            } else {
              "The Godot launcher is wired, but the mirrored SMB bundle is incomplete. Fix the missing source or exported bundle items below before trying to boot the remaster on-device."
            },
          style = mobileBody,
          color = mobileTextSecondary,
        )
        Button(
          onClick = {
            if (!bundleStatus.ready) {
              Toast
                .makeText(context, "SMB remaster bundle is incomplete.", Toast.LENGTH_SHORT)
                .show()
              return@Button
            }
            context.startActivity(SmbGodotActivity.createIntent(context))
          },
          enabled = bundleStatus.ready,
          shape = androidx.compose.foundation.shape.RoundedCornerShape(14.dp),
          colors =
            ButtonDefaults.buttonColors(
              containerColor = mobileAccent,
              contentColor = Color.White,
              disabledContainerColor = mobileSurfaceStrong,
              disabledContentColor = mobileTextSecondary,
            ),
        ) {
          Text(
            text = "Launch SMB Remastered",
            style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
          )
        }
        Text(
          text = "Main project root: $smbRemasterAssetRoot",
          style = mobileCaption1,
          color = mobileTextTertiary,
        )
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorderStrong),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Text(
          text = "Bundle Checks",
          style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
          color = mobileText,
        )
        FlowRow(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          SmbStatusChip("project.godot", bundleStatus.projectReady)
          SmbStatusChip("project.binary", bundleStatus.binaryReady)
          SmbStatusChip(".godot/exported", bundleStatus.exportCacheReady)
          SmbStatusChip(".godot/uid_cache", bundleStatus.uidCacheReady)
          SmbStatusChip("addons", bundleStatus.addonsReady)
          SmbStatusChip("audio", bundleStatus.audioReady)
          SmbStatusChip("sprites", bundleStatus.spriteReady)
          SmbStatusChip("scenes", bundleStatus.sceneReady)
          SmbStatusChip("scripts", bundleStatus.scriptReady)
          SmbStatusChip("bus layout", bundleStatus.audioBusReady)
          SmbStatusChip("entity map", bundleStatus.entityMapReady)
          SmbStatusChip("selector map", bundleStatus.selectorMapReady)
        }
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
      color = mobileSurfaceStrong,
      border = BorderStroke(1.dp, mobileBorderStrong),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Text(
          text = "Operator Notes",
          style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
          color = mobileText,
        )
        Text(
          text = "This launcher uses the Godot Android runtime against a staged asset-root copy of the SMB project so the engine can discover both `project.godot` and the compiled `project.binary` export exactly where the embedded host expects them.",
          style = mobileBody,
          color = mobileTextSecondary,
        )
        Text(
          text = "The old native Compose platformer lane is no longer the active path for arcade platformer mode.",
          style = mobileBody,
          color = mobileTextSecondary,
        )
        Text(
          text = "If the Godot boot still fails, check logcat for missing `.godot/exported` payload entries or plugin load errors from the AndroidFilePicker addon.",
          style = mobileBody,
          color = mobileTextSecondary,
        )
      }
    }
  }
}

@Composable
private fun SmbStatusChip(label: String, ready: Boolean) {
  Surface(
    shape = androidx.compose.foundation.shape.RoundedCornerShape(999.dp),
    color = if (ready) mobileSuccessSoft else mobileDangerSoft,
    border = BorderStroke(1.dp, if (ready) mobileSuccess.copy(alpha = 0.25f) else mobileDanger.copy(alpha = 0.25f)),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp),
      horizontalArrangement = Arrangement.spacedBy(6.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Text(
        text = if (ready) "READY" else "MISS",
        style = mobileCaption2.copy(fontWeight = FontWeight.Bold),
        color = if (ready) mobileSuccess else mobileDanger,
      )
      Text(
        text = label,
        style = mobileCaption1,
        color = mobileText,
      )
    }
  }
}
