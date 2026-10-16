// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.people

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
import dev.zwallet.core.designsystem.theme.fabClearance
import dev.zwallet.core.designsystem.theme.screenGutter
import dev.zwallet.core.designsystem.R as DsR

/** People tab (DESIGN §5.9). M0 shell: the empty state only; content arrives in later milestones. */
@Composable
fun PeopleScreen(
    modifier: Modifier = Modifier,
    onAddPerson: () -> Unit = {},
) {
    val ctaLabel = stringResource(R.string.people_add_person)
    val cta = remember(ctaLabel, onAddPerson) { EmptyStateAction(ctaLabel, onAddPerson) }
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = screenGutter(),
                    end = screenGutter(),
                    top = ZwTokens.Space.s4,
                    // The FAB floats over the content: keep the last item clear of it.
                    bottom = fabClearance(),
                ),
        verticalArrangement = Arrangement.spacedBy(ZwTokens.Space.s4),
    ) {
        Text(
            text = stringResource(R.string.people_title),
            style = ZwTypography.headline,
            color = Zw.colors.inkPrimary,
            modifier = Modifier.semantics { heading() },
        )
        EmptyState(
            icon = DsR.drawable.zw_ic_group,
            title = stringResource(R.string.people_empty_title),
            body = stringResource(R.string.people_empty_body),
            primary = cta,
        )
    }
}
