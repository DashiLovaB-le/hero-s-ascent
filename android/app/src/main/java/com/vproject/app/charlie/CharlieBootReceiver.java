package com.vproject.app.charlie;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Reagenda o próximo alarme após reboot (prefs gravadas pelo JS via SharedPreferences bridge).
 * O app também re-sincroniza ao abrir (fonte da verdade: Supabase + scheduleAlarm).
 */
public class CharlieBootReceiver extends BroadcastReceiver {

  public static final String PREFS = "charlie_alarm_prefs";
  public static final String KEY_NEXT_AT = "next_trigger_at_ms";
  public static final String KEY_ENABLED = "enabled";
  public static final String KEY_CALLER = "caller";
  public static final String KEY_REASON = "reason";
  public static final String KEY_AUDIO = "audio_key";
  public static final String KEY_CALL_ID = "call_id";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    String action = intent.getAction();
    if (
      !Intent.ACTION_BOOT_COMPLETED.equals(action) &&
      !"android.intent.action.LOCKED_BOOT_COMPLETED".equals(action) &&
      !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
    ) {
      return;
    }

    SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    if (!prefs.getBoolean(KEY_ENABLED, false)) return;
    long at = prefs.getLong(KEY_NEXT_AT, 0L);
    if (at <= System.currentTimeMillis()) return;

    CharlieAlarmScheduler.schedule(
      context,
      at,
      77001,
      prefs.getString(KEY_CALLER, "Charlie"),
      prefs.getString(KEY_REASON, "Hora de subir"),
      prefs.getString(KEY_CALL_ID, "boot-" + at),
      prefs.getString(KEY_AUDIO, "classico")
    );
  }
}
