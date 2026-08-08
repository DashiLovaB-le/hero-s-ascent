package com.vproject.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.vproject.app.charlie.CharlieCallPlugin;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(CharlieCallPlugin.class);
    super.onCreate(savedInstanceState);
    handleCharlieExtras(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleCharlieExtras(intent);
  }

  private void handleCharlieExtras(Intent intent) {
    if (intent == null || !intent.getBooleanExtra("charlie_alarm_ritual", false)) return;
    final String callId = intent.getStringExtra("callId");
    final String audioKey = intent.getStringExtra("audioKey");
    final String mode = intent.getStringExtra("mode");
    final String path =
      "/alarm/ritual?callId=" +
      (callId != null ? callId : "") +
      "&audioKey=" +
      (audioKey != null ? audioKey : "classic") +
      "&mode=" +
      (mode != null ? mode : "alarm");

    if (this.bridge == null) return;
    this.bridge.getWebView().postDelayed(() -> {
      if (this.bridge == null || this.bridge.getWebView() == null) return;
      this.bridge.getWebView().evaluateJavascript(
        "window.location.assign(" + org.json.JSONObject.quote(path) + ")",
        null
      );
    }, 400);
  }
}
