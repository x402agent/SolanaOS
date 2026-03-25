import com.android.build.api.variant.impl.VariantOutputImpl
import org.gradle.api.tasks.Sync

fun Project.rootEnvValue(name: String): String? {
    val envFiles =
        listOf(
            rootProject.projectDir.resolve("../../.env.local"),
            rootProject.projectDir.resolve("../../.env"),
        )

    for (envFile in envFiles) {
        if (!envFile.isFile) continue
        envFile.useLines { lines ->
            for (rawLine in lines) {
                val line = rawLine.trim()
                if (line.isEmpty() || line.startsWith("#")) continue
                val separator = line.indexOf('=')
                if (separator <= 0) continue
                val key = line.substring(0, separator).trim()
                if (key != name) continue
                val value =
                    line
                        .substring(separator + 1)
                        .trim()
                        .removeSurrounding("\"")
                        .removeSurrounding("'")
                return value.ifEmpty { null }
            }
        }
    }
    return null
}

fun Project.localSigningValue(name: String): String? {
    val signingFile = rootProject.projectDir.resolve("release-signing.properties")
    if (!signingFile.isFile) return null
    signingFile.useLines { lines ->
        for (rawLine in lines) {
            val line = rawLine.trim()
            if (line.isEmpty() || line.startsWith("#")) continue
            val separator = line.indexOf('=')
            if (separator <= 0) continue
            val key = line.substring(0, separator).trim()
            if (key != name) continue
            val value =
                line
                    .substring(separator + 1)
                    .trim()
                    .removeSurrounding("\"")
                    .removeSurrounding("'")
            return value.ifEmpty { null }
        }
    }
    return null
}

fun Project.gradlePropertyOrEnv(name: String): String? {
    val fromGradle =
        providers
            .gradleProperty(name)
            .orNull
            ?.trim()
            .orEmpty()
    if (fromGradle.isNotEmpty()) return fromGradle
    val fromEnv = System.getenv(name)?.trim().orEmpty()
    if (fromEnv.isNotEmpty()) return fromEnv
    val fromLocalSigning = localSigningValue(name)?.trim().orEmpty()
    if (fromLocalSigning.isNotEmpty()) return fromLocalSigning
    return rootEnvValue(name)
}

fun String.asBuildConfigString(): String =
    "\"" +
        this
            .replace("\\", "\\\\")
            .replace("\"", "\\\"") +
        "\""

val androidVersionCode = 202603111
val androidVersionName = "2026.3.12"
val releaseArtifactBaseName = "solanaos-seeker-dappstore"

val androidStoreFile = project.gradlePropertyOrEnv("OPENCLAW_ANDROID_STORE_FILE")
val androidStorePassword = project.gradlePropertyOrEnv("OPENCLAW_ANDROID_STORE_PASSWORD")
val androidKeyAlias = project.gradlePropertyOrEnv("OPENCLAW_ANDROID_KEY_ALIAS")
val androidKeyPassword = project.gradlePropertyOrEnv("OPENCLAW_ANDROID_KEY_PASSWORD")
val androidOpenRouterApiKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_OPENROUTER_API_KEY")
        ?: project.gradlePropertyOrEnv("OPENROUTER_API_KEY")
        ?: ""
val androidTogetherApiKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_TOGETHER_API_KEY")
        ?: project.gradlePropertyOrEnv("TOGETHER_API_KEY")
        ?: ""
val androidTogetherModel =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_TOGETHER_MODEL")
        ?: project.gradlePropertyOrEnv("TOGETHER_MODEL")
        ?: "MiniMaxAI/MiniMax-M2.5"
val androidOpenRouterModel =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_OPENROUTER_MODEL")
        ?: project.gradlePropertyOrEnv("OPENROUTER_MODEL")
        ?: "minimax/minimax-m2.7"
val androidOpenRouterOpenAiModel =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_OPENROUTER_OPENAI_MODEL")
        ?: project.gradlePropertyOrEnv("OPENROUTER_OPENAI_MODEL")
        ?: "openai/gpt-5.4-mini"
val androidOpenRouterGrokModel =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_OPENROUTER_GROK_MODEL")
        ?: project.gradlePropertyOrEnv("OPENROUTER_GROK_MODEL")
        ?: "x-ai/grok-4.20-beta"
val androidXAiApiKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_XAI_API_KEY")
        ?: project.gradlePropertyOrEnv("XAI_API_KEY")
        ?: ""
val androidXAiSearchModel =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_XAI_SEARCH_MODEL")
        ?: project.gradlePropertyOrEnv("XAI_SEARCH_MODEL")
        ?: "grok-4.20-reasoning"
val androidXAiImageModel =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_XAI_IMAGE_MODEL")
        ?: project.gradlePropertyOrEnv("XAI_IMAGE_MODEL")
        ?: "grok-imagine-image"
val androidHeliusRpcUrl =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_HELIUS_RPC_URL")
        ?: project.gradlePropertyOrEnv("HELIUS_RPC_URL")
        ?: "https://api.mainnet-beta.solana.com"
val androidSolanaTrackerRpcUrl =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_SOLANA_TRACKER_RPC_URL")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_RPC_URL")
        ?: ""
val androidSolanaTrackerWsUrl =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_SOLANA_TRACKER_WS_URL")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_WS_URL")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_WSS_URL")
        ?: ""
val androidSolanaTrackerApiKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_SOLANA_TRACKER_API_KEY")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_API_KEY")
        ?: ""
val androidSolanaTrackerDataApiKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_SOLANA_TRACKER_DATA_API_KEY")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_DATA_API_KEY")
        ?: ""
val androidSolanaTrackerDatastreamKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_SOLANA_TRACKER_DATASTREAM_KEY")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_DATASTREAM_KEY")
        ?: project.gradlePropertyOrEnv("SOLANA_TRACKER_API_KEY")
        ?: ""
val androidJupiterApiKey =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_JUPITER_API_KEY")
        ?: project.gradlePropertyOrEnv("JUP_SWAP_V1_API_KEY")
        ?: project.gradlePropertyOrEnv("JUPITER_API_KEY")
        ?: project.gradlePropertyOrEnv("NEXT_PUBLIC_JUP_SWAP_V1_API_KEY")
        ?: ""
val androidJupiterEndpoint =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_JUPITER_ENDPOINT")
        ?: project.gradlePropertyOrEnv("JUPITER_ENDPOINT")
        ?: "https://api.jup.ag"
val androidJupiterUltraEndpoint =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_JUPITER_ULTRA_ENDPOINT")
        ?: project.gradlePropertyOrEnv("JUPITER_ULTRA_ENDPOINT")
        ?: "https://api.jup.ag/ultra"
val androidJupiterReferral =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_JUPITER_REFERRAL")
        ?: project.gradlePropertyOrEnv("JUPITER_REFERRAL")
        ?: project.gradlePropertyOrEnv("NEXT_PUBLIC_REFERRAL_KEY")
        ?: project.gradlePropertyOrEnv("NEXT_PUBLIC_REFERRAL_ACCOUNT")
        ?: ""
val androidPublicSolanaRpcUrl = "https://api.mainnet-beta.solana.com"
val androidDebugDefaultSolanaRpcUrl =
    if (androidSolanaTrackerRpcUrl.isNotBlank()) {
        androidSolanaTrackerRpcUrl
    } else if (androidHeliusRpcUrl.isNotBlank()) {
        androidHeliusRpcUrl
    } else {
        androidPublicSolanaRpcUrl
    }
val androidConvexCloudUrl =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_CONVEX_URL")
        ?: project.gradlePropertyOrEnv("VITE_CONVEX_URL")
        ?: project.gradlePropertyOrEnv("CONVEX_URL")
        ?: "https://artful-frog-940.convex.cloud"
val androidConvexSiteUrl =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_CONVEX_SITE_URL")
        ?: project.gradlePropertyOrEnv("VITE_CONVEX_SITE_URL")
        ?: project.gradlePropertyOrEnv("CONVEX_SITE_URL")
        ?: "https://artful-frog-940.convex.site"
val androidGodotVersion =
    project.gradlePropertyOrEnv("SOLANAOS_ANDROID_GODOT_VERSION")
        ?: project.gradlePropertyOrEnv("GODOT_ANDROID_VERSION")
        ?: "4.5.1.stable"
val resolvedAndroidStoreFile =
    androidStoreFile?.let { storeFilePath ->
        if (storeFilePath.startsWith("~/")) {
            "${System.getProperty("user.home")}/${storeFilePath.removePrefix("~/")}"
        } else {
            storeFilePath
        }
    }
val resolvedAndroidStoreFileExists = resolvedAndroidStoreFile?.let { project.file(it).isFile } ?: false
val smbRemasterAssetRoot = layout.projectDirectory.dir("src/main/assets/arcade/platformer/remaster")
val smbRemasterGeneratedAssetsDir = layout.buildDirectory.dir("generated/assets/smb-remaster-root")
val smbRemasterAndroidFilePickerDir = smbRemasterAssetRoot.dir("addons/AndroidFilePicker")

val hasAndroidReleaseSigning =
    listOf(resolvedAndroidStoreFile, androidStorePassword, androidKeyAlias, androidKeyPassword).all { !it.isNullOrBlank() } &&
        resolvedAndroidStoreFileExists

val wantsAndroidReleaseBuild =
    gradle.startParameter.taskNames.any { taskName ->
        val normalized = taskName.substringAfterLast(':')
        normalized.equals("assembleRelease", ignoreCase = true) ||
            normalized.equals("bundleRelease", ignoreCase = true) ||
            normalized.equals("packageRelease", ignoreCase = true) ||
            normalized.equals("assembleSeekerRelease", ignoreCase = true) ||
            normalized.equals("assembleDappStoreRelease", ignoreCase = true)
    }

if (wantsAndroidReleaseBuild && !hasAndroidReleaseSigning) {
    val storeFileMessage =
        when {
            resolvedAndroidStoreFile.isNullOrBlank() -> "OPENCLAW_ANDROID_STORE_FILE is missing."
            !resolvedAndroidStoreFileExists -> "OPENCLAW_ANDROID_STORE_FILE does not exist at $resolvedAndroidStoreFile."
            else -> null
        }
    error(
        "Missing Android release signing properties. Set OPENCLAW_ANDROID_STORE_FILE, " +
            "OPENCLAW_ANDROID_STORE_PASSWORD, OPENCLAW_ANDROID_KEY_ALIAS, and " +
            "OPENCLAW_ANDROID_KEY_PASSWORD in ~/.gradle/gradle.properties or environment variables." +
            (storeFileMessage?.let { " $it" } ?: ""),
    )
}

plugins {
    id("com.android.application")
    id("org.jlleitschuh.gradle.ktlint")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "ai.openclaw.app"
    compileSdk = 36

    // Release signing is local-only; keep the keystore path and passwords out of the repo.
    signingConfigs {
        if (hasAndroidReleaseSigning) {
            create("release") {
                storeFile = project.file(checkNotNull(resolvedAndroidStoreFile))
                storePassword = checkNotNull(androidStorePassword)
                keyAlias = checkNotNull(androidKeyAlias)
                keyPassword = checkNotNull(androidKeyPassword)
            }
        }
    }

    sourceSets {
        getByName("main") {
            assets.directories.add("../../shared/OpenClawKit/Sources/OpenClawKit/Resources")
            assets.directories.add(smbRemasterGeneratedAssetsDir.get().asFile.absolutePath)
        }
    }

    defaultConfig {
        applicationId = "com.nanosolana.solanaos"
        minSdk = 31
        targetSdk = 36
        versionCode = androidVersionCode
        versionName = androidVersionName
        buildConfigField("String", "TOGETHER_API_KEY", "".asBuildConfigString())
        buildConfigField("String", "TOGETHER_MODEL", androidTogetherModel.asBuildConfigString())
        buildConfigField("String", "OPENROUTER_MODEL", androidOpenRouterModel.asBuildConfigString())
        buildConfigField("String", "OPENROUTER_OPENAI_MODEL", androidOpenRouterOpenAiModel.asBuildConfigString())
        buildConfigField("String", "OPENROUTER_GROK_MODEL", androidOpenRouterGrokModel.asBuildConfigString())
        buildConfigField("String", "OPENROUTER_API_KEY", "".asBuildConfigString())
        buildConfigField("String", "XAI_API_KEY", "".asBuildConfigString())
        buildConfigField("String", "XAI_SEARCH_MODEL", androidXAiSearchModel.asBuildConfigString())
        buildConfigField("String", "XAI_IMAGE_MODEL", androidXAiImageModel.asBuildConfigString())
        buildConfigField("String", "HELIUS_RPC_URL", androidPublicSolanaRpcUrl.asBuildConfigString())
        buildConfigField("String", "SOLANA_TRACKER_RPC_URL", "".asBuildConfigString())
        buildConfigField("String", "SOLANA_TRACKER_WS_URL", "".asBuildConfigString())
        buildConfigField("String", "SOLANA_TRACKER_API_KEY", "".asBuildConfigString())
        buildConfigField("String", "SOLANA_TRACKER_DATA_API_KEY", "".asBuildConfigString())
        buildConfigField("String", "SOLANA_TRACKER_DATASTREAM_KEY", "".asBuildConfigString())
        buildConfigField("String", "JUPITER_API_KEY", "".asBuildConfigString())
        buildConfigField("String", "JUPITER_ENDPOINT", androidJupiterEndpoint.asBuildConfigString())
        buildConfigField("String", "JUPITER_ULTRA_ENDPOINT", androidJupiterUltraEndpoint.asBuildConfigString())
        buildConfigField("String", "JUPITER_REFERRAL", androidJupiterReferral.asBuildConfigString())
        buildConfigField("String", "DEFAULT_SOLANA_RPC_URL", androidPublicSolanaRpcUrl.asBuildConfigString())
        buildConfigField("String", "CONVEX_URL", androidConvexCloudUrl.asBuildConfigString())
        buildConfigField("String", "CONVEX_SITE_URL", androidConvexSiteUrl.asBuildConfigString())
        buildConfigField("String", "SEEKER_SITE_URL", "https://seeker.solanaos.net".asBuildConfigString())
        buildConfigField("String", "SEEKER_SOLANAOS_URL", "https://seeker.solanaos.net/solanaos".asBuildConfigString())
        buildConfigField("boolean", "TOGETHER_DIRECT_ENABLED", "false")
        buildConfigField("boolean", "OPENROUTER_DIRECT_ENABLED", "false")
        buildConfigField("boolean", "XAI_DIRECT_ENABLED", "false")
        buildConfigField("boolean", "CONVEX_ENABLED", if (androidConvexSiteUrl.isNotBlank()) "true" else "false")
        ndk {
            // Support all major ABIs — native libs are tiny (~47 KB per ABI)
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
        }
    }

    buildTypes {
        release {
            if (hasAndroidReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            isJniDebuggable = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            isMinifyEnabled = false
            buildConfigField("String", "TOGETHER_API_KEY", androidTogetherApiKey.asBuildConfigString())
            buildConfigField("String", "TOGETHER_MODEL", androidTogetherModel.asBuildConfigString())
            buildConfigField("String", "OPENROUTER_API_KEY", androidOpenRouterApiKey.asBuildConfigString())
            buildConfigField("String", "XAI_API_KEY", androidXAiApiKey.asBuildConfigString())
            buildConfigField("String", "HELIUS_RPC_URL", androidHeliusRpcUrl.asBuildConfigString())
            buildConfigField("String", "SOLANA_TRACKER_RPC_URL", androidSolanaTrackerRpcUrl.asBuildConfigString())
            buildConfigField("String", "SOLANA_TRACKER_WS_URL", androidSolanaTrackerWsUrl.asBuildConfigString())
            buildConfigField("String", "SOLANA_TRACKER_API_KEY", androidSolanaTrackerApiKey.asBuildConfigString())
            buildConfigField("String", "SOLANA_TRACKER_DATA_API_KEY", androidSolanaTrackerDataApiKey.asBuildConfigString())
            buildConfigField("String", "SOLANA_TRACKER_DATASTREAM_KEY", androidSolanaTrackerDatastreamKey.asBuildConfigString())
            buildConfigField("String", "JUPITER_API_KEY", androidJupiterApiKey.asBuildConfigString())
            buildConfigField("String", "JUPITER_ENDPOINT", androidJupiterEndpoint.asBuildConfigString())
            buildConfigField("String", "JUPITER_ULTRA_ENDPOINT", androidJupiterUltraEndpoint.asBuildConfigString())
            buildConfigField("String", "JUPITER_REFERRAL", androidJupiterReferral.asBuildConfigString())
            buildConfigField("String", "DEFAULT_SOLANA_RPC_URL", androidDebugDefaultSolanaRpcUrl.asBuildConfigString())
            buildConfigField("boolean", "TOGETHER_DIRECT_ENABLED", if (androidTogetherApiKey.isNotBlank()) "true" else "false")
            buildConfigField("boolean", "OPENROUTER_DIRECT_ENABLED", if (androidOpenRouterApiKey.isNotBlank()) "true" else "false")
            buildConfigField("boolean", "XAI_DIRECT_ENABLED", if (androidXAiApiKey.isNotBlank()) "true" else "false")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    androidResources {
        // Keep Godot-compatible asset discovery for compiled exports that rely on the hidden .godot payload.
        ignoreAssetsPattern = "!.svn:!.git:!.gitignore:!.ds_store:!*.scc:<dir>_*:!CVS:!thumbs.db:!picasa.ini:!*~:!.godot:!.godot/**"
    }

    packaging {
        resources {
            excludes +=
                setOf(
                    "/META-INF/{AL2.0,LGPL2.1}",
                    "/META-INF/*.version",
                    "/META-INF/LICENSE*.txt",
                    "/META-INF/services/java.net.spi.InetAddressResolverProvider",
                    "DebugProbesKt.bin",
                    "kotlin-tooling-metadata.json",
                )
        }
        jniLibs {
            pickFirsts +=
                setOf(
                    "lib/x86/libc++_shared.so",
                    "lib/x86_64/libc++_shared.so",
                    "lib/armeabi-v7a/libc++_shared.so",
                    "lib/arm64-v8a/libc++_shared.so",
                )
        }
    }

    lint {
        disable +=
            setOf(
                "AndroidGradlePluginVersion",
                "GradleDependency",
                "IconLauncherShape",
                "NewerVersionAvailable",
            )
        warningsAsErrors = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

androidComponents {
    onVariants { variant ->
        variant.outputs
            .filterIsInstance<VariantOutputImpl>()
            .forEach { output ->
                val outputFileName =
                    if (variant.buildType == "release") {
                        "$releaseArtifactBaseName-$androidVersionName-release.apk"
                    } else {
                        "solanaos-mobile-$androidVersionName-${variant.buildType}.apk"
                    }
                output.outputFileName = outputFileName
            }
    }
}
kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        allWarningsAsErrors.set(true)
    }
}

ktlint {
    android.set(true)
    ignoreFailures.set(false)
    filter {
        exclude("**/build/**")
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.02.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.10.0")
    implementation("androidx.activity:activity-compose:1.12.2")
    implementation("androidx.webkit:webkit:1.15.0")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    // material-icons-extended pulled in full icon set (~20 MB DEX). Only ~18 icons used.
    // R8 will tree-shake unused icons when minify is enabled on release builds.
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.9.7")

    debugImplementation("androidx.compose.ui:ui-tooling")

    // Material Components (XML theme + resources)
    implementation("com.google.android.material:material:1.13.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.10.0")

    implementation("androidx.security:security-crypto:1.1.0")
    implementation("androidx.exifinterface:exifinterface:1.4.2")
    implementation("com.squareup.okhttp3:okhttp:5.3.2")
    implementation("org.bouncycastle:bcprov-jdk18on:1.83")
    implementation("org.commonmark:commonmark:0.27.1")
    implementation("org.commonmark:commonmark-ext-autolink:0.27.1")
    implementation("org.commonmark:commonmark-ext-gfm-strikethrough:0.27.1")
    implementation("org.commonmark:commonmark-ext-gfm-tables:0.27.1")
    implementation("org.commonmark:commonmark-ext-task-list-items:0.27.1")
    implementation("org.godotengine:godot:$androidGodotVersion")
    debugImplementation(files(smbRemasterAndroidFilePickerDir.file("app-debug.aar")))
    releaseImplementation(files(smbRemasterAndroidFilePickerDir.file("app-release.aar")))

    // CameraX (for node.invoke camera.* parity)
    implementation("androidx.camera:camera-core:1.5.2")
    implementation("androidx.camera:camera-camera2:1.5.2")
    implementation("androidx.camera:camera-lifecycle:1.5.2")
    implementation("androidx.camera:camera-video:1.5.2")
    implementation("androidx.camera:camera-view:1.5.2")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")

    // Unicast DNS-SD (Wide-Area Bonjour) for tailnet discovery domains.
    implementation("dnsjava:dnsjava:3.6.4")

    // Solana Mobile Wallet Adapter
    implementation("com.solanamobile:mobile-wallet-adapter-clientlib-ktx:2.0.7")
    implementation("io.github.funkatronics:multimult:0.2.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("io.kotest:kotest-runner-junit5-jvm:6.1.3")
    testImplementation("io.kotest:kotest-assertions-core-jvm:6.1.3")
    testImplementation("com.squareup.okhttp3:mockwebserver:5.3.2")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testRuntimeOnly("org.junit.vintage:junit-vintage-engine:6.0.2")
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
}

val prepareSmbRemasterGodotAssets =
    tasks.register<Sync>("prepareSmbRemasterGodotAssets") {
        group = "assets"
        description = "Stages the mirrored SMB remaster Godot project at the Android asset root for the embedded Godot runtime."
        from(smbRemasterAssetRoot)
        into(smbRemasterGeneratedAssetsDir)
    }

tasks.named("preBuild") {
    dependsOn(prepareSmbRemasterGodotAssets)
}

val releaseApkRelativePath = "build/outputs/apk/release/$releaseArtifactBaseName-$androidVersionName-release.apk"

tasks.register("validateAndroidReleaseSigning") {
    group = "release"
    description = "Validates that release signing properties are configured for Solana Seeker / dApp Store builds."
    doLast {
        check(hasAndroidReleaseSigning) {
            "Release signing is not configured. Set OPENCLAW_ANDROID_STORE_FILE, OPENCLAW_ANDROID_STORE_PASSWORD, " +
                "OPENCLAW_ANDROID_KEY_ALIAS, and OPENCLAW_ANDROID_KEY_PASSWORD before building a release APK."
        }
    }
}

tasks.register("printSeekerReleaseApkPath") {
    group = "release"
    description = "Prints the expected Solana Seeker / dApp Store release APK path."
    doLast {
        println(
            layout
                .projectDirectory
                .file(releaseApkRelativePath)
                .asFile
                .absolutePath,
        )
    }
}

tasks.register("assembleSeekerRelease") {
    group = "release"
    description = "Builds the signed Solana Seeker release APK."
    dependsOn("validateAndroidReleaseSigning", "assembleRelease")
    finalizedBy("printSeekerReleaseApkPath")
}

tasks.register("assembleDappStoreRelease") {
    group = "release"
    description = "Builds the signed Solana Mobile dApp Store release APK."
    dependsOn("validateAndroidReleaseSigning", "assembleRelease")
    finalizedBy("printSeekerReleaseApkPath")
}
