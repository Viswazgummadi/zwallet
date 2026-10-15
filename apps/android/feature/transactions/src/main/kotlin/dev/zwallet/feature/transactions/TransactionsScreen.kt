// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.transactions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import dev.zwallet.core.designsystem.component.EmptyState
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTypography
import dev.zwallet.core.designsystem.R as DsR

/** Transactions tab (DESIGN §5.3). M0 shell: the empty state only; content arrives in later milestones. */
@Composable
fun TransactionsScreen(modifier: Modifier = Modifier) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(ZwTokens.Space.s4),
        verticalArrangement = Arrangement.spacedBy(ZwTokens.Space.s4),
    ) {
        Text(
            text = stringResource(R.string.transactions_title),
            style = ZwTypography.headline,
            color = Zw.colors.inkPrimary,
            modifier = Modifier.semantics { heading() },
        )
        EmptyState(
            icon = DsR.drawable.zw_ic_receipt_long,
            title = stringResource(R.string.transactions_empty_title),
            body = stringResource(R.string.transactions_empty_body),
        )
    }
}
