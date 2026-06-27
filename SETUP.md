# HRMS — Full Setup Guide (for an AI agent)

> **Purpose:** This document lets an AI coding agent (e.g. Claude Code) set up this
> entire project from scratch on a **new machine** and get the mobile app running on
> an Android emulator, plus the backend + Supabase + database.
>
> Read this whole file first, then execute the phases in order. After each phase run
> its **✅ Verify** command and do not continue until it passes. A **Troubleshooting**
> section at the end documents every real failure encountered while bootstrapping this
> project — consult it whenever a step fails.

---

## 0. What this project is

A **Human Resource Management System (HRMS)**.

| Layer | Tech |
|---|---|
| Mobile app | React Native **0.86** + TypeScript (`apps/mobile`) |
| Backend API | NestJS + TypeScript (`apps/backend`), global prefix `/api/v1`, port `3000` |
| Database | PostgreSQL (TypeORM) |
| Cache | Redis |
| File storage | Supabase Storage (bucket `hrms-files`) |
| Push (deferred) | Firebase FCM — **not configured yet**, env left blank on purpose |
| Charts | `react-native-svg` |
| Animations | `react-native-reanimated` v4 + `react-native-worklets` |
| Repo layout | **npm workspaces monorepo** → deps hoist to the **repo-root `node_modules`** |
| Infra (local) | Docker Compose (`docker-compose.dev.yml` = Postgres + Redis only) |
| CI/CD | GitHub Actions (`.github/workflows/*`) |

**Bottom tab order in the app:** Home → Tickets → Leave → Profile.
Other screens (Payslip, Timesheet, Assets, Ticket detail, Raise-a-ticket) are pushed
on top of the tabs.

---

## 1. ⚠️ Critical constraints — read before doing anything

These caused real, hours-long failures. Honor them up front.

1. **Clone to a SHORT path. Never inside OneDrive / deep folders.**
   The Android C++ (NDK/ninja) build mirrors absolute paths for each object file and
   **breaks past the Windows 260-char limit**. Enabling `LongPathsEnabled` does **not**
   fix it (the NDK's bundled `ninja` ignores it).
   - ✅ Use `C:\HRMS` (Windows) or `~/HRMS` (macOS/Linux).
   - ❌ Never `C:\Users\<you>\OneDrive\Desktop\...\HRMS`.

2. **Use JDK 17.** Not 21, not 25. React Native 0.86 is built/tested on JDK 17.
   Make sure `JAVA_HOME` points at a **17** JDK even if newer JDKs are installed.

3. **This is an npm-workspaces monorepo.** All dependencies hoist to the **root**
   `node_modules`, *not* `apps/mobile/node_modules`. The repo is already configured for
   this (see `apps/mobile/android/settings.gradle`, `app/build.gradle`, and
   `apps/mobile/metro.config.js`). Do not "fix" those paths back to local node_modules.

4. **Secrets live in `apps/backend/.env`** (gitignored). Copy from `.env.example`.
   Never commit `.env`. Never expose the Supabase `service_role` key in the mobile app.

5. **iOS requires a Mac.** On Windows/Linux, use **Android** only.

---

## 2. Prerequisites to install

Install these (versions are what the project is verified against):

| Tool | Version | Windows install | macOS install |
|---|---|---|---|
| **Node.js** | 20 or 22 LTS | https://nodejs.org (.msi) | `brew install node@22` |
| **Git** | any recent | https://git-scm.com | `brew install git` |
| **JDK** | **17** (Temurin/Microsoft) | https://adoptium.net/temurin/releases/?version=17 | `brew install --cask temurin@17` |
| **Android SDK** | via Android Studio **or** cmdline-tools | https://developer.android.com/studio | `brew install --cask android-studio` |
| **Docker Desktop** | any recent (for DB/Redis) | https://docker.com | `brew install --cask docker` |
| **Watchman** (mac only, optional) | latest | — | `brew install watchman` |

**Android SDK packages required** (install via Android Studio SDK Manager or `sdkmanager`):
- Platform: `platforms;android-36` (compileSdk 36) and a runnable image `platforms;android-34`
- `build-tools;36.0.0`
- `platform-tools`
- `ndk;27.1.12297006`  ← exact version; the project pins it
- `cmake;3.22.1`
- A system image for the emulator: `system-images;android-34;google_apis;x86_64`

> If installing the SDK without Android Studio, get **cmdline-tools** and run, e.g.:
> ```
> sdkmanager "platform-tools" "platforms;android-36" "platforms;android-34" \
>   "build-tools;36.0.0" "ndk;27.1.12297006" "cmake;3.22.1" \
>   "system-images;android-34;google_apis;x86_64"
> sdkmanager --licenses
> ```

---

## 3. Environment variables

Set these **permanently** (User scope), then also for the current shell.

### Windows (PowerShell)
```powershell
# Adjust the JDK path to your actual JDK 17 install:
$jdk = "C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot"
$sdk = "$env:LOCALAPPDATA\Android\Sdk"

[Environment]::SetEnvironmentVariable("JAVA_HOME", $jdk, "User")
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $sdk, "User")
$userPath = [Environment]::GetEnvironmentVariable("Path","User")
$add = @("$jdk\bin","$sdk\platform-tools","$sdk\emulator","$sdk\cmdline-tools\latest\bin")
$parts = ($userPath -split ';') | Where-Object { $_ -and ($add -notcontains $_) }
[Environment]::SetEnvironmentVariable("Path", (($parts + $add) -join ';'), "User")

# current session:
$env:JAVA_HOME=$jdk; $env:ANDROID_HOME=$sdk
$env:Path="$jdk\bin;$sdk\platform-tools;$sdk\emulator;$sdk\cmdline-tools\latest\bin;$env:Path"
```

> ⚠️ New shells spawned by tooling may still inherit a stale `JAVA_HOME` (e.g. an old
> JDK 11/25). If a build complains about the JDK, set `$env:JAVA_HOME` **inline** at the
> top of that command.

### macOS / Linux (bash/zsh)
```bash
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"        # macOS
export ANDROID_HOME="$HOME/Library/Android/sdk"           # macOS
# Linux: export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

**✅ Verify:**
```
java -version      # must print 17.x
adb version        # must print a version
echo $ANDROID_HOME # must point to the SDK
```

---

## 4. Clone the repo (to a SHORT path)

```bash
# Windows
git clone <REPO_URL> C:/HRMS
cd C:/HRMS

# macOS/Linux
git clone <REPO_URL> ~/HRMS
cd ~/HRMS
```
Repo: `https://github.com/adithya11sci/HRMS.git`

**✅ Verify:** `apps/mobile`, `apps/backend`, and root `package.json` (with
`"workspaces": ["apps/backend","apps/mobile"]`) all exist.

---

## 5. Install dependencies (from repo root)

```bash
npm install
```
This installs **both** workspaces and hoists everything to the root `node_modules`.

**✅ Verify** (all must exist):
```
node_modules/react-native
node_modules/react-native-worklets
node_modules/react-native-svg
node_modules/@react-native/gradle-plugin
node_modules/@babel/runtime/helpers/interopRequireDefault.js
```

---

## 6. Backend env + Supabase

```bash
# from repo root
cp apps/backend/.env.example apps/backend/.env      # Windows: copy apps\backend\.env.example apps\backend\.env
```

`.env.example` already contains the working **Supabase** values and a `JWT_SECRET`.
Confirm `apps/backend/.env` has:
```
SUPABASE_URL=https://byojyhijauxqdbjundnj.supabase.co
SUPABASE_ANON_KEY=<present>
SUPABASE_SERVICE_ROLE_KEY=<present>     # backend only — never ship in mobile
SUPABASE_BUCKET=hrms-files
JWT_SECRET=<present>
DB_HOST=localhost  DB_PORT=5432  DB_USERNAME=hrms_user  DB_PASSWORD=hrms_password  DB_NAME=hrms_db
REDIS_HOST=localhost  REDIS_PORT=6379
FIREBASE_PROJECT_ID=    # leave blank — Firebase FCM is deferred
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### Supabase notes
- Storage bucket is **`hrms-files`** (already created in the Supabase project).
- The backend uses the **`service_role`** key, which bypasses Row-Level-Security, so no
  extra storage policies are required.
- To point at a *different* Supabase project: create a bucket named `hrms-files`, then
  replace `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

**✅ Verify:** `apps/backend/.env` exists and is **not** tracked by git
(`git status` should not list it).

---

## 7. Start infrastructure (Postgres + Redis) + backend

```bash
# from repo root — starts only Postgres + Redis (dev infra)
docker compose -f docker-compose.dev.yml up -d

# run the API (watch mode)
npm run backend          # = nest start --watch in apps/backend
```
Backend serves at `http://localhost:3000/api/v1`.

**✅ Verify:** `docker ps` shows postgres + redis healthy; the backend logs
"Nest application successfully started".

> The mobile app reaches the backend at **`http://10.0.2.2:3000/api/v1`** from the
> Android emulator (`10.0.2.2` = host loopback). See `apps/mobile/src/services/api.ts`.
>
> **You can skip this whole phase** and still explore the UI: the app has a
> **demo-login fallback** (`apps/mobile/src/store/slices/authSlice.ts`) — if the backend
> is unreachable, any email/password logs you into a demo session.

---

## 8. Create + boot an Android emulator

```bash
# create an AVD from the installed system image (one-time)
avdmanager create avd --name HRMS_Pixel \
  --package "system-images;android-34;google_apis;x86_64" --device pixel_7 --force

# boot it — use SOFTWARE rendering to avoid GPU-hang on many Windows/discrete-GPU setups
emulator -avd HRMS_Pixel -gpu swiftshader_indirect -no-snapshot -no-boot-anim
```
(On Windows the binaries are under `%LOCALAPPDATA%\Android\Sdk\emulator\` and
`...\cmdline-tools\latest\bin\avdmanager.bat`. Pipe `"no"` into `avdmanager` to skip the
custom-hardware-profile prompt.)

**✅ Verify:** `adb devices` lists `emulator-5554   device`, and
`adb shell getprop sys.boot_completed` returns `1`.

---

## 9. Start Metro + build & install the app

```bash
# Terminal A — Metro bundler (from apps/mobile). Use --reset-cache on first run.
cd apps/mobile
npx react-native start --reset-cache
```
```bash
# Terminal B — build & install onto the running emulator
cd apps/mobile
npx react-native run-android
```

If `run-android` fails to invoke the Gradle wrapper (a known Windows quirk), build
directly:
```bash
# Windows
apps\mobile\android\gradlew.bat -p apps\mobile\android :app:installDebug -PreactNativeDevServerPort=8081
# macOS/Linux
./apps/mobile/android/gradlew -p apps/mobile/android :app:installDebug -PreactNativeDevServerPort=8081
```
> First build is heavy (compiles RN + reanimated + worklets + svg C++). Budget
> **10–20 minutes** and **~10 GB free disk**. Subsequent builds are cached (~2 min).

Then make sure the emulator can reach Metro and launch:
```bash
adb reverse tcp:8081 tcp:8081
adb shell monkey -p com.mobile -c android.intent.category.LAUNCHER 1
```

**✅ Verify:** the app opens to the **HRMS login** screen. Enter any email + password →
**Sign In** → lands on the **Dashboard** ("Good Evening", Today's Attendance, etc.).

---

## 10. Quick "run it again later" cheat sheet

```bash
# 1) boot emulator (software rendering)
emulator -avd HRMS_Pixel -gpu swiftshader_indirect -no-snapshot &
# 2) bundler
cd apps/mobile && npx react-native start
# 3) (new terminal) install/run
cd apps/mobile && npx react-native run-android
#    then: adb reverse tcp:8081 tcp:8081
```

---

## Troubleshooting (every issue hit while bootstrapping this project)

| Symptom | Cause | Fix |
|---|---|---|
| `ninja: Filename longer than 260 characters` / `[CXX1101]` mid-C++ build | Project path too deep (Windows MAX_PATH); NDK ninja ignores `LongPathsEnabled` | **Move repo to a short path** like `C:\HRMS`. Delete stale `android/app/.cxx` + `build` and rebuild. |
| `JAVA_HOME is set to an invalid directory` / wrong Java | `JAVA_HOME` points at old JDK (11/25) | Set `JAVA_HOME` to a **JDK 17**; set it **inline** in the build command if shells inherit a stale value. |
| `Included build '.../apps/mobile/node_modules/@react-native/gradle-plugin' does not exist` | Monorepo hoisting — packages are in root `node_modules` | Already fixed in `settings.gradle` / `app/build.gradle` (paths point 3–4 levels up to root). Don't revert. |
| `NDK ... did not have a source.properties file` | Corrupt/partial NDK | `sdkmanager "ndk;27.1.12297006"` (delete the broken folder first). |
| `[Reanimated] react-native-worklets library not found` | Reanimated v4 split worklets out | `npm i react-native-worklets` (already in package.json) + ensure `babel.config.js` lists `'react-native-worklets/plugin'` **last**. |
| Metro 500: `Unable to resolve module @babel/runtime/...` or any hoisted dep | Metro not monorepo-aware | Already fixed in `metro.config.js` (`watchFolders` + `nodeModulesPaths` include repo root). Restart Metro with `--reset-cache`. |
| Emulator process starts then **hangs** (no `adb` device, nothing on port 5554/5555) | Host GPU/driver issue | Boot with `-gpu swiftshader_indirect` (software rendering). |
| Red box: **"Unable to load script"** | Metro not running or no port forward | Start Metro, then `adb reverse tcp:8081 tcp:8081`, then reload (press `R` twice / tap RELOAD). |
| `gradlew.bat is not recognized` from `run-android` | RN CLI wrapper-spawn quirk on Windows | Invoke Gradle directly with `-p apps\mobile\android :app:installDebug`. |
| `There is not enough space on the disk` near end of build | Disk full (node_modules + build artifacts are several GB) | Free ≥10 GB. Remove stale duplicate `node_modules` / old build dirs. |
| `Sign In` does nothing / network error | Backend not running | Expected — the **demo-login fallback** logs you in with any credentials. Start the backend (Phase 7) for real auth. |

---

## File-level reference (already-applied monorepo fixes — keep them)

- `apps/mobile/android/settings.gradle` → `includeBuild("../../../node_modules/@react-native/gradle-plugin")`
- `apps/mobile/android/app/build.gradle` → `reactNativeDir` / `codegenDir` / `cliFile` point at `../../../../node_modules/...`
- `apps/mobile/metro.config.js` → `watchFolders: [workspaceRoot]` + `resolver.nodeModulesPaths`
- `apps/mobile/babel.config.js` → `plugins: ['react-native-worklets/plugin']`
- `apps/mobile/src/store/slices/authSlice.ts` → demo-login fallback when API unreachable
- `apps/backend/.env` (gitignored) → Supabase + JWT + DB + Redis config

---

## Firebase FCM (deferred — do later when asked)

1. Firebase Console → create project → add an Android app with package id **`com.mobile`**.
2. Download `google-services.json` → place in `apps/mobile/android/app/`.
3. Project Settings → Service Accounts → **Generate new private key**; fill
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in
   `apps/backend/.env`. Keep `FIREBASE_PRIVATE_KEY` on **one line** with literal `\n`.
4. The backend already uses Firebase Admin SDK v14 (named imports from
   `firebase-admin/app` + `firebase-admin/messaging`).
