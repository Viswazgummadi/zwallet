// SPDX-License-Identifier: GPL-3.0-only
// Module configuration lives in build-logic convention plugins (zw.*). Applying them here with
// `apply false` puts every plugin on one classloader for all modules.
plugins {
    id("zw.android.application") apply false
}
