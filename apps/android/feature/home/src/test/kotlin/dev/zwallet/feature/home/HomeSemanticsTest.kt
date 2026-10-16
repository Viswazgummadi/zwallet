// SPDX-License-Identifier: GPL-3.0-only
package dev.zwallet.feature.home

import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.performClick
import dev.zwallet.core.designsystem.theme.ZwTheme
import dev.zwallet.core.testing.ZwScreenshotTest
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test

class HomeSemanticsTest : ZwScreenshotTest() {
    @get:Rule
    val compose = createComposeRule()

    @Test
    fun loadingSkeletonIsAnnouncedAsAnIndeterminateProgress() {
        compose.setContent { ZwTheme { HomeScreen(HomeUiState.Loading(Greeting.MORNING), animateSkeleton = false) } }
        val node = compose.onNodeWithContentDescription("Loading")
        node.assertExists()
        val info = node.fetchSemanticsNode().config[SemanticsProperties.ProgressBarRangeInfo]
        assertEquals(ProgressBarRangeInfo.Indeterminate, info)
    }

    @Test
    fun menuButtonIsLabelledMenuAndForwardsClicks() {
        var opened = 0
        compose.setContent {
            ZwTheme {
                HomeScreen(HomeUiState.FirstRun(Greeting.MORNING), actions = HomeActions(onOpenMenu = { opened++ }))
            }
        }
        compose.onNodeWithContentDescription("Menu").performClick()
        assertEquals(1, opened)
    }
}
