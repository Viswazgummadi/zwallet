// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import dev.zwallet.app.ui.ZwApp
import dev.zwallet.core.designsystem.theme.ZwTheme

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            ZwTheme {
                ZwApp()
            }
        }
    }
}
