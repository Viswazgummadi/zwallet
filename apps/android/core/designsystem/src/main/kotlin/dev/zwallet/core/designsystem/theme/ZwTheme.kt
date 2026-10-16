// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import dev.zwallet.core.designsystem.generated.ZwPalette
import dev.zwallet.core.designsystem.generated.ZwTokens

/** Appearance setting (SPEC §13): follow the system, or force light/dark. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

private val LocalZwPalette = staticCompositionLocalOf { ZwTokens.light }

/**
 * zwallet's theme (DESIGN §2). Every color, type style and shape comes from generated tokens.
 * Dynamic color is deliberately not used: it is an opt-in setting (off by default) that arrives
 * with Settings, so charts and brand stay consistent.
 */
@Composable
fun ZwTheme(
    mode: ThemeMode = ThemeMode.SYSTEM,
    amoled: Boolean = false,
    content: @Composable () -> Unit,
) {
    val dark =
        when (mode) {
            ThemeMode.SYSTEM -> isSystemInDarkTheme()
            ThemeMode.LIGHT -> false
            ThemeMode.DARK -> true
        }
    val palette =
        when {
            !dark -> ZwTokens.light
            amoled -> ZwTokens.amoled
            else -> ZwTokens.dark
        }
    val colorScheme = remember(palette, dark) { palette.toColorScheme(dark) }
    CompositionLocalProvider(LocalZwPalette provides palette) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = ZwTypography.material,
            shapes = ZwShapes.material,
            content = content,
        )
    }
}

/** Access to the full zwallet palette (neutrals, money semantics, data colors). */
object Zw {
    val colors: ZwPalette
        @Composable
        @ReadOnlyComposable
        get() = LocalZwPalette.current
}

private fun ZwPalette.toColorScheme(dark: Boolean): ColorScheme {
    val base = if (dark) darkColorScheme() else lightColorScheme()
    return base.copy(
        primary = primary,
        onPrimary = onPrimary,
        primaryContainer = primaryContainer,
        onPrimaryContainer = onPrimaryContainer,
        inversePrimary = inversePrimary,
        secondary = secondary,
        onSecondary = onSecondary,
        secondaryContainer = secondaryContainer,
        onSecondaryContainer = onSecondaryContainer,
        tertiary = tertiary,
        onTertiary = onTertiary,
        tertiaryContainer = tertiaryContainer,
        onTertiaryContainer = onTertiaryContainer,
        background = page,
        onBackground = inkPrimary,
        surface = surface,
        onSurface = inkPrimary,
        surfaceVariant = surfaceSunken,
        onSurfaceVariant = inkSecondary,
        surfaceTint = primary,
        inverseSurface = inverseSurface,
        inverseOnSurface = inverseOnSurface,
        error = error,
        onError = onError,
        errorContainer = errorContainer,
        onErrorContainer = onErrorContainer,
        outline = outline,
        outlineVariant = hairline,
        scrim = scrim,
        // Elevation is tonal (DESIGN §2.3): containers step between page, surface and raised.
        surfaceBright = surfaceRaised,
        surfaceDim = surfaceSunken,
        surfaceContainerLowest = surfaceRaised,
        surfaceContainerLow = surface,
        surfaceContainer = surface,
        surfaceContainerHigh = surfaceRaised,
        surfaceContainerHighest = surfaceSunken,
    )
}
