const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEPENDENCY = 'implementation("com.google.mediapipe:tasks-vision:0.10.29")';
const PLUGIN_IMPORT =
  'import com.iordachemihai21.gymbrofitness.vision.PoseLandmarkerFrameProcessorPlugin';
const REGISTRY_IMPORT = 'import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry';

function withMediaPipePose(config) {
  config = withAppBuildGradle(config, (gradleConfig) => {
    let source = gradleConfig.modResults.contents;
    if (!source.includes(DEPENDENCY)) {
      source = source.replace(/dependencies\s*\{/, `dependencies {\n    ${DEPENDENCY}`);
    }
    if (!source.includes('noCompress += "task"')) {
      source = source.replace(
        /androidResources\s*\{/,
        'androidResources {\n        noCompress += "task"',
      );
    }
    gradleConfig.modResults.contents = source;
    return gradleConfig;
  });

  config = withMainApplication(config, (mainConfig) => {
    let source = mainConfig.modResults.contents;
    if (!source.includes(PLUGIN_IMPORT)) {
      source = source.replace(
        'import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint',
        `import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint\n${PLUGIN_IMPORT}\n${REGISTRY_IMPORT}`,
      );
    }
    if (!source.includes('addFrameProcessorPlugin("poseLandmarker")')) {
      source = source.replace(
        /class MainApplication\s*:\s*Application\(\),\s*ReactApplication\s*\{/,
        `class MainApplication : Application(), ReactApplication {\n\n  companion object {\n    init {\n      FrameProcessorPluginRegistry.addFrameProcessorPlugin("poseLandmarker") { proxy, options ->\n        PoseLandmarkerFrameProcessorPlugin(proxy, options)\n      }\n    }\n  }`,
      );
    }
    mainConfig.modResults.contents = source;
    return mainConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (dangerousConfig) => {
      const root = dangerousConfig.modRequest.projectRoot;
      const kotlinTarget = path.join(
        root,
        'android/app/src/main/java/com/iordachemihai21/gymbrofitness/vision/PoseLandmarkerFrameProcessorPlugin.kt',
      );
      const modelTarget = path.join(root, 'android/app/src/main/assets/pose_landmarker_full.task');
      await fs.mkdir(path.dirname(kotlinTarget), { recursive: true });
      await fs.mkdir(path.dirname(modelTarget), { recursive: true });
      await fs.copyFile(
        path.join(root, 'plugins/mediapipe/PoseLandmarkerFrameProcessorPlugin.kt'),
        kotlinTarget,
      );
      await fs.copyFile(path.join(root, 'assets/models/pose_landmarker_full.task'), modelTarget);
      return dangerousConfig;
    },
  ]);
}

module.exports = withMediaPipePose;
