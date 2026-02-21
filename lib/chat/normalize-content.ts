/**
 * Normalize message content for storage.
 * Converts arrays, objects, and other types to a plain string.
 */
export function normalizeContentForStorage(content: any): string {
  if (typeof content === "string") return content

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object") {
          const partObj = part as any
          // Handle image content - convert to markdown
          if (partObj.type === "image" && partObj.image) {
            const imageUrl =
              typeof partObj.image === "string" ? partObj.image : partObj.image.url
            return `![${partObj.alt || "Image"}](${imageUrl})`
          }
          // Handle text content
          if (typeof partObj.text === "string") return partObj.text
          if (typeof partObj.value === "string") return partObj.value
        }
        return ""
      })
      .join("\n\n")
  }

  if (content && typeof content === "object") {
    if (typeof (content as any).text === "string") return (content as any).text
    try {
      return JSON.stringify(content)
    } catch {
      return String(content)
    }
  }

  return content == null ? "" : String(content)
}
