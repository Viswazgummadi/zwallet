// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app

import dev.zwallet.app.ui.millisUntilNextHour
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime

class CurrentHourTest {
    @Test
    fun waitsUntilTheNextTopOfTheHour() {
        assertEquals(30L * 60_000, millisUntilNextHour(LocalDateTime.of(2026, 10, 16, 9, 30, 0)))
        assertEquals(1_000L, millisUntilNextHour(LocalDateTime.of(2026, 10, 16, 23, 59, 59)))
    }

    @Test
    fun exactlyOnTheHourWaitsAFullHour() {
        assertEquals(3_600_000L, millisUntilNextHour(LocalDateTime.of(2026, 10, 16, 12, 0, 0)))
    }
}
