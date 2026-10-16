// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import dev.zwallet.core.designsystem.generated.ZwTokens

/** True on medium and larger windows (DESIGN §3.1: >= 600dp wide). */
@Composable
@ReadOnlyComposable
fun isMediumOrWider(): Boolean = LocalConfiguration.current.screenWidthDp >= ZwTokens.Breakpoints.medium.value

/** Screen gutter: 16dp on compact windows, 24dp on medium+ (DESIGN §2.3). */
@Composable
@ReadOnlyComposable
fun screenGutter(): Dp = if (isMediumOrWider()) ZwTokens.Size.gutterMedium else ZwTokens.Size.gutterCompact

/**
 * Bottom padding for scrollable content on screens with a FAB: FAB height plus its 16dp margin
 * plus s4, so the last item can always scroll clear of the button (DESIGN §3.1).
 */
@Composable
@ReadOnlyComposable
fun fabClearance(): Dp = ZwTokens.Size.fab + ZwTokens.Space.s4 + ZwTokens.Space.s4
