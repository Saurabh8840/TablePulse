// Device-level preferences shared across boards (localStorage).
// Chime default powers the KDS bell; haptics drives navigator.vibrate alerts.

const CHIME_KEY = 'tablepulse-kds-chime';
const HAPTICS_KEY = 'tablepulse-haptics';
const SOUNDBOX_LANG_KEY = 'tablepulse-soundbox-lang';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore — prefs still work for the session via state
  }
}

export const getChime = () => read(CHIME_KEY, 'on') === 'on';
export const setChimePref = (on) => write(CHIME_KEY, on ? 'on' : 'off');

export const getHaptics = () => read(HAPTICS_KEY, 'on') === 'on';
export const setHapticsPref = (on) => write(HAPTICS_KEY, on ? 'on' : 'off');

export const getSoundboxLang = () => read(SOUNDBOX_LANG_KEY, 'English + Hindi');
export const setSoundboxLangPref = (v) => write(SOUNDBOX_LANG_KEY, v);

export const SOUNDBOX_LANGS = ['English + Hindi', 'English only', 'Kannada', 'Hindi only'];

/** Vibrate only when the user left haptics on and the device supports it. */
export function buzz(pattern = 200) {
  try {
    if (getHaptics() && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    // ignore
  }
}
