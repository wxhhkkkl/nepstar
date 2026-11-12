// Mode 31 omits head/leg wear checks; mode 30 keeps its original checks.
const HANDS_ONLY_MODE = 31;

function isHandsOnlyMode(value) {
  return value === HANDS_ONLY_MODE || value === String(HANDS_ONLY_MODE);
}

module.exports = {HANDS_ONLY_MODE, isHandsOnlyMode};
