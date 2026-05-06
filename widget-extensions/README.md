# Widget Extensions

Widgets require native platform code (SwiftUI/WidgetKit on iOS, Glance on Android).
They cannot be written in React Native — they run as separate processes that read shared data.

## Architecture

```
App → writes to Supabase → Widget reads via HTTP on refresh
       (or: App → shared UserDefaults/SharedPreferences → Widget reads locally)
```

The simplest production approach: widgets make a lightweight REST call to Supabase
on every refresh using the user's stored session token.

## iOS (WidgetKit)

Requires: Xcode, Apple Developer account, `expo prebuild` to generate native project.

Steps:
1. Run `npx expo prebuild` to eject to bare workflow
2. Open `ios/HabitTracker.xcworkspace` in Xcode
3. Add a new Widget Extension target: File → New → Target → Widget Extension
4. The widget reads from Supabase using URLSession (no React Native involved)
5. Store auth token in Keychain or App Group UserDefaults for widget access
6. Build and sign via EAS: `eas build --platform ios`

## Android (Glance)

Requires: Android Studio, `expo prebuild`.

Steps:
1. Run `npx expo prebuild`
2. Open `android/` in Android Studio
3. Add `implementation("androidx.glance:glance-appwidget:1.0.0")` to `app/build.gradle`
4. Create `HabitWidget.kt` in the app package
5. Register in `AndroidManifest.xml`
6. Build via EAS: `eas build --platform android`

## Shared Data Strategy

For both platforms, the widget needs today's habits + completion status.
Recommended: store a compact JSON snapshot in:
- iOS: App Group UserDefaults (`group.com.habittracker.app`)
- Android: SharedPreferences with widget-readable path

The main app writes this snapshot after every completion toggle.
The widget reads it on refresh (no network call needed for basic display).

## EAS Build Setup

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all
```

See `eas.json` for build profiles once configured.
