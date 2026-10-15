// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.component

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTypography

/** A secondary action under an [EmptyState]. */
class EmptyStateAction(
    val label: String,
    val onClick: () -> Unit,
)

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
    Column(
        modifier = modifier.fillMaxWidth().padding(ZwTokens.Space.s6),
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
            ) {
                Text(action.label, style = ZwTypography.label, textAlign = TextAlign.Center)
            }
        }
    }
}
