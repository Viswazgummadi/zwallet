// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.component

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTypography
import dev.zwallet.core.designsystem.theme.isMediumOrWider

/** An action button under an [EmptyState]. */
@Immutable
data class EmptyStateAction(
    val label: String,
    val onClick: () -> Unit,
)

/** Readable column width on medium+ windows, composed from space tokens (384dp). */
private val EMPTY_STATE_MAX_WIDTH = ZwTokens.Space.s16 * 6

/** 1dp outline stroke, composed from the 4dp space token. */
private val OUTLINE_WIDTH = ZwTokens.Space.s1 / 4

/**
 * DESIGN §4 EmptyState: illustration, one sentence, primary CTA (+ optional secondary actions).
 * The illustration is the screen's glyph on a brand container until the line-art set lands (M6).
 */
@Composable
fun EmptyState(
    @DrawableRes icon: Int,
    title: String,
    body: String,
    modifier: Modifier = Modifier,
    primary: EmptyStateAction? = null,
    secondary: List<EmptyStateAction> = emptyList(),
) {
    val widthModifier = if (isMediumOrWider()) Modifier.widthIn(max = EMPTY_STATE_MAX_WIDTH) else Modifier
    // Outline (>= 3:1 on the card), not hairline: hairline is for dividers (DESIGN §2.1, WCAG 1.4.11).
    val outline = Zw.colors.outline
    val outlineStroke = remember(outline) { BorderStroke(OUTLINE_WIDTH, outline) }
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(
            modifier = widthModifier.fillMaxWidth().padding(ZwTokens.Space.s6),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(ZwTokens.Space.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(ZwTokens.Size.avatarLg)
                        .background(Zw.colors.primaryContainer, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = painterResource(icon),
                    contentDescription = null,
                    tint = Zw.colors.onPrimaryContainer,
                    modifier = Modifier.size(ZwTokens.Size.icon),
                )
            }
            Text(
                text = title,
                style = ZwTypography.title,
                color = Zw.colors.inkPrimary,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() },
            )
            Text(
                text = body,
                style = ZwTypography.body,
                color = Zw.colors.inkSecondary,
                textAlign = TextAlign.Center,
            )
            if (primary != null) {
                Button(
                    onClick = primary.onClick,
                    modifier = Modifier.fillMaxWidth().heightIn(min = ZwTokens.Size.touchMin),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Text(primary.label, style = ZwTypography.label, textAlign = TextAlign.Center)
                }
            }
            secondary.forEach { action ->
                OutlinedButton(
                    onClick = action.onClick,
                    modifier = Modifier.fillMaxWidth().heightIn(min = ZwTokens.Size.touchMin),
                    shape = MaterialTheme.shapes.medium,
                    border = outlineStroke,
                ) {
                    Text(action.label, style = ZwTypography.label, textAlign = TextAlign.Center)
                }
            }
        }
    }
}
