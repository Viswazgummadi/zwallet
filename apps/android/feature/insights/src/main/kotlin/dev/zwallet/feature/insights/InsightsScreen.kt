// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.insights

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.zwallet.core.designsystem.component.EmptyState
import dev.zwallet.core.designsystem.component.EmptyStateAction
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTypography
import dev.zwallet.core.designsystem.theme.screenGutter
import dev.zwallet.core.designsystem.R as DsR

/** Insights tab (DESIGN §5.7). M0 shell: the empty state only; content arrives in later milestones. */
@Composable
fun InsightsScreen(
    modifier: Modifier = Modifier,
    onAddExpense: () -> Unit = {},
) {
    val ctaLabel = stringResource(R.string.insights_add_expense)
    val cta = remember(ctaLabel, onAddExpense) { EmptyStateAction(ctaLabel, onAddExpense) }
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = screenGutter(), vertical = ZwTokens.Space.s4),
        verticalArrangement = Arrangement.spacedBy(ZwTokens.Space.s4),
    ) {
        Text(
            text = stringResource(R.string.insights_title),
            style = ZwTypography.headline,
            color = Zw.colors.inkPrimary,
            modifier = Modifier.semantics { heading() },
        )
        EmptyState(
            icon = DsR.drawable.zw_ic_analytics,
            title = stringResource(R.string.insights_empty_title),
            body = stringResource(R.string.insights_empty_body),
            primary = cta,
        )
    }
}
