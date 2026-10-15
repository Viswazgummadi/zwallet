// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.app.ui

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
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
import dev.zwallet.feature.home.HomeScreen
import dev.zwallet.feature.home.HomeUiState
import dev.zwallet.feature.insights.InsightsScreen
import dev.zwallet.feature.people.PeopleScreen
import dev.zwallet.feature.transactions.TransactionsScreen
import kotlinx.serialization.Serializable
import java.time.LocalTime
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

/** The four top-level destinations (DESIGN §3.1). */
enum class TopLevel(
    val route: Any,
    val routeClass: KClass<*>,
    @StringRes val label: Int,
    @DrawableRes val icon: Int,
    @DrawableRes val selectedIcon: Int,
    val hasFab: Boolean,
) {
    HOME(HomeRoute, HomeRoute::class, R.string.nav_home, DsR.drawable.zw_ic_home, DsR.drawable.zw_ic_home_fill, true),
    ACTIVITY(
        ActivityRoute,
        ActivityRoute::class,
        R.string.nav_activity,
        DsR.drawable.zw_ic_receipt_long,
        DsR.drawable.zw_ic_receipt_long_fill,
        true,
    ),
    INSIGHTS(
        InsightsRoute,
        InsightsRoute::class,
        R.string.nav_insights,
        DsR.drawable.zw_ic_analytics,
        DsR.drawable.zw_ic_analytics_fill,
        false,
    ),
    PEOPLE(
        PeopleRoute,
        PeopleRoute::class,
        R.string.nav_people,
        DsR.drawable.zw_ic_group,
        DsR.drawable.zw_ic_group_fill,
        false,
    ),
}

/**
 * App shell: bottom navigation on compact windows, a navigation rail on medium+
 * (NavigationSuiteScaffold picks by window size class), FAB for Quick add on Home and Activity.
 */
@Composable
fun ZwApp(
    navController: NavHostController = rememberNavController(),
    startDestination: TopLevel = TopLevel.HOME,
    hourOfDay: Int = LocalTime.now().hour,
) {
    val backStack by navController.currentBackStackEntryAsState()
    val current =
        TopLevel.entries.firstOrNull { tl ->
            backStack?.destination?.hierarchy?.any { it.hasRoute(tl.routeClass) } ==
                true
        }
            ?: startDestination

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
                    label = { Text(stringResource(tl.label), style = ZwTypography.labelSm) },
                )
            }
        },
        containerColor = Zw.colors.page,
    ) {
        Scaffold(
            containerColor = Zw.colors.page,
            floatingActionButton = {
                if (current.hasFab) {
                    FloatingActionButton(
                        onClick = { /* Quick add arrives in M1 (SPEC §4.2). */ },
                        containerColor = Zw.colors.primary,
                        contentColor = Zw.colors.onPrimary,
                    ) {
                        Icon(
                            painterResource(DsR.drawable.zw_ic_add),
                            contentDescription = stringResource(R.string.quick_add),
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
                composable<HomeRoute> { HomeScreen(HomeUiState.FirstRun(Greeting.forHour(hourOfDay))) }
                composable<ActivityRoute> { TransactionsScreen() }
                composable<InsightsRoute> { InsightsScreen() }
                composable<PeopleRoute> { PeopleScreen() }
            }
        }
    }
}
