// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.delay
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

/** Milliseconds from [now] until the next top of the hour (always > 0). */
internal fun millisUntilNextHour(now: LocalDateTime): Long {
    val nextHour = now.truncatedTo(ChronoUnit.HOURS).plusHours(1)
    return ChronoUnit.MILLIS.between(now, nextHour)
}

/**
 * The current hour of day for the Home greeting. Refreshed whenever the app comes to the
 * foreground and at every hour change while it is visible (a plain coroutine delay: no alarms,
 * no wakelocks; the loop is cancelled when the app stops). [override] pins the hour (tests).
 */
@Composable
fun rememberCurrentHour(override: Int? = null): Int {
    var hour by remember { mutableIntStateOf(override ?: LocalDateTime.now().hour) }
    if (override != null) return override
    val owner = LocalLifecycleOwner.current
    LaunchedEffect(owner) {
        owner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                val now = LocalDateTime.now()
                hour = now.hour
                delay(millisUntilNextHour(now))
            }
        }
    }
    return hour
}
