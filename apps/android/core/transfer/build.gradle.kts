// SPDX-License-Identifier: GPL-3.0-only
// .zwallet merge engine (pure Kotlin). The Room adapter and crypto codec arrive in M1.
plugins {
    id("zw.jvm.library")
}

dependencies {
    api(project(":core:model"))
}
