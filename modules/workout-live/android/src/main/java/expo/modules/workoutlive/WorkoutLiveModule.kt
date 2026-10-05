package expo.modules.workoutlive

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.os.bundleOf
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class LiveAction : Record {
  @Field val id: String = ""
  @Field val title: String = ""
}

class LiveContent : Record {
  @Field val title: String = ""
  @Field val text: String = ""
  @Field val subText: String? = null
  /** Epoch ms when the rest ends; shows a live countdown. */
  @Field val restEndsAt: Double? = null
  /** Epoch ms the workout started; shows elapsed time when not resting. */
  @Field val startedAt: Double? = null
  @Field val progress: Int? = null
  @Field val progressMax: Int? = null
  @Field val color: String? = null
  @Field val actions: List<LiveAction> = emptyList()
}

/**
 * The ongoing "workout in progress" notification: what is next, a live rest
 * countdown (or elapsed time) and buttons to log the set or adjust rest from
 * the lock screen. Buttons come back to JavaScript as `onAction` events while
 * the app process is alive; tapping the notification opens the app.
 */
class WorkoutLiveModule : Module() {
  companion object {
    private const val CHANNEL_ID = "workout-live"
    private const val NOTIFICATION_ID = 7341
    private const val ACTION_INTENT = "expo.modules.workoutlive.ACTION"
    private const val EXTRA_ACTION = "action"
    private const val MAX_LIFETIME_MS = 4L * 60 * 60 * 1000
  }

  private var receiver: BroadcastReceiver? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("WorkoutLive")

    Events("onAction")

    OnCreate {
      val actionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
          val action = intent.getStringExtra(EXTRA_ACTION) ?: return
          sendEvent("onAction", bundleOf("action" to action))
        }
      }
      ContextCompat.registerReceiver(
        context,
        actionReceiver,
        IntentFilter(ACTION_INTENT),
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
      receiver = actionReceiver
    }

    OnDestroy {
      receiver?.let { runCatching { context.unregisterReceiver(it) } }
      receiver = null
    }

    /** Posts or updates the notification. Returns false when notifications are not allowed. */
    Function("show") { content: LiveContent ->
      show(content)
    }

    Function("hide") {
      NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Workout in progress",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Next set, rest countdown and quick logging while you train."
      setShowBadge(false)
      lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
    }
    manager.createNotificationChannel(channel)
  }

  private fun canPost(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }
    return NotificationManagerCompat.from(context).areNotificationsEnabled()
  }

  // Permission is checked in canPost(); lint cannot see through the helper.
  @SuppressLint("MissingPermission")
  private fun show(content: LiveContent): Boolean {
    if (!canPost()) return false
    ensureChannel()

    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
    }
    val contentIntent = launch?.let {
      PendingIntent.getActivity(
        context,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_workout_live)
      .setContentTitle(content.title)
      .setContentText(content.text)
      .setSubText(content.subText)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_PROGRESS)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setTimeoutAfter(MAX_LIFETIME_MS)
      .setContentIntent(contentIntent)

    content.color?.let { runCatching { builder.setColor(Color.parseColor(it)) } }

    val now = System.currentTimeMillis()
    val restEndsAt = content.restEndsAt?.toLong()
    val startedAt = content.startedAt?.toLong()
    if (restEndsAt != null && restEndsAt > now) {
      builder.setWhen(restEndsAt).setShowWhen(true).setUsesChronometer(true)
        .setChronometerCountDown(true)
    } else if (startedAt != null) {
      builder.setWhen(startedAt).setShowWhen(true).setUsesChronometer(true)
    } else {
      builder.setShowWhen(false)
    }

    val max = content.progressMax
    val progress = content.progress
    if (max != null && max > 0 && progress != null) {
      builder.setProgress(max, progress.coerceIn(0, max), false)
    }

    content.actions.take(3).forEachIndexed { index, action ->
      val intent = Intent(ACTION_INTENT).apply {
        setPackage(context.packageName)
        putExtra(EXTRA_ACTION, action.id)
      }
      val pending = PendingIntent.getBroadcast(
        context,
        index + 1,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      builder.addAction(0, action.title, pending)
    }

    NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build())
    return true
  }
}
