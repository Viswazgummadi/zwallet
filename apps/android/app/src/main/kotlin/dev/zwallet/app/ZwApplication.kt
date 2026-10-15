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
        if (BuildConfig.DEBUG) {
            // Debug builds crash on main-thread disk/network access and leaked resources (DoD: StrictMode clean).
            StrictMode.setThreadPolicy(
                StrictMode.ThreadPolicy
                    .Builder()
                    .detectAll()
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
    }
}
