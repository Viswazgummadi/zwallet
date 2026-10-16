// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app

import android.app.Application
import android.os.StrictMode
import dagger.hilt.android.HiltAndroidApp

/** Nothing heavy here (ARCHITECTURE §8.1: cold start ≤ 500 ms). */
@HiltAndroidApp
class ZwApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) installStrictMode()
    }
}

/**
 * Debug builds crash on main-thread disk/network access (DoD: StrictMode clean). The detectors are
 * listed explicitly: `detectAll()` on API 34+ also enables explicit-GC detection, and the platform
 * itself calls `System.gc()` when an activity is relaunched (theme toggle, rotation), which would
 * kill the process under `penaltyDeath()`.
 */
internal fun installStrictMode() {
    StrictMode.setThreadPolicy(
        StrictMode.ThreadPolicy
            .Builder()
            .detectDiskReads()
            .detectDiskWrites()
            .detectNetwork()
            .detectCustomSlowCalls()
            .detectResourceMismatches()
            .detectUnbufferedIo()
            .penaltyLog()
            .penaltyDeath()
            .build(),
    )
    StrictMode.setVmPolicy(
        StrictMode.VmPolicy
            .Builder()
            .detectLeakedClosableObjects()
            .detectLeakedSqlLiteObjects()
            .detectActivityLeaks()
            .penaltyLog()
            .build(),
    )
}
