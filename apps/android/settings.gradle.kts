// SPDX-License-Identifier: GPL-3.0-only
pluginManagement {
    includeBuild("build-logic")
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "zwallet"

include(":app")
include(":core:model")
include(":core:transfer")
include(":core:designsystem")
include(":core:testing")
include(":feature:home")
include(":feature:transactions")
include(":feature:insights")
include(":feature:people")
