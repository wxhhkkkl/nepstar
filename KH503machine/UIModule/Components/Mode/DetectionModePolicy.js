// Mode 30 retains its existing business flow and omits head/leg wear checks.
const HANDS_ONLY_MODE = 30;

function isHandsOnlyMode(value) {
  return value === HANDS_ONLY_MODE || value === String(HANDS_ONLY_MODE);
}

module.exports = {HANDS_ONLY_MODE, isHandsOnlyMode};
