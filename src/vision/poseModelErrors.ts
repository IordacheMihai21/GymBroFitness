export function describePoseModelError(error: Error, development = __DEV__): string {
  const message = `${error.name} ${error.message}`.toLowerCase();

  if (
    message.includes('network') ||
    message.includes('connect') ||
    message.includes('timeout') ||
    message.includes('resolve host') ||
    message.includes('http')
  ) {
    return development
      ? 'The model could not reach the development server. Keep this device connected to Metro, then try again.'
      : 'The on-device model file could not be opened. Try again; if it still fails, update the app.';
  }

  if (
    message.includes('nitro') ||
    message.includes('native module') ||
    message.includes('tflitemodule')
  ) {
    return 'This build does not include the Form AI native module. Install the latest native build.';
  }

  return 'Form AI could not start on this device. Try again; your workout data is unaffected.';
}
