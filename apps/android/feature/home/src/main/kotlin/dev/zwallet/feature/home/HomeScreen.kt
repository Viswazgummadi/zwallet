// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import dev.zwallet.core.designsystem.component.EmptyState
import dev.zwallet.core.designsystem.component.EmptyStateAction
import dev.zwallet.core.designsystem.component.SkeletonBlock
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTypography
import dev.zwallet.core.designsystem.theme.fabClearance
import dev.zwallet.core.designsystem.theme.rememberReducedMotion
import dev.zwallet.core.designsystem.theme.screenGutter
import dev.zwallet.core.designsystem.R as DsR

/** Time-of-day greeting on Home (DESIGN §5.2). */
enum class Greeting {
    MORNING,
    AFTERNOON,
    EVENING,
    ;

    companion object {
        fun forHour(hour: Int): Greeting =
            when (hour) {
                in 5..11 -> MORNING
                in 12..16 -> AFTERNOON
                else -> EVENING
            }
    }
}

/** Home UI state. M0 has no data layer yet: loading (before first local data) and first run. */
@Immutable
sealed interface HomeUiState {
    val greeting: Greeting

    /** Skeleton only before the first local data is read; never a spinner (DESIGN §1.2). */
    data class Loading(
        override val greeting: Greeting,
    ) : HomeUiState

    /** No transactions yet: add one, import SMS, or restore a .zwallet file. */
    data class FirstRun(
        override val greeting: Greeting,
    ) : HomeUiState
}

/** Callbacks from Home. Stubs until M1 (quick add, restore) and M2 (SMS import). */
@Immutable
class HomeActions(
    val onAddExpense: () -> Unit = {},
    val onImportSms: () -> Unit = {},
    val onRestoreFile: () -> Unit = {},
    val onOpenMenu: () -> Unit = {},
)

@Composable
fun HomeScreen(
    state: HomeUiState,
    modifier: Modifier = Modifier,
    actions: HomeActions = remember { HomeActions() },
    // Reduced motion (system setting) stops the pulse; screenshot tests pass false.
    animateSkeleton: Boolean = !rememberReducedMotion(),
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    start = screenGutter(),
                    end = screenGutter(),
                    top = ZwTokens.Space.s4,
                    // The Quick add FAB floats over the content: keep the last item clear of it.
                    bottom = fabClearance(),
                ),
        verticalArrangement = Arrangement.spacedBy(ZwTokens.Space.s4),
    ) {
        Header(state.greeting, actions.onOpenMenu)
        when (state) {
            is HomeUiState.Loading -> {
                HomeSkeleton(animateSkeleton)
            }

            is HomeUiState.FirstRun -> {
                val addExpense = stringResource(R.string.home_add_expense)
                val importSms = stringResource(R.string.home_import_sms)
                val restoreFile = stringResource(R.string.home_restore_file)
                val primary =
                    remember(addExpense, actions.onAddExpense) { EmptyStateAction(addExpense, actions.onAddExpense) }
                val secondary =
                    remember(importSms, restoreFile, actions.onImportSms, actions.onRestoreFile) {
                        listOf(
                            EmptyStateAction(importSms, actions.onImportSms),
                            EmptyStateAction(restoreFile, actions.onRestoreFile),
                        )
                    }
                Card(
                    colors = CardDefaults.cardColors(containerColor = Zw.colors.surfaceRaised),
                    shape = androidx.compose.material3.MaterialTheme.shapes.large,
                ) {
                    EmptyState(
                        icon = DsR.drawable.zw_ic_receipt_long,
                        title = stringResource(R.string.home_first_run_title),
                        body = stringResource(R.string.home_first_run_body),
                        primary = primary,
                        secondary = secondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun Header(
    greeting: Greeting,
    onOpenMenu: () -> Unit,
) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(
            text =
                stringResource(
                    when (greeting) {
                        Greeting.MORNING -> R.string.home_greeting_morning
                        Greeting.AFTERNOON -> R.string.home_greeting_afternoon
                        Greeting.EVENING -> R.string.home_greeting_evening
                    },
                ),
            style = ZwTypography.headline,
            color = Zw.colors.inkPrimary,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        IconButton(onClick = onOpenMenu, modifier = Modifier.size(ZwTokens.Size.touchMin)) {
            Icon(
                painter = painterResource(DsR.drawable.zw_ic_account_circle),
                contentDescription = stringResource(R.string.home_menu),
                tint = Zw.colors.inkSecondary,
            )
        }
    }
}

/** Shapes match the populated Home: hero amount, delta line, pace chart, cards. */
@Composable
private fun HomeSkeleton(animate: Boolean) {
    val loading = stringResource(R.string.home_loading)
    Column(
        modifier =
            Modifier.semantics(mergeDescendants = true) {
                contentDescription = loading
                progressBarRangeInfo = ProgressBarRangeInfo.Indeterminate
            },
        verticalArrangement = Arrangement.spacedBy(ZwTokens.Space.s3),
    ) {
        SkeletonBlock(Modifier.width(ZwTokens.Space.s16 * 2).height(ZwTokens.Space.s4), animate = animate)
        SkeletonBlock(Modifier.width(ZwTokens.Space.s16 * 3).height(ZwTokens.Space.s10), animate = animate)
        SkeletonBlock(Modifier.width(ZwTokens.Space.s16 * 4).height(ZwTokens.Space.s4), animate = animate)
        SkeletonBlock(
            Modifier.fillMaxWidth().height(ZwTokens.Space.s16 * 2),
            radius = ZwTokens.Radius.lg,
            animate = animate,
        )
        SkeletonBlock(
            Modifier.fillMaxWidth().height(ZwTokens.Space.s16 + ZwTokens.Space.s8),
            radius = ZwTokens.Radius.lg,
            animate = animate,
        )
    }
}
