// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.home

import dev.zwallet.core.testing.ZwScreenshotTest
import dev.zwallet.core.testing.captureScreenMatrix
import org.junit.Assert.assertEquals
import org.junit.Test

class HomeScreenshotTest : ZwScreenshotTest() {
    @Test
    fun firstRun() = captureScreenMatrix("home_first_run") { HomeScreen(HomeUiState.FirstRun(Greeting.EVENING)) }

    @Test
    fun loading() =
        captureScreenMatrix("home_loading") {
            HomeScreen(HomeUiState.Loading(Greeting.MORNING), animateSkeleton = false)
        }

    @Test
    fun greetingFollowsTheHour() {
        assertEquals(Greeting.MORNING, Greeting.forHour(5))
        assertEquals(Greeting.MORNING, Greeting.forHour(11))
        assertEquals(Greeting.AFTERNOON, Greeting.forHour(12))
        assertEquals(Greeting.EVENING, Greeting.forHour(17))
        assertEquals(Greeting.EVENING, Greeting.forHour(2))
    }
}
