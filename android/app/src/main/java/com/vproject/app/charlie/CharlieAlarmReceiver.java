package com.vproject.app.charlie;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CharlieAlarmReceiver extends BroadcastReceiver {

  public static final String ACTION_FIRE = "com.vproject.app.charlie.FIRE_ALARM";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || !ACTION_FIRE.equals(intent.getAction())) return;

    String caller = intent.getStringExtra(CharlieCallActivity.EXTRA_CALLER);
    String reason = intent.getStringExtra(CharlieCallActivity.EXTRA_REASON);
    String callId = intent.getStringExtra(CharlieCallActivity.EXTRA_CALL_ID);
    String audioKey = intent.getStringExtra(CharlieCallActivity.EXTRA_AUDIO_KEY);
    String mode = intent.getStringExtra(CharlieCallActivity.EXTRA_MODE);

    Intent ui = new Intent(context, CharlieCallActivity.class);
    ui.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    ui.putExtra(CharlieCallActivity.EXTRA_CALLER, caller != null ? caller : "Charlie");
    ui.putExtra(CharlieCallActivity.EXTRA_REASON, reason != null ? reason : "Hora de subir");
    ui.putExtra(CharlieCallActivity.EXTRA_CALL_ID, callId != null ? callId : String.valueOf(System.currentTimeMillis()));
    ui.putExtra(CharlieCallActivity.EXTRA_AUDIO_KEY, audioKey != null ? audioKey : "classic");
    ui.putExtra(CharlieCallActivity.EXTRA_MODE, mode != null ? mode : "alarm");

    CharlieCallNotifier.showIncoming(
      context,
      caller != null ? caller : "Charlie",
      reason != null ? reason : "Hora de subir",
      ui
    );
    context.startActivity(ui);
  }
}
