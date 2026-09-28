package com.iordachemihai21.gymbrofitness.vision

import android.graphics.PixelFormat
import android.media.Image
import android.os.SystemClock
import android.util.Log
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.google.mediapipe.framework.image.MediaImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.mrousavy.camera.core.types.Orientation
import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

/**
 * MediaPipe Pose Landmarker bridge for VisionCamera.
 *
 * Adapted from Google's Apache-2.0 Android sample and the MIT-licensed
 * react-native-mediapipe-pose-plugin (commit 962f9f54e947d56ba83dcec44d0558a36e2f1253).
 * Camera rotation is passed to MediaPipe so JS receives upright coordinates.
 */
@DoNotStrip
@Keep
class PoseLandmarkerFrameProcessorPlugin(
  proxy: VisionCameraProxy,
  @Suppress("UNUSED_PARAMETER") options: Map<String, Any>?,
) : FrameProcessorPlugin() {
  private val context = proxy.context.applicationContext
  private var landmarker: PoseLandmarker? = null
  private var initializationAttempted = false
  private var lastTimestampMs = -1L

  @DoNotStrip
  @Keep
  override fun callback(frame: Frame, arguments: Map<String, Any>?): Any? {
    if (!initializationAttempted) {
      // CPU/XNNPACK is intentionally preferred. On the Galaxy S24 the
      // MediaPipe GPU delegate can stall after EGL initialization while the
      // camera owns another graphics context; Full still runs comfortably at
      // the app's capped analysis rate on this CPU.
      landmarker = createLandmarker(Delegate.CPU)
      initializationAttempted = true
    }

    val activeLandmarker = landmarker
      ?: return mapOf("pose" to emptyList<Map<String, Any>>(), "error" to "model-unavailable")
    val image: Image = try {
      frame.image
    } catch (error: Throwable) {
      Log.w(TAG, "Camera frame is no longer valid", error)
      return null
    }
    if (image.format != PixelFormat.RGBA_8888) {
      Log.e(TAG, "Expected RGBA camera frames; received format=${image.format}")
      return mapOf("pose" to emptyList<Map<String, Any>>(), "error" to "unsupported-frame")
    }

    val rotationDegrees = try {
      when (frame.orientation) {
        Orientation.PORTRAIT -> 0
        Orientation.LANDSCAPE_RIGHT -> 90
        Orientation.PORTRAIT_UPSIDE_DOWN -> 180
        Orientation.LANDSCAPE_LEFT -> 270
      }
    } catch (error: Throwable) {
      Log.w(TAG, "Could not read camera-frame orientation", error)
      return null
    }
    val mpImage = try {
      MediaImageBuilder(image).build()
    } catch (error: Throwable) {
      Log.w(TAG, "Could not create a MediaPipe image", error)
      return null
    }

    var timestampMs = frame.timestamp / 1_000_000L
    if (timestampMs <= lastTimestampMs) timestampMs = lastTimestampMs + 1L
    lastTimestampMs = timestampMs
    val processingOptions = ImageProcessingOptions.builder()
      .setRotationDegrees(rotationDegrees)
      .build()
    val startedAt = SystemClock.elapsedRealtimeNanos()
    val result = try {
      activeLandmarker.detectForVideo(mpImage, processingOptions, timestampMs)
    } catch (error: Throwable) {
      Log.w(TAG, "MediaPipe pose inference failed", error)
      return mapOf("pose" to emptyList<Map<String, Any>>(), "error" to "inference-failed")
    }
    val landmarks = result.landmarks().firstOrNull()
      ?: return mapOf("pose" to emptyList<Map<String, Any>>(), "inferenceMs" to elapsedMs(startedAt))
    val pose = landmarks.map { landmark ->
      val point = HashMap<String, Any>(4)
      point["x"] = landmark.x().toDouble()
      point["y"] = landmark.y().toDouble()
      point["z"] = landmark.z().toDouble()
      landmark.visibility().ifPresent { point["visibility"] = it.toDouble() }
      point
    }
    return mapOf("pose" to pose, "inferenceMs" to elapsedMs(startedAt))
  }

  private fun createLandmarker(delegate: Delegate): PoseLandmarker? = try {
    val baseOptions = BaseOptions.builder()
      .setModelAssetPath(MODEL_ASSET)
      .setDelegate(delegate)
      .build()
    val options = PoseLandmarker.PoseLandmarkerOptions.builder()
      .setBaseOptions(baseOptions)
      .setRunningMode(RunningMode.VIDEO)
      .setNumPoses(1)
      .setMinPoseDetectionConfidence(0.5f)
      .setMinPosePresenceConfidence(0.5f)
      .setMinTrackingConfidence(0.5f)
      .build()
    PoseLandmarker.createFromOptions(context, options).also {
      Log.i(TAG, "MediaPipe Pose Landmarker initialized with $delegate")
    }
  } catch (error: Throwable) {
    Log.w(TAG, "MediaPipe initialization failed with $delegate", error)
    null
  }

  private fun elapsedMs(startedAt: Long): Double =
    (SystemClock.elapsedRealtimeNanos() - startedAt) / 1_000_000.0

  companion object {
    private const val TAG = "GymBroPoseLandmarker"
    private const val MODEL_ASSET = "pose_landmarker_full.task"
  }
}
