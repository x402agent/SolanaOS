package ai.openclaw.app.ui.chat

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import ai.openclaw.app.ui.mobileAccent
import ai.openclaw.app.ui.mobileAccentSoft
import ai.openclaw.app.ui.mobileBody
import ai.openclaw.app.ui.mobileBorder
import ai.openclaw.app.ui.mobileBorderStrong
import ai.openclaw.app.ui.mobileCallout
import ai.openclaw.app.ui.mobileCaption1
import ai.openclaw.app.ui.mobileCaption2
import ai.openclaw.app.ui.mobileHeadline
import ai.openclaw.app.ui.mobileFontFamily
import ai.openclaw.app.ui.mobileDanger
import ai.openclaw.app.ui.mobileDangerSoft
import ai.openclaw.app.ui.mobileSuccess
import ai.openclaw.app.ui.mobileSuccessSoft
import ai.openclaw.app.ui.mobileSurface
import ai.openclaw.app.ui.mobileSurfaceStrong
import ai.openclaw.app.ui.mobileText
import ai.openclaw.app.ui.mobileTextSecondary
import ai.openclaw.app.ui.mobileTextTertiary
import ai.openclaw.app.ui.mobileWarning

private val lightChatText = mobileText
private val lightChatSecondaryText = mobileTextSecondary
private val lightChatTertiaryText = mobileTextTertiary
private val lightChatSurface = mobileSurface
private val lightChatMutedSurface = mobileAccentSoft
private val lightChatBorder = mobileBorder

@Composable
fun ChatComposer(
  healthOk: Boolean,
  nodeBridgeOnly: Boolean,
  openRouterAvailable: Boolean,
  chatStatusText: String,
  thinkingLevel: String,
  pendingRunCount: Int,
  attachments: List<PendingImageAttachment>,
  onPickImages: () -> Unit,
  onRemoveAttachment: (id: String) -> Unit,
  onSetThinkingLevel: (level: String) -> Unit,
  onRefresh: () -> Unit,
  onAbort: () -> Unit,
  onSend: (text: String) -> Unit,
) {
  var input by rememberSaveable { mutableStateOf("") }
  var showThinkingMenu by remember { mutableStateOf(false) }

  val canSend = pendingRunCount == 0 && (input.trim().isNotEmpty() || attachments.isNotEmpty()) && healthOk
  val sendBusy = pendingRunCount > 0
  val trimmedLength = input.trim().length

  fun dispatchSend() {
    if (!canSend) return
    val text = input
    input = ""
    onSend(text)
  }

  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(20.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(
            text = "CHAT COMPOSER",
            style = mobileCaption2.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.9.sp),
            color = mobileTextSecondary,
          )
          Text(
            text =
              when {
                sendBusy -> "Runtime is responding. You can stop or wait for the reply."
                healthOk -> "Ready to send prompts, tools, and image analysis requests."
                nodeBridgeOnly && openRouterAvailable -> chatStatusText
                nodeBridgeOnly -> "Basic node bridge connected. Pair the full runtime for gateway chat."
                openRouterAvailable -> chatStatusText
                else -> "No chat backend is ready yet."
              },
            style = mobileCallout,
            color = if (healthOk) mobileText else mobileWarning,
          )
        }
        ChatComposerStatusBadge(
          label = if (sendBusy) "Busy" else if (healthOk) "Ready" else "Offline",
          accent = if (sendBusy) mobileAccent else if (healthOk) mobileSuccess else mobileWarning,
          background =
            if (sendBusy) mobileAccentSoft else if (healthOk) mobileSuccessSoft else mobileDangerSoft,
        )
      }

      Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        Box(modifier = Modifier.weight(1f)) {
          ThinkingSelectorChip(
            label = "Thinking: ${thinkingLabel(thinkingLevel)}",
            onClick = { showThinkingMenu = true },
          )

          DropdownMenu(
            expanded = showThinkingMenu,
            onDismissRequest = { showThinkingMenu = false },
            containerColor = lightChatSurface,
          ) {
            ThinkingMenuItem("off", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
            ThinkingMenuItem("low", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
            ThinkingMenuItem("medium", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
            ThinkingMenuItem("high", thinkingLevel, onSetThinkingLevel) { showThinkingMenu = false }
          }
        }

        SecondaryActionButton(
          label = "Add image",
          icon = Icons.Default.AttachFile,
          enabled = true,
          onClick = onPickImages,
        )
      }

      if (attachments.isNotEmpty()) {
        AttachmentsStrip(attachments = attachments, onRemoveAttachment = onRemoveAttachment)
      }

      OutlinedTextField(
        value = input,
        onValueChange = { input = it },
        modifier =
          Modifier
            .fillMaxWidth()
            .heightIn(min = 116.dp, max = 220.dp)
            .animateContentSize(),
        placeholder = {
          Text(
            "Ask the runtime for trades, research, wallet actions, coding help, or image analysis.",
            style = mobileBodyStyle(),
            color = lightChatTertiaryText,
          )
        },
        minLines = 4,
        maxLines = 8,
        textStyle = mobileBodyStyle().copy(color = lightChatText),
        shape = RoundedCornerShape(18.dp),
        colors = chatTextFieldColors(),
        keyboardOptions =
          KeyboardOptions(
            capitalization = KeyboardCapitalization.Sentences,
            autoCorrectEnabled = true,
            keyboardType = KeyboardType.Text,
            imeAction = if (canSend) ImeAction.Send else ImeAction.Default,
          ),
        keyboardActions = KeyboardActions(onSend = { dispatchSend() }),
        supportingText = {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text(
              text =
                when {
                  attachments.isNotEmpty() -> "${attachments.size} image attachment${if (attachments.size == 1) "" else "s"} ready"
                  sendBusy -> "Waiting for the current run to finish"
                  else -> "Multi-line message supported"
                },
              style = mobileCaption1,
              color = lightChatSecondaryText,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
            )
            Text(
              text = "$trimmedLength chars",
              style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
              color = if (trimmedLength > 0) mobileAccent else lightChatTertiaryText,
            )
          }
        },
      )

      FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        SecondaryActionButton(
          label = "Refresh",
          icon = Icons.Default.Refresh,
          enabled = true,
          onClick = onRefresh,
        )

        SecondaryActionButton(
          label = "Stop",
          icon = Icons.Default.Stop,
          enabled = pendingRunCount > 0,
          danger = pendingRunCount > 0,
          onClick = onAbort,
        )

        PrimarySendButton(
          canSend = canSend,
          sendBusy = sendBusy,
          onClick = { dispatchSend() },
        )
      }
    }
  }
}

@Composable
private fun SecondaryActionButton(
  label: String,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  enabled: Boolean,
  danger: Boolean = false,
  onClick: () -> Unit,
) {
  val interactionSource = remember { MutableInteractionSource() }
  val pressed by interactionSource.collectIsPressedAsState()
  val containerColor by animateColorAsState(
    targetValue =
      when {
        !enabled -> mobileSurface
        pressed && danger -> mobileDangerSoft.copy(alpha = 0.9f)
        pressed -> mobileAccentSoft.copy(alpha = 0.9f)
        danger -> mobileDangerSoft
        else -> mobileSurface
      },
    label = "secondaryActionContainer",
  )
  val borderColor by animateColorAsState(
    targetValue =
      when {
        !enabled -> lightChatBorder
        danger -> mobileDanger
        pressed -> mobileAccent
        else -> lightChatBorder
      },
    label = "secondaryActionBorder",
  )
  val contentColor by animateColorAsState(
    targetValue =
      when {
        !enabled -> lightChatTertiaryText
        danger -> mobileDanger
        else -> lightChatSecondaryText
      },
    label = "secondaryActionContent",
  )
  Button(
    onClick = onClick,
    enabled = enabled,
    modifier = Modifier.height(46.dp),
    interactionSource = interactionSource,
    shape = RoundedCornerShape(14.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = containerColor,
        contentColor = contentColor,
        disabledContainerColor = mobileSurface,
        disabledContentColor = lightChatTertiaryText,
      ),
    border = BorderStroke(1.dp, borderColor),
  ) {
    Icon(icon, contentDescription = label, modifier = Modifier.size(16.dp))
    Spacer(modifier = Modifier.width(6.dp))
    Text(
      text = label,
      style = mobileCallout.copy(fontWeight = FontWeight.SemiBold),
      color = contentColor,
    )
  }
}

@Composable
private fun PrimarySendButton(
  canSend: Boolean,
  sendBusy: Boolean,
  onClick: () -> Unit,
) {
  val interactionSource = remember { MutableInteractionSource() }
  val pressed by interactionSource.collectIsPressedAsState()
  val containerColor by animateColorAsState(
    targetValue =
      when {
        !canSend -> mobileBorderStrong
        pressed -> mobileSuccess.copy(alpha = 0.2f)
        else -> mobileSuccessSoft
      },
    label = "sendButtonContainer",
  )
  val borderColor by animateColorAsState(
    targetValue = if (canSend) mobileSuccess else mobileBorderStrong,
    label = "sendButtonBorder",
  )

  Button(
    onClick = onClick,
    enabled = canSend,
    modifier = Modifier.height(48.dp),
    interactionSource = interactionSource,
    shape = RoundedCornerShape(16.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = containerColor,
        contentColor = mobileSuccess,
        disabledContainerColor = mobileBorderStrong,
        disabledContentColor = mobileTextTertiary,
      ),
    border = BorderStroke(1.dp, borderColor),
  ) {
    if (sendBusy) {
      CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = mobileSuccess)
    } else {
      Icon(Icons.AutoMirrored.Filled.Send, contentDescription = null, modifier = Modifier.size(16.dp))
    }
    Spacer(modifier = Modifier.width(8.dp))
    Text(
      text = if (sendBusy) "Sending…" else "Send",
      style = mobileHeadline.copy(fontWeight = FontWeight.Bold),
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
    )
  }
}

@Composable
private fun ChatComposerStatusBadge(label: String, accent: Color, background: Color) {
  Surface(
    shape = RoundedCornerShape(999.dp),
    color = background,
    border = BorderStroke(1.dp, accent.copy(alpha = 0.45f)),
  ) {
    Text(
      text = label.uppercase(),
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
      style = mobileCaption1.copy(fontWeight = FontWeight.Bold, letterSpacing = 0.8.sp),
      color = accent,
    )
  }
}

@Composable
private fun ThinkingSelectorChip(label: String, onClick: () -> Unit) {
  val interactionSource = remember { MutableInteractionSource() }
  val pressed by interactionSource.collectIsPressedAsState()
  val containerColor by animateColorAsState(
    targetValue = if (pressed) mobileAccentSoft.copy(alpha = 0.9f) else lightChatMutedSurface,
    label = "thinkingChipContainer",
  )
  val borderColor by animateColorAsState(
    targetValue = if (pressed) mobileAccent else mobileAccent.copy(alpha = 0.65f),
    label = "thinkingChipBorder",
  )
  Surface(
    onClick = onClick,
    interactionSource = interactionSource,
    shape = RoundedCornerShape(14.dp),
    color = containerColor,
    border = BorderStroke(1.dp, borderColor),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.SpaceBetween,
    ) {
      Text(
        text = label,
        style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold),
        color = lightChatText,
      )
      Icon(Icons.Default.ArrowDropDown, contentDescription = "Select thinking level", tint = lightChatSecondaryText)
    }
  }
}

@Composable
private fun ThinkingMenuItem(
  value: String,
  current: String,
  onSet: (String) -> Unit,
  onDismiss: () -> Unit,
) {
  DropdownMenuItem(
    text = { Text(thinkingLabel(value), style = mobileCallout, color = lightChatText) },
    onClick = {
      onSet(value)
      onDismiss()
    },
    trailingIcon = {
      if (value == current.trim().lowercase()) {
        Text("✓", style = mobileCallout, color = mobileAccent)
      } else {
        Spacer(modifier = Modifier.width(10.dp))
      }
    },
  )
}

private fun thinkingLabel(raw: String): String {
  return when (raw.trim().lowercase()) {
    "low" -> "Low"
    "medium" -> "Medium"
    "high" -> "High"
    else -> "Off"
  }
}

@Composable
private fun AttachmentsStrip(
  attachments: List<PendingImageAttachment>,
  onRemoveAttachment: (id: String) -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    for (att in attachments) {
      AttachmentChip(
        fileName = att.fileName,
        onRemove = { onRemoveAttachment(att.id) },
      )
    }
  }
}

@Composable
private fun AttachmentChip(fileName: String, onRemove: () -> Unit) {
  Surface(
    shape = RoundedCornerShape(14.dp),
    color = mobileAccentSoft,
    border = BorderStroke(1.dp, mobileBorderStrong),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text(
        text = fileName,
        style = mobileCaption1,
        color = mobileText,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
      Surface(
        onClick = onRemove,
        shape = RoundedCornerShape(10.dp),
        color = mobileSurface,
        border = BorderStroke(1.dp, mobileBorderStrong),
      ) {
        Text(
          text = "×",
          style = mobileCaption1.copy(fontWeight = FontWeight.Bold),
          color = mobileTextSecondary,
          modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
      }
    }
  }
}

@Composable
private fun chatTextFieldColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = lightChatSurface,
    unfocusedContainerColor = lightChatSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorderStrong,
    focusedLabelColor = mobileTextSecondary,
    unfocusedLabelColor = mobileTextSecondary,
    focusedTextColor = lightChatText,
    unfocusedTextColor = lightChatText,
    cursorColor = mobileAccent,
  )

@Composable
private fun mobileBodyStyle() =
  mobileBody.copy(
    fontFamily = mobileFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 15.sp,
    lineHeight = 23.sp,
  )
