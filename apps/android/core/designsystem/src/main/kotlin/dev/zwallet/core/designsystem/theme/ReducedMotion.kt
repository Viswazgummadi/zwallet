// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.theme

import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * True when the user turned animations off (Developer options / Accessibility "Remove
 * animations" set the animator scale to 0). DESIGN §2.5: springs become 120 ms crossfades,
 * tickers and pulses stop.
 */
@Composable
fun rememberReducedMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    return remember(resolver) {
        Settings.Global.getFloat(resolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
}
