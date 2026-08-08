package com.vproject.app.charlie;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public final class CharlieCallNotifier {

  public static final String CHANNEL_ID = "charlie_alarm";
  public static final int NOTIF_ID = 77010;

  private CharlieCallNotifier() {}

  public static void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "Despertador Charlie",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("Despertador / ligação do mentor Charlie");
    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    channel.setBypassDnd(true);
    channel.enableVibration(true);
    NotificationManager nm = context.getSystemService(NotificationManager.class);
    if (nm != null) nm.createNotificationChannel(channel);
  }

  public static void showIncoming(Context context, String caller, String reason, Intent fullScreenIntent) {
    ensureChannel(context);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    PendingIntent fullPi = PendingIntent.getActivity(context, 77011, fullScreenIntent, flags);

      NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.getApplicationInfo().icon)
      .setContentTitle(caller)
      .setContentText(reason)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(true)
      .setSilent(true)
      .setFullScreenIntent(fullPi, true)
      .setContentIntent(fullPi)
      .setTimeoutAfter(120_000);

    try {
      NotificationManagerCompat.from(context).notify(NOTIF_ID, builder.build());
    } catch (SecurityException ignored) {}
  }

  public static void cancel(Context context) {
    NotificationManagerCompat.from(context).cancel(NOTIF_ID);
  }
}
