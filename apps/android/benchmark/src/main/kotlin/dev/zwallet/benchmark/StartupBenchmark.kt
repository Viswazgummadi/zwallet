// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.benchmark

import androidx.benchmark.macro.StartupMode
import androidx.benchmark.macro.StartupTimingMetric
import androidx.benchmark.macro.junit4.MacrobenchmarkRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Cold start of the `benchmark` build type (ARCHITECTURE §8.1 / §9: cold start <= 500 ms).
 * Run on a device: `./gradlew :benchmark:connectedBenchmarkAndroidTest`.
 */
@RunWith(AndroidJUnit4::class)
class StartupBenchmark {
    @get:Rule
    val benchmarkRule = MacrobenchmarkRule()

    @Test
    fun coldStartup() =
        benchmarkRule.measureRepeated(
            packageName = BuildConfig.TARGET_PACKAGE,
            metrics = listOf(StartupTimingMetric()),
            iterations = STARTUP_ITERATIONS,
            startupMode = StartupMode.COLD,
        ) {
            pressHome()
            startActivityAndWait()
        }

    private companion object {
        const val STARTUP_ITERATIONS = 5
    }
}
