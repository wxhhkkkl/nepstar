import {QRInfo} from '../../../Cloud/CloudManager';
import {isHandsOnlyMode} from './DetectionModePolicy';

// Always read the real server-supplied mode. No local selection or override.
export const detectionMode = {
  isHandsOnly: () => isHandsOnlyMode(QRInfo.handleMode),
};
