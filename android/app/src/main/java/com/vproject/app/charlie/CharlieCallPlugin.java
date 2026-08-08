package com.vproject.app.charlie;

import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Charlie Call / Despertador — bridge Capacitor.
 * MVP Android: full-screen call Activity + AlarmManager exact.
 * Upgrade path: Core-Telecom self-managed when hardening for Play.
 */
@CapacitorPlugin(
  name = "CharlieCall",
  permissions = {
    @Permission(strings = { android.Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
  }
)
public class CharlieCallPlugin extends Plugin {

  public static CharlieCallPlugin instance;

  @Override
  public void load() {
    instance = this;
  }

  @PluginMethod
  public void present(PluginCall call) {
    String callerName = call.getString("callerName", "Charlie");
    String reason = call.getString("reason", "Hora de subir");
    String mode = call.getString("mode", "alarm");
    String callId = call.getString("callId", String.valueOf(System.currentTimeMillis()));
    String audioKey = call.getString("audioKey", "classico");

    Intent intent = new Intent(getContext(), CharlieCallActivity.class);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    intent.putExtra(CharlieCallActivity.EXTRA_CALLER, callerName);
    intent.putExtra(CharlieCallActivity.EXTRA_REASON, reason);
    intent.putExtra(CharlieCallActivity.EXTRA_MODE, mode);
    intent.putExtra(CharlieCallActivity.EXTRA_CALL_ID, callId);
    intent.putExtra(CharlieCallActivity.EXTRA_AUDIO_KEY, audioKey);

    CharlieCallNotifier.showIncoming(getContext(), callerName, reason, intent);
    getContext().startActivity(intent);

    JSObject ret = new JSObject();
    ret.put("callId", callId);
    ret.put("presented", true);
    call.resolve(ret);
  }

  @PluginMethod
  public void scheduleAlarm(PluginCall call) {
    long triggerAtMs = call.getLong("triggerAtMs", 0L);
    if (triggerAtMs <= 0) {
      call.reject("triggerAtMs inválido");
      return;
    }
    String callerName = call.getString("callerName", "Charlie");
    String reason = call.getString("reason", "Hora de subir");
    String callId = call.getString("callId", "alarm-" + triggerAtMs);
    String audioKey = call.getString("audioKey", "classico");
    int requestCode = call.getInt("requestCode", 77001);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      android.app.AlarmManager am = getContext().getSystemService(android.app.AlarmManager.class);
      if (am != null && !am.canScheduleExactAlarms()) {
        JSObject ret = new JSObject();
        ret.put("scheduled", false);
        ret.put("needsExactAlarmPermission", true);
        call.resolve(ret);
        return;
      }
    }

    CharlieAlarmScheduler.schedule(getContext(), triggerAtMs, requestCode, callerName, reason, callId, audioKey);
    JSObject ret = new JSObject();
    ret.put("scheduled", true);
    ret.put("triggerAtMs", triggerAtMs);
    call.resolve(ret);
  }

  @PluginMethod
  public void cancelAlarm(PluginCall call) {
    int requestCode = call.getInt("requestCode", 77001);
    CharlieAlarmScheduler.cancel(getContext(), requestCode);
    call.resolve();
  }

  @PluginMethod
  public void openExactAlarmSettings(PluginCall call) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
      intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(intent);
    }
    call.resolve();
  }

  @PluginMethod
  public void canScheduleExact(PluginCall call) {
    boolean ok = true;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      android.app.AlarmManager am = getContext().getSystemService(android.app.AlarmManager.class);
      ok = am != null && am.canScheduleExactAlarms();
    }
    JSObject ret = new JSObject();
    ret.put("allowed", ok);
    call.resolve(ret);
  }

  /** Persiste próximo disparo para re-agendar após reboot. */
  @PluginMethod
  public void persistBootSchedule(PluginCall call) {
    boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
    long triggerAtMs = call.getLong("triggerAtMs", 0L);
    android.content.SharedPreferences prefs =
      getContext().getSharedPreferences(CharlieBootReceiver.PREFS, android.content.Context.MODE_PRIVATE);
    prefs
      .edit()
      .putBoolean(CharlieBootReceiver.KEY_ENABLED, enabled)
      .putLong(CharlieBootReceiver.KEY_NEXT_AT, triggerAtMs)
      .putString(CharlieBootReceiver.KEY_CALLER, call.getString("callerName", "Charlie"))
      .putString(CharlieBootReceiver.KEY_REASON, call.getString("reason", "Hora de subir"))
      .putString(CharlieBootReceiver.KEY_AUDIO, call.getString("audioKey", "classico"))
      .putString(CharlieBootReceiver.KEY_CALL_ID, call.getString("callId", "alarm"))
      .apply();
    call.resolve();
  }

  public void emitCallEvent(String event, String callId, String mode) {
    JSObject data = new JSObject();
    data.put("callId", callId);
    data.put("mode", mode);
    notifyListeners(event, data);
  }
}
