# Keep rules for release shrinking (R8). Needed for reflection / JNI users.

# Flutter embedding
-keep class io.flutter.** { *; }
-dontwarn io.flutter.embedding.**
-dontwarn com.google.android.play.core.**

# WebRTC (flutter_webrtc / org.webrtc JNI)
-keep class org.webrtc.** { *; }
-keep class com.cloudwebrtc.webrtc.** { *; }
-dontwarn org.webrtc.**

# Firebase / Google Play services
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Drift / sqlite3 native bindings
-keep class eu.simolution.** { *; }
-keep class org.sqlite.** { *; }
-keep class androidx.sqlite.** { *; }
-dontwarn org.sqlite.**
