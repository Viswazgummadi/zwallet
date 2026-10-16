// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app.ui

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalResources
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Density
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import dev.zwallet.app.R
import dev.zwallet.core.designsystem.generated.ZwTokens
import dev.zwallet.core.designsystem.theme.Zw
import dev.zwallet.core.designsystem.theme.ZwTypography
import dev.zwallet.feature.home.Greeting
import dev.zwallet.feature.home.HomeActions
import dev.zwallet.feature.home.HomeScreen
import dev.zwallet.feature.home.HomeUiState
import dev.zwallet.feature.insights.InsightsScreen
import dev.zwallet.feature.people.PeopleScreen
import dev.zwallet.feature.transactions.TransactionsScreen
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlin.reflect.KClass
import dev.zwallet.core.designsystem.R as DsR

@Serializable
data object HomeRoute

@Serializable
data object ActivityRoute

@Serializable
data object InsightsRoute

@Serializable
data object PeopleRoute

/** The floating action button a top-level destination shows (DESIGN §3.1, §5.9). */
@Immutable
data class FabSpec(
    @StringRes val label: Int,
    @DrawableRes val icon: Int,
    @StringRes val feature: Int,
)

private val QUICK_ADD_FAB = FabSpec(R.string.quick_add, DsR.drawable.zw_ic_add, R.string.stub_feature_quick_add)

/** The four top-level destinations (DESIGN §3.1). */
enum class TopLevel(
    val route: Any,
    val routeClass: KClass<*>,
    @StringRes val label: Int,
    @DrawableRes val icon: Int,
    @DrawableRes val selectedIcon: Int,
    val fab: FabSpec?,
) {
    HOME(
        HomeRoute,
        HomeRoute::class,
        R.string.nav_home,
        DsR.drawable.zw_ic_home,
        DsR.drawable.zw_ic_home_fill,
        QUICK_ADD_FAB,
    ),
    ACTIVITY(
        ActivityRoute,
        ActivityRoute::class,
        R.string.nav_activity,
        DsR.drawable.zw_ic_receipt_long,
        DsR.drawable.zw_ic_receipt_long_fill,
        QUICK_ADD_FAB,
    ),
    INSIGHTS(
        InsightsRoute,
        InsightsRoute::class,
        R.string.nav_insights,
        DsR.drawable.zw_ic_analytics,
        DsR.drawable.zw_ic_analytics_fill,
        null,
    ),
    PEOPLE(
        PeopleRoute,
        PeopleRoute::class,
        R.string.nav_people,
        DsR.drawable.zw_ic_group,
        DsR.drawable.zw_ic_group_fill,
        FabSpec(R.string.add_person, DsR.drawable.zw_ic_person_add, R.string.stub_feature_add_person),
    ),
}

/**
 * Nav labels may scale up to 1.3x: Material 3 allows capping label font scale, and at 200% four
 * labels no longer fit a 360dp bottom bar (DESIGN §9, 200% must not clip).
 */
private const val NAV_LABEL_MAX_FONT_SCALE = 1.3f

/**
 * App shell: bottom navigation on compact windows, a navigation rail on medium+
 * (NavigationSuiteScaffold picks by window size class), a FAB on Home, Activity and People.
 *
 * Features that have not shipped yet are stubs: they show a Snackbar through the shared
 * [snackbarHostState] ("<Feature> arrives in the next update.") so TalkBack announces it.
 * [hourOfDay] pins the greeting hour (tests); otherwise it follows the clock.
 */
@Composable
fun ZwApp(
    navController: NavHostController = rememberNavController(),
    startDestination: TopLevel = TopLevel.HOME,
    hourOfDay: Int? = null,
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
) {
    val backStack by navController.currentBackStackEntryAsState()
    val current =
        TopLevel.entries.firstOrNull { tl ->
            backStack?.destination?.hierarchy?.any { it.hasRoute(tl.routeClass) } ==
                true
        }
            ?: startDestination

    val scope = rememberCoroutineScope()
    val resources = LocalResources.current
    val showStub: (Int) -> Unit =
        remember(snackbarHostState, scope, resources) {
            { feature ->
                scope.launch {
                    // Stacks replace: a new message supersedes the one on screen.
                    snackbarHostState.currentSnackbarData?.dismiss()
                    snackbarHostState.showSnackbar(
                        resources.getString(R.string.stub_arrives, resources.getString(feature)),
                    )
                }
            }
        }
    val homeActions =
        remember(showStub) {
            HomeActions(
                onAddExpense = { showStub(R.string.stub_feature_quick_add) },
                onImportSms = { showStub(R.string.stub_feature_sms_import) },
                onRestoreFile = { showStub(R.string.stub_feature_restore) },
                onOpenMenu = { showStub(R.string.stub_feature_menu) },
            )
        }
    val onQuickAdd = remember(showStub) { { showStub(R.string.stub_feature_quick_add) } }
    val onImportSms = remember(showStub) { { showStub(R.string.stub_feature_sms_import) } }
    val onAddPerson = remember(showStub) { { showStub(R.string.stub_feature_add_person) } }
    val greeting = Greeting.forHour(rememberCurrentHour(hourOfDay))

    NavigationSuiteScaffold(
        navigationSuiteItems = {
            TopLevel.entries.forEach { tl ->
                val selected = tl == current
                item(
                    selected = selected,
                    onClick = {
                        navController.navigate(tl.route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    icon = {
                        Icon(
                            painter = painterResource(if (selected) tl.selectedIcon else tl.icon),
                            contentDescription = null,
                            modifier = Modifier.size(ZwTokens.Size.icon),
                        )
                    },
                    label = { NavLabel(stringResource(tl.label)) },
                )
            }
        },
        containerColor = Zw.colors.page,
    ) {
        Scaffold(
            containerColor = Zw.colors.page,
            snackbarHost = { SnackbarHost(snackbarHostState) },
            floatingActionButton = {
                current.fab?.let { fab ->
                    FloatingActionButton(
                        onClick = { showStub(fab.feature) },
                        modifier = Modifier.size(ZwTokens.Size.fab),
                        containerColor = Zw.colors.primary,
                        contentColor = Zw.colors.onPrimary,
                    ) {
                        Icon(
                            painterResource(fab.icon),
                            contentDescription = stringResource(fab.label),
                        )
                    }
                }
            },
        ) { padding ->
            NavHost(
                navController = navController,
                startDestination = startDestination.route,
                modifier = Modifier.padding(padding),
            ) {
                composable<HomeRoute> { HomeScreen(HomeUiState.FirstRun(greeting), actions = homeActions) }
                composable<ActivityRoute> { TransactionsScreen(onImportSms = onImportSms) }
                composable<InsightsRoute> { InsightsScreen(onAddExpense = onQuickAdd) }
                composable<PeopleRoute> { PeopleScreen(onAddPerson = onAddPerson) }
            }
        }
    }
}

/** A single-line nav label whose font scale is capped (see [NAV_LABEL_MAX_FONT_SCALE]). */
@Composable
private fun NavLabel(text: String) {
    val density = LocalDensity.current
    val capped = remember(density) { Density(density.density, minOf(density.fontScale, NAV_LABEL_MAX_FONT_SCALE)) }
    CompositionLocalProvider(LocalDensity provides capped) {
        Text(text, style = ZwTypography.labelSm, maxLines = 1, softWrap = false, overflow = TextOverflow.Clip)
    }
}
