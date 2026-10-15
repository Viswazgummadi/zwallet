// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.testing

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import dev.zwallet.core.designsystem.theme.ThemeMode
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTheme

/** Variants every screen state is captured in (MASTER_PROMPT DoD, DESIGN §9). */
enum class ScreenVariant(
    val theme: ThemeMode,
    val fontScale: Float,
    val suffix: String,
) {
    LIGHT(ThemeMode.LIGHT, 1f, "light"),
    DARK(ThemeMode.DARK, 1f, "dark"),
    LIGHT_FONT_2X(ThemeMode.LIGHT, 2f, "light_font2"),
    DARK_FONT_2X(ThemeMode.DARK, 2f, "dark_font2"),
}

/**
 * Captures [content] inside ZwTheme in every [ScreenVariant] to
 * `src/test/screenshots/<name>_<variant>.png`. Run `recordRoborazziDebug` to update goldens,
 * `verifyRoborazziDebug` to diff them. Call from a test annotated like [ZwScreenshotTest].
 */
fun captureScreenMatrix(
    name: String,
    variants: List<ScreenVariant> = ScreenVariant.entries,
    content: @Composable () -> Unit,
) {
    for (v in variants) {
        captureRoboImage("src/test/screenshots/${name}_${v.suffix}.png") {
            val density = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(density.density, v.fontScale)) {
                ZwTheme(mode = v.theme) {
                    Box(Modifier.fillMaxSize().background(Zw.colors.page)) { content() }
                }
            }
        }
    }
}
