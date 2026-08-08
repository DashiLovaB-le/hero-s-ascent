package com.vproject.app.charlie;

import android.app.Activity;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import com.vproject.app.R;

/**
 * Tela full-screen de “ligação” do Charlie (MVP).
 * Atender → deep link ritual; Recusar → dismiss.
 */
public class CharlieCallActivity extends Activity {

  public static final String EXTRA_CALLER = "callerName";
  public static final String EXTRA_REASON = "reason";
  public static final String EXTRA_MODE = "mode";
  public static final String EXTRA_CALL_ID = "callId";
  public static final String EXTRA_AUDIO_KEY = "audioKey";

  private String callId = "";
  private String mode = "alarm";
  private String audioKey = "classico";
  private Vibrator vibrator;

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    getWindow().addFlags(
      WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
        | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
    );
    setContentView(R.layout.activity_charlie_call);

    String caller = getIntent().getStringExtra(EXTRA_CALLER);
    String reason = getIntent().getStringExtra(EXTRA_REASON);
    mode = safe(getIntent().getStringExtra(EXTRA_MODE), "alarm");
    callId = safe(getIntent().getStringExtra(EXTRA_CALL_ID), String.valueOf(System.currentTimeMillis()));
    audioKey = safe(getIntent().getStringExtra(EXTRA_AUDIO_KEY), "classico");

    TextView nameView = findViewById(R.id.charlie_call_name);
    TextView reasonView = findViewById(R.id.charlie_call_reason);
    nameView.setText(safe(caller, "Charlie"));
    reasonView.setText(safe(reason, "Hora de subir"));

    Button answer = findViewById(R.id.charlie_call_answer);
    Button decline = findViewById(R.id.charlie_call_decline);

    answer.setOnClickListener((View v) -> onAnswer());
    decline.setOnClickListener((View v) -> onDecline());

    vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
    if (vibrator != null) {
      try {
        vibrator.vibrate(VibrationEffect.createWaveform(new long[] { 0, 500, 400, 500, 400, 500 }, 0));
      } catch (Exception ignored) {}
    }

    CharlieCallNotifier.cancel(this);
  }

  private void onAnswer() {
    stopVibrate();
    if (CharlieCallPlugin.instance != null) {
      CharlieCallPlugin.instance.emitCallEvent("callAnswered", callId, mode);
    }
    // Deep link → WebView ritual
    android.net.Uri uri = android.net.Uri.parse(
      "https://v-project-rho.vercel.app/alarm/ritual?callId="
        + android.net.Uri.encode(callId)
        + "&audioKey="
        + android.net.Uri.encode(audioKey)
        + "&mode="
        + android.net.Uri.encode(mode)
    );
    android.content.Intent i = new android.content.Intent(android.content.Intent.ACTION_VIEW, uri);
    i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
    // Prefer bring MainActivity to front with path
    android.content.Intent main = new android.content.Intent(this, com.vproject.app.MainActivity.class);
    main.addFlags(android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP);
    main.putExtra("charlie_alarm_ritual", true);
    main.putExtra("callId", callId);
    main.putExtra("audioKey", audioKey);
    main.putExtra("mode", mode);
    startActivity(main);
    finish();
  }

  private void onDecline() {
    stopVibrate();
    if (CharlieCallPlugin.instance != null) {
      CharlieCallPlugin.instance.emitCallEvent("callDeclined", callId, mode);
    }
    finish();
  }

  private void stopVibrate() {
    if (vibrator != null) {
      try {
        vibrator.cancel();
      } catch (Exception ignored) {}
    }
  }

  @Override
  protected void onDestroy() {
    stopVibrate();
    super.onDestroy();
  }

  private static String safe(String v, String fallback) {
    return v == null || v.isEmpty() ? fallback : v;
  }
}
