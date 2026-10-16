// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app

import android.os.StrictMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Regression test for the debug-build crash on every configuration change: `detectAll()` enables
 * explicit-GC detection (API 34+) and the platform calls System.gc() when an activity is
 * relaunched, which `penaltyDeath()` turned into a process kill.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [36])
class StrictModePolicyTest {
    private fun maskOf(policy: Any): Int =
        policy.javaClass
            .getDeclaredField("mask")
            .apply { isAccessible = true }
            .getInt(policy)

    private fun strictModeFlag(name: String): Int =
        StrictMode::class.java
            .getDeclaredField(name)
            .apply { isAccessible = true }
            .getInt(null)

    @Test
    fun debugPolicyDoesNotDetectExplicitGc() {
        installStrictMode()
        val mask = maskOf(StrictMode.getThreadPolicy())
        assertEquals("explicit GC must not be detected", 0, mask and strictModeFlag("DETECT_THREAD_EXPLICIT_GC"))
        assertTrue("disk reads are still detected", mask and strictModeFlag("DETECT_THREAD_DISK_READ") != 0)
        assertTrue("disk writes are still detected", mask and strictModeFlag("DETECT_THREAD_DISK_WRITE") != 0)
        assertTrue("network is still detected", mask and strictModeFlag("DETECT_THREAD_NETWORK") != 0)
        assertTrue("death on violation", mask and strictModeFlag("PENALTY_DEATH") != 0)
    }
}
