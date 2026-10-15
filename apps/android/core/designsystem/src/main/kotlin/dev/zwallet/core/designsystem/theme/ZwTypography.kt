// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.core.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import dev.zwallet.core.designsystem.R
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.generated.ZwTypeToken

/** Inter (bundled subset, ADR 0015) at the weights the type scale uses. */
val Inter: FontFamily =
    FontFamily(
        listOf(400, 500, 600).map { w ->
            Font(
                resId = R.font.inter_variable,
                weight = FontWeight(w),
                variationSettings = FontVariation.Settings(FontVariation.weight(w)),
            )
        },
    )

/** DESIGN §2.2: tabular figures for amounts in lists; cv11 everywhere. */
private const val FEATURES = "cv11"
private const val FEATURES_TABULAR = "cv11, tnum"

private fun ZwTypeToken.style(): TextStyle =
    TextStyle(
        fontFamily = Inter,
        fontWeight = FontWeight(weight),
        fontSize = size,
        lineHeight = lineHeight,
        letterSpacing = trackingEm.em,
        fontFeatureSettings = if (tabularFigures) FEATURES_TABULAR else FEATURES,
    )

/** The zwallet type scale (tokens.typography.scale). */
object ZwTypography {
    val display = ZwTokens.Type.display.style()
    val headline = ZwTokens.Type.headline.style()
    val title = ZwTokens.Type.title.style()
    val titleSm = ZwTokens.Type.titleSm.style()
    val body = ZwTokens.Type.body.style()
    val bodySm = ZwTokens.Type.bodySm.style()
    val label = ZwTokens.Type.label.style()
    val labelSm = ZwTokens.Type.labelSm.style()

    /** Hero amounts: proportional figures. */
    val amountLg = ZwTokens.Type.amountLg.style()

    /** Amounts in rows and tables: tabular figures so columns align. */
    val amountRow = ZwTokens.Type.amountRow.style()

    val material =
        Typography(
            displayLarge = display,
            displayMedium = display,
            displaySmall = headline,
            headlineLarge = headline,
            headlineMedium = headline,
            headlineSmall = title,
            titleLarge = title,
            titleMedium = titleSm,
            titleSmall = label,
            bodyLarge = body,
            bodyMedium = bodySm,
            bodySmall = labelSm,
            labelLarge = label,
            labelMedium = labelSm,
            labelSmall = labelSm,
        )
}

/** DESIGN §2.3 shapes: cards lg 16, sheets xxl 28, inputs md 12, chips full. */
object ZwShapes {
    val material =
        Shapes(
            extraSmall = RoundedCornerShape(ZwTokens.Radius.xs),
            small = RoundedCornerShape(ZwTokens.Radius.sm),
            medium = RoundedCornerShape(ZwTokens.Radius.md),
            large = RoundedCornerShape(ZwTokens.Radius.lg),
            extraLarge = RoundedCornerShape(ZwTokens.Radius.xxl),
        )
}
