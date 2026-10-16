// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.theme

import android.content.ContentResolver
import android.database.ContentObserver
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext

private fun ContentResolver.animationsOff(): Boolean =
    Settings.Global.getFloat(this, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

/**
 * True when the user turned animations off (Developer options / Accessibility "Remove
 * animations" set the animator scale to 0). DESIGN §2.5: springs become 120 ms crossfades,
 * tickers and pulses stop. Observes the setting, so toggling it while the app is open applies
 * immediately.
 */
@Composable
fun rememberReducedMotion(): Boolean {
    val resolver = LocalContext.current.contentResolver
    var reduced by remember(resolver) { mutableStateOf(resolver.animationsOff()) }
    DisposableEffect(resolver) {
        val observer =
            object : ContentObserver(Handler(Looper.getMainLooper())) {
                override fun onChange(selfChange: Boolean) {
                    reduced = resolver.animationsOff()
                }
            }
        resolver.registerContentObserver(
            Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE),
            false,
            observer,
        )
        // The value may have changed between composition and registration.
        reduced = resolver.animationsOff()
        onDispose { resolver.unregisterContentObserver(observer) }
    }
    return reduced
}
