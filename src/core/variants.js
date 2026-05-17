export const VARIANTS = {
  russian: {
    key: "russian",
    label: "Russian 8x8",
    boardSize: 8,
    startingRows: 3,
    menMoveDirections: [-1],
    menCaptureDirections: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    kingsAreFlying: true,
    kingsMoveRange: "long",
    kingsCaptureRange: "long",
    capturesAreMandatory: true,
    requireMaxCapture: false,
    menCaptureBackward: true,
    stopAfterPromotionOnCapture: false,
    continueAsKingAfterPromotionCapture: true,
  },
  international: {
    key: "international",
    label: "International 10x10",
    boardSize: 10,
    startingRows: 4,
    menMoveDirections: [-1],
    menCaptureDirections: [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ],
    kingsAreFlying: true,
    kingsMoveRange: "long",
    kingsCaptureRange: "long",
    capturesAreMandatory: true,
    requireMaxCapture: true,
    menCaptureBackward: true,
    stopAfterPromotionOnCapture: false,
    continueAsKingAfterPromotionCapture: false,
  },
  english: {
    key: "english",
    label: "English 8x8",
    boardSize: 8,
    startingRows: 3,
    menMoveDirections: [-1],
    menCaptureDirections: [
      [-1, -1],
      [-1, 1],
    ],
    kingsAreFlying: false,
    kingsMoveRange: "short",
    kingsCaptureRange: "short",
    capturesAreMandatory: true,
    requireMaxCapture: false,
    menCaptureBackward: false,
    stopAfterPromotionOnCapture: true,
    continueAsKingAfterPromotionCapture: false,
  },
};

export function getVariantConfig(variantKey) {
  return VARIANTS[variantKey] ?? VARIANTS.russian;
}

export function listVariants() {
  return Object.values(VARIANTS);
}
