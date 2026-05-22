// Module-level flag — survives screen unmounts but resets when the app process restarts.
let _shownThisSession = false;

export function hasShownSurveyThisSession() {
  return _shownThisSession;
}

export function markSurveyShownThisSession() {
  _shownThisSession = true;
}
