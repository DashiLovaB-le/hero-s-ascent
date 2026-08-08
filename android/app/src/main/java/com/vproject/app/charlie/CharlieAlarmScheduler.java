package com.vproject.app.charlie;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public final class CharlieAlarmScheduler {

  private CharlieAlarmScheduler() {}

  public static void schedule(
    Context context,
    long triggerAtMs,
    int requestCode,
    String callerName,
    String reason,
    String callId,
    String audioKey
  ) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;

    Intent intent = new Intent(context, CharlieAlarmReceiver.class);
    intent.setAction(CharlieAlarmReceiver.ACTION_FIRE);
    intent.putExtra(CharlieCallActivity.EXTRA_CALLER, callerName);
    intent.putExtra(CharlieCallActivity.EXTRA_REASON, reason);
    intent.putExtra(CharlieCallActivity.EXTRA_CALL_ID, callId);
    intent.putExtra(CharlieCallActivity.EXTRA_AUDIO_KEY, audioKey);
    intent.putExtra(CharlieCallActivity.EXTRA_MODE, "alarm");

    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    PendingIntent pi = PendingIntent.getBroadcast(context, requestCode, intent, flags);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
    } else {
      am.setExact(AlarmManager.RTC_WAKEUP, triggerAtMs, pi);
    }
  }

  public static void cancel(Context context, int requestCode) {
    AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (am == null) return;
    Intent intent = new Intent(context, CharlieAlarmReceiver.class);
    intent.setAction(CharlieAlarmReceiver.ACTION_FIRE);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    PendingIntent pi = PendingIntent.getBroadcast(context, requestCode, intent, flags);
    am.cancel(pi);
  }
}
