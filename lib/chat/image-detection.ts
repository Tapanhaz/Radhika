/**
 * Detect whether user input intends to generate an image.
 */

// Direct action keywords - must be explicit about image generation
const ACTION_KEYWORDS = [
  "generate image",
  "create image",
  "make image",
  "generate an image",
  "create an image",
  "make an image",
  "draw an image",
  "draw a picture",
  "draw me",
  "generate picture",
  "create picture",
  "make picture",
  "generate a picture",
  "create a picture",
  "make a picture",
  "generate photo",
  "create photo",
  "make photo",
  "generate a photo",
  "create a photo",
  "make a photo",
  "show me an image",
  "show me a picture",
  "show me a photo",
  "design an image",
  "produce an image",
  "render an image",
  "paint a picture",
  "paint an image",
  "sketch a picture",
  "sketch an image",
  "illustrate this",
  "visualize this",
] as const

// Descriptive patterns that indicate image generation intent
const DESCRIPTIVE_PATTERNS = [
  /^image of (a|an|the)/i,
  /^picture of (a|an|the)/i,
  /^photo of (a|an|the)/i,
  /\[image:/i,
  /^(draw|paint|sketch|illustrate|visualize)\s+(a|an|the|me)\s/i,
  /(generate|create|make)\s+(a|an|the)?\s*(image|picture|photo|artwork|illustration)\s+(of|showing|depicting)/i,
] as const

/**
 * Returns `true` if the prompt text indicates the user wants to generate an image.
 */
export function detectImageIntent(promptText: string): boolean {
  const lower = promptText.toLowerCase()
  const hasActionKeyword = ACTION_KEYWORDS.some((kw) => lower.includes(kw))
  const hasDescriptivePattern = DESCRIPTIVE_PATTERNS.some((p) => p.test(promptText))
  return hasActionKeyword || hasDescriptivePattern
}
