package ai.openclaw.app.gateway

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeErrorParserTest {
  @Test
  fun parseInvokeErrorMessage_parsesUppercaseCodePrefix() {
    val parsed = parseInvokeErrorMessage("CAMERA_PERMISSION_REQUIRED: grant Camera permission")
    assertEquals("CAMERA_PERMISSION_REQUIRED", parsed.code)
    assertEquals("grant Camera permission", parsed.message)
    assertTrue(parsed.hadExplicitCode)
    assertEquals("CAMERA_PERMISSION_REQUIRED: grant Camera permission", parsed.prefixedMessage)
  }

  @Test
  fun parseInvokeErrorMessage_rejectsNonCanonicalCodePrefix() {
    val parsed = parseInvokeErrorMessage("IllegalStateException: boom")
    assertEquals("UNAVAILABLE", parsed.code)
    assertEquals("IllegalStateException: boom", parsed.message)
    assertFalse(parsed.hadExplicitCode)
  }

  @Test
  fun parseInvokeErrorFromThrowable_usesFallbackWhenMessageMissing() {
    val parsed = parseInvokeErrorFromThrowable(IllegalStateException(), fallbackMessage = "fallback")
    assertEquals("UNAVAILABLE", parsed.code)
    assertEquals("fallback", parsed.message)
    assertFalse(parsed.hadExplicitCode)
  }

  @Test
  fun parseInvokeErrorMessage_acceptsCodesWithDigitsAndHumanizesBlankSuffix() {
    val parsed = parseInvokeErrorMessage("HTTP_429:")
    assertEquals("HTTP_429", parsed.code)
    assertEquals("Http 429", parsed.message)
    assertTrue(parsed.hadExplicitCode)
  }

  @Test
  fun parseInvokeErrorMessage_acceptsBracketedCodesAndNormalizesWhitespace() {
    val parsed = parseInvokeErrorMessage("[CAMERA_PERMISSION_REQUIRED]  grant   camera\npermission ")
    assertEquals("CAMERA_PERMISSION_REQUIRED", parsed.code)
    assertEquals("grant camera permission", parsed.message)
    assertTrue(parsed.hadExplicitCode)
  }

  @Test
  fun parseInvokeErrorFromThrowable_walksCauseChainForExplicitCode() {
    val parsed =
      parseInvokeErrorFromThrowable(
        RuntimeException("wrapper", IllegalStateException("RATE_LIMITED: retry later")),
        fallbackMessage = "fallback",
      )

    assertEquals("RATE_LIMITED", parsed.code)
    assertEquals("retry later", parsed.message)
    assertTrue(parsed.hadExplicitCode)
  }
}
