package ai.openclaw.app.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.bitaxe.BitaxeDeviceSnapshot

@Composable
fun BitaxeTabScreen(viewModel: MainViewModel, onOpenDashboard: () -> Unit) {
  val storedBaseUrl by viewModel.bitaxeApiBaseUrl.collectAsState()
  val resolvedBaseUrl by viewModel.bitaxeResolvedBaseUrl.collectAsState()
  val storedApiKey by viewModel.bitaxeApiKey.collectAsState()
  val devices by viewModel.bitaxeDevices.collectAsState()
  val statusText by viewModel.bitaxeStatusText.collectAsState()
  val busy by viewModel.bitaxeBusy.collectAsState()

  var baseUrlInput by rememberSaveable(storedBaseUrl, resolvedBaseUrl) {
    mutableStateOf(storedBaseUrl.ifBlank { resolvedBaseUrl })
  }
  var apiKeyInput by rememberSaveable(storedApiKey) { mutableStateOf(storedApiKey) }

  LaunchedEffect(resolvedBaseUrl) {
    if (resolvedBaseUrl.isNotBlank() && devices.isEmpty() && !busy) {
      viewModel.refreshBitaxeFleet()
    }
  }

  Column(
    modifier = Modifier.verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
      Text("Bitaxe Control", style = mobileCaption1.copy(fontWeight = FontWeight.Bold), color = mobileAccent)
      Text("MawdAxe Fleet", style = mobileTitle1, color = mobileText)
      Text(
        "Drive restart, identify, cooling, pool, and frequency changes through the local MawdAxe control plane.",
        style = mobileCallout,
        color = mobileTextSecondary,
      )
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Text("API host", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
        OutlinedTextField(
          value = baseUrlInput,
          onValueChange = { baseUrlInput = it },
          placeholder = {
            Text(
              resolvedBaseUrl.ifBlank { "http://127.0.0.1:8420" },
              style = mobileBody,
              color = mobileTextTertiary,
            )
          },
          modifier = Modifier.fillMaxWidth(),
          singleLine = true,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
          textStyle = mobileBody.copy(color = mobileText),
          shape = RoundedCornerShape(14.dp),
          colors = bitaxeOutlinedColors(),
        )
        Text(
          "Resolved host: ${resolvedBaseUrl.ifBlank { "not available yet" }}",
          style = mobileCaption1,
          color = mobileTextSecondary,
        )
        Text("API key", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
        OutlinedTextField(
          value = apiKeyInput,
          onValueChange = { apiKeyInput = it },
          placeholder = { Text("Optional X-API-Key", style = mobileBody, color = mobileTextTertiary) },
          modifier = Modifier.fillMaxWidth(),
          singleLine = true,
          keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
          textStyle = mobileBody.copy(color = mobileText),
          shape = RoundedCornerShape(14.dp),
          colors = bitaxeOutlinedColors(),
        )
        Button(
          onClick = {
            viewModel.setBitaxeApiBaseUrl(baseUrlInput)
            viewModel.setBitaxeApiKey(apiKeyInput)
            viewModel.refreshBitaxeFleet()
          },
          enabled = !busy,
          modifier = Modifier.fillMaxWidth().height(48.dp),
          shape = RoundedCornerShape(14.dp),
        ) {
          Text("Save + Refresh", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        Button(
          onClick = onOpenDashboard,
          enabled = !busy,
          modifier = Modifier.fillMaxWidth().height(48.dp),
          shape = RoundedCornerShape(14.dp),
          colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
        ) {
          Text("Open Dashboard", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
        }
        TextButton(
          onClick = {
            baseUrlInput = resolvedBaseUrl
            apiKeyInput = ""
            viewModel.setBitaxeApiBaseUrl("")
            viewModel.setBitaxeApiKey("")
          },
          enabled = !busy,
        ) {
          Text("Use gateway host default", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
        }
      }
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(14.dp),
      color = mobileSurface,
      border = BorderStroke(1.dp, mobileBorder),
    ) {
      Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        Text("Bitaxe state", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
        Text(statusText, style = mobileBody, color = mobileText)
      }
    }

    if (devices.isEmpty()) {
      Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        color = mobileSurface,
        border = BorderStroke(1.dp, mobileBorder),
      ) {
        Text(
          "No Bitaxe devices loaded yet. Save the API host above, then refresh.",
          modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
          style = mobileCallout,
          color = mobileTextSecondary,
        )
      }
    } else {
      devices.forEach { device ->
        BitaxeDeviceCard(device = device, busy = busy, viewModel = viewModel)
      }
    }
  }
}

@Composable
private fun BitaxeDeviceCard(device: BitaxeDeviceSnapshot, busy: Boolean, viewModel: MainViewModel) {
  var fanInput by remember(device.id, device.fanSpeed) { mutableStateOf(device.fanSpeed.toString()) }
  var frequencyInput by remember(device.id, device.frequencyMHz) { mutableStateOf(device.frequencyMHz.toString()) }
  var coreVoltageInput by remember(device.id) { mutableStateOf("") }
  var poolUrlInput by remember(device.id, device.poolUrl) { mutableStateOf(device.poolUrl) }
  var poolPortInput by remember(device.id, device.poolPort) { mutableStateOf(device.poolPort.toString()) }
  var poolUserInput by remember(device.id, device.poolUser) { mutableStateOf(device.poolUser) }
  var poolPassInput by remember(device.id) { mutableStateOf("") }

  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = RoundedCornerShape(14.dp),
    color = mobileSurface,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(device.id, style = mobileHeadline.copy(fontWeight = FontWeight.Bold), color = mobileText)
          Text("${device.ip} · ${device.health.ifBlank { device.state }}", style = mobileCaption1, color = mobileTextSecondary)
        }
        Text("${device.hashRate.toInt()} GH/s", style = mobileHeadline, color = mobileAccent)
      }
      BitaxeMetric(label = "Temp", value = "${device.temp.toInt()}°C")
      BitaxeMetric(label = "Power", value = "${device.power.toInt()} W")
      BitaxeMetric(label = "Fan", value = "${device.fanSpeed}%")
      Button(
        onClick = { viewModel.identifyBitaxeDevice(device.id) },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth().height(44.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileAccentSoft, contentColor = mobileAccent),
      ) {
        Text("Identify", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
      }
      Button(
        onClick = { viewModel.restartBitaxeDevice(device.id) },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth().height(44.dp),
        shape = RoundedCornerShape(12.dp),
        colors = ButtonDefaults.buttonColors(containerColor = mobileDanger, contentColor = mobileSurface),
      ) {
        Text("Restart", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
      }

      HorizontalDivider(color = mobileBorder)

      Text("Cooling", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
      OutlinedTextField(
        value = fanInput,
        onValueChange = { fanInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("Fan %") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      Button(
        onClick = {
          val fanSpeed = fanInput.toIntOrNull() ?: return@Button
          viewModel.setBitaxeFanSpeed(device.id, fanSpeed)
        },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(14.dp),
      ) {
        Text("Apply Fan", style = mobileCaption1.copy(fontWeight = FontWeight.Bold))
      }

      Text("Frequency / overclock", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
      OutlinedTextField(
        value = frequencyInput,
        onValueChange = { frequencyInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("MHz") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      OutlinedTextField(
        value = coreVoltageInput,
        onValueChange = { coreVoltageInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("Core mV") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      Button(
        onClick = {
          val frequencyMHz = frequencyInput.toIntOrNull() ?: return@Button
          val coreVoltage = coreVoltageInput.trim().toIntOrNull()
          viewModel.setBitaxeOverclock(device.id, frequencyMHz, coreVoltage)
        },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(14.dp),
      ) {
        Text("Apply Frequency / Overclock", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
      }

      HorizontalDivider(color = mobileBorder)

      Text("Pool", style = mobileCaption1.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
      OutlinedTextField(
        value = poolUrlInput,
        onValueChange = { poolUrlInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("Pool host") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
        textStyle = mobileBody.copy(color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      OutlinedTextField(
        value = poolPortInput,
        onValueChange = { poolPortInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("Port") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        textStyle = mobileBody.copy(fontFamily = FontFamily.Monospace, color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      OutlinedTextField(
        value = poolUserInput,
        onValueChange = { poolUserInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("User") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        textStyle = mobileBody.copy(color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      OutlinedTextField(
        value = poolPassInput,
        onValueChange = { poolPassInput = it },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        label = { Text("Password") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        textStyle = mobileBody.copy(color = mobileText),
        shape = RoundedCornerShape(14.dp),
        colors = bitaxeOutlinedColors(),
      )
      Button(
        onClick = {
          val poolPort = poolPortInput.toIntOrNull() ?: return@Button
          viewModel.setBitaxePool(
            deviceId = device.id,
            poolUrl = poolUrlInput,
            poolPort = poolPort,
            poolUser = poolUserInput,
            poolPass = poolPassInput,
          )
        },
        enabled = !busy,
        modifier = Modifier.fillMaxWidth().height(48.dp),
        shape = RoundedCornerShape(14.dp),
      ) {
        Text("Apply Pool", style = mobileHeadline.copy(fontWeight = FontWeight.Bold))
      }
    }
  }
}

@Composable
private fun BitaxeMetric(modifier: Modifier = Modifier, label: String, value: String) {
  Surface(
    modifier = modifier,
    shape = RoundedCornerShape(12.dp),
    color = mobileSurfaceStrong,
    border = BorderStroke(1.dp, mobileBorder),
  ) {
    Column(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
      Text(label, style = mobileCaption2.copy(fontWeight = FontWeight.SemiBold), color = mobileTextSecondary)
      Text(value, style = mobileHeadline, color = mobileText)
    }
  }
}

@Composable
private fun bitaxeOutlinedColors() =
  OutlinedTextFieldDefaults.colors(
    focusedContainerColor = mobileSurface,
    unfocusedContainerColor = mobileSurface,
    focusedBorderColor = mobileAccent,
    unfocusedBorderColor = mobileBorder,
    focusedTextColor = mobileText,
    unfocusedTextColor = mobileText,
    cursorColor = mobileAccent,
  )
