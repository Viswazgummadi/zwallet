// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.component

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.Dp
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.rememberReducedMotion

/** Pulse alpha range for skeleton blocks (shimmer-free, DESIGN §4). */
private const val PULSE_MIN = 0.55f
private const val PULSE_MAX = 1f

/**
 * A placeholder block shaped like the content it stands in for. Pulses gently; static when
 * [animate] is false (screenshot tests, reduced motion).
 */
@Composable
fun SkeletonBlock(
    modifier: Modifier = Modifier,
    radius: Dp = ZwTokens.Radius.sm,
    animate: Boolean = !rememberReducedMotion(),
) {
    val alpha =
        if (animate) {
            val transition = rememberInfiniteTransition(label = "skeleton")
            val a by transition.animateFloat(
                initialValue = PULSE_MAX,
                targetValue = PULSE_MIN,
                animationSpec =
                    infiniteRepeatable(
                        animation = tween(ZwTokens.Motion.longMs * 2, easing = ZwTokens.Motion.standard),
                        repeatMode = RepeatMode.Reverse,
                    ),
                label = "skeletonAlpha",
            )
            a
        } else {
            PULSE_MAX
        }
    Box(modifier.alpha(alpha).background(Zw.colors.skeleton, RoundedCornerShape(radius)))
}
