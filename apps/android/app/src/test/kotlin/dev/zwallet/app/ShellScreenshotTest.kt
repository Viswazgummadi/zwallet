// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app

import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import dev.zwallet.app.ui.TopLevel
import dev.zwallet.app.ui.ZwApp
import dev.zwallet.core.testing.PHONE_SMALL
import dev.zwallet.core.testing.ScreenVariant
import dev.zwallet.core.testing.TABLET
import dev.zwallet.core.testing.ZwScreenshotTest
import dev.zwallet.core.testing.captureScreenMatrix
import org.junit.Test
import org.robolectric.annotation.Config

/** The shell with each top-level destination selected (DESIGN §3.1). */
class ShellScreenshotTest : ZwScreenshotTest() {
    @Test
    fun home() = captureScreenMatrix("shell_home") { ZwApp(startDestination = TopLevel.HOME, hourOfDay = 20) }

    @Test
    fun activity() =
        captureScreenMatrix("shell_activity", listOf(ScreenVariant.LIGHT, ScreenVariant.DARK)) {
            ZwApp(startDestination = TopLevel.ACTIVITY, hourOfDay = 20)
        }

    @Test
    fun people() =
        captureScreenMatrix("shell_people", listOf(ScreenVariant.LIGHT, ScreenVariant.DARK)) {
            ZwApp(startDestination = TopLevel.PEOPLE, hourOfDay = 20)
        }

    /** Medium+ windows get a navigation rail instead of the bottom bar. */
    @Test
    @Config(qualifiers = TABLET)
    fun railOnMediumWindows() =
        captureScreenMatrix("shell_home_rail", ScreenVariant.entries) {
            ZwApp(startDestination = TopLevel.HOME, hourOfDay = 9)
        }

    /** Four nav labels must stay on one line and unclipped on the narrowest phone at 200% font. */
    @Test
    @Config(qualifiers = PHONE_SMALL)
    fun narrowPhoneAtLargeFont() =
        captureScreenMatrix(
            "shell_home_w360",
            listOf(ScreenVariant.LIGHT_FONT_2X, ScreenVariant.DARK_FONT_2X),
        ) {
            ZwApp(startDestination = TopLevel.HOME, hourOfDay = 20)
        }

    /** A stub action's "arrives in the next update" Snackbar, above the nav bar and the FAB. */
    @Test
    fun stubSnackbar() =
        captureScreenMatrix("shell_home_snackbar", listOf(ScreenVariant.LIGHT, ScreenVariant.DARK)) {
            val state = remember { SnackbarHostState() }
            LaunchedEffect(state) {
                state.showSnackbar("Quick add arrives in the next update.", duration = SnackbarDuration.Indefinite)
            }
            ZwApp(startDestination = TopLevel.HOME, hourOfDay = 20, snackbarHostState = state)
        }
}
