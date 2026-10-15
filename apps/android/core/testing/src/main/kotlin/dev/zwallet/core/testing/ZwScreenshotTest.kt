// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.testing

import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Base class for Roborazzi screenshot tests: Robolectric native graphics on a Pixel 7-sized
 * phone (411×914 dp, xxhdpi). Robolectric 4.17 renders up to SDK 36, so tests pin it.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [36], qualifiers = PHONE)
abstract class ZwScreenshotTest

/** Robolectric qualifiers for a compact phone (DESIGN §3.1 compact). */
const val PHONE = "w411dp-h914dp-normal-long-notround-any-420dpi-keyshidden-nonav"

/** Robolectric qualifiers for a medium window (foldable/tablet, navigation rail). */
const val TABLET = "w840dp-h1280dp-xlarge-long-notround-any-320dpi-keyshidden-nonav"
