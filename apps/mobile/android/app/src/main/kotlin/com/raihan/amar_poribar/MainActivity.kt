package com.raihan.amar_poribar

import android.content.Intent
import android.net.Uri
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    /** Text shared from another app (a bKash, Nagad or Rocket message) becomes `/add/sms?text=...`. */
    private fun sharedRoute(intent: Intent?): String? {
        if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") return null
        val text = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return null
        return "/add/sms?text=" + Uri.encode(text)
    }

    override fun getInitialRoute(): String? = sharedRoute(intent) ?: super.getInitialRoute()

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val route = sharedRoute(intent) ?: return
        flutterEngine?.navigationChannel?.pushRoute(route)
    }
}
