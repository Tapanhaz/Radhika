"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MODES, STORAGE_KEYS, createDefaultImageSettings, sanitizeImageSettings } from "@/lib/constants"
import { IMAGE_PROVIDERS } from "@/lib/image-providers"
import { localChatStorage } from "@/lib/services/local-chat-storage"
import { detectImageIntent } from "@/lib/chat/image-detection"
import type { Mode } from "@/types/chat"
import type { ImageProviderId, ImageSettings } from "@/types/image"

const { IMAGE_SETTINGS: IMAGE_SETTINGS_STORAGE_KEY } = STORAGE_KEYS

export interface UseImageGenerationReturn {
  imageGenerationEnabled: boolean
  isImageSettingsDialogOpen: boolean
  imageSettings: ImageSettings
  isGeneratingImage: boolean
  isGeneratingImageRef: React.MutableRefObject<boolean>
  imageAbortControllerRef: React.MutableRefObject<AbortController | null>
  imageSettingsLabel: string
  setIsImageSettingsDialogOpen: (v: boolean) => void
  handleToggleImageGeneration: (enabled: boolean) => void
  handleOpenImageGenerationSettings: () => void
  handleImageSettingsSave: (settings: ImageSettings) => void
  handleImageRetry: (messageId: string) => void
  generateImage: (opts: {
    promptText: string
    placeholderId: string
    setMessages: (fn: (prev: any[]) => any[]) => void
    persistenceEnabledRef: React.MutableRefObject<boolean>
    currentChatRef: React.MutableRefObject<any>
    persistedMessageIdsRef: React.MutableRefObject<Set<string>>
  }) => Promise<void>
  stopImageGeneration: () => void
  detectImageIntent: (prompt: string) => boolean
}

export function useImageGeneration(
  mode: Mode,
  apiKeys: { openai: string; huggingface: string },
  ensureProviderKey: (id: ImageProviderId) => boolean,
  promptForProviderKey: (id: ImageProviderId) => void,
  setMessages: (fn: any) => void,
): UseImageGenerationReturn {
  const [imageGenerationEnabled, setImageGenerationEnabled] = useState(false)
  const [isImageSettingsDialogOpen, setIsImageSettingsDialogOpen] = useState(false)
  const [imageSettings, setImageSettings] = useState<ImageSettings>(() => createDefaultImageSettings())
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const isGeneratingImageRef = useRef(false)
  const imageAbortControllerRef = useRef<AbortController | null>(null)

  // Load saved image settings
  useEffect(() => {
    if (typeof window === "undefined") return
    const savedSettings = localStorage.getItem(IMAGE_SETTINGS_STORAGE_KEY)
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings) as { enabled?: boolean; settings?: Partial<ImageSettings> }
        if (typeof parsed.enabled === "boolean") setImageGenerationEnabled(parsed.enabled)
        if (parsed.settings) setImageSettings(sanitizeImageSettings(parsed.settings))
      } catch (parseError) {
        console.error("Failed to parse saved image settings", parseError)
      }
    }
  }, [])

  // Persist image settings
  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(
      IMAGE_SETTINGS_STORAGE_KEY,
      JSON.stringify({ enabled: imageGenerationEnabled, settings: imageSettings }),
    )
  }, [imageGenerationEnabled, imageSettings])

  const imageSettingsLabel = (() => {
    const providerMeta = IMAGE_PROVIDERS[imageSettings.provider]
    const desiredModel = imageSettings.model || providerMeta.defaultModel
    const modelLabel = providerMeta.models?.find((m) => m.id === desiredModel)?.label
    return modelLabel ? `${providerMeta.name} · ${modelLabel}` : providerMeta.name
  })()

  const handleToggleImageGeneration = useCallback(
    (enabled: boolean) => {
      if (enabled && !ensureProviderKey(imageSettings.provider)) {
        promptForProviderKey(imageSettings.provider)
        return
      }
      setImageGenerationEnabled(enabled)
    },
    [ensureProviderKey, imageSettings.provider, promptForProviderKey],
  )

  const handleOpenImageGenerationSettings = useCallback(() => {
    if (!ensureProviderKey(imageSettings.provider)) {
      promptForProviderKey(imageSettings.provider)
      return
    }
    setIsImageSettingsDialogOpen(true)
  }, [ensureProviderKey, imageSettings.provider, promptForProviderKey])

  const handleImageSettingsSave = useCallback((updatedSettings: ImageSettings) => {
    setImageSettings({
      ...updatedSettings,
      customPrompt: updatedSettings.customPrompt.trim(),
      customStyle: updatedSettings.customStyle?.trim() ?? "",
    })
    setIsImageSettingsDialogOpen(false)
  }, [])

  const stopImageGeneration = useCallback(() => {
    if (!isGeneratingImageRef.current) return
    console.log("⛔ Stopping image generation...")
    imageAbortControllerRef.current?.abort()
    imageAbortControllerRef.current = null
    isGeneratingImageRef.current = false
    setIsGeneratingImage(false)
  }, [])

  /**
   * Core image generation logic. Extracted from the composer submit handler.
   */
  const generateImage = useCallback(
    async ({
      promptText,
      placeholderId,
      setMessages: setMsgs,
      persistenceEnabledRef,
      currentChatRef,
      persistedMessageIdsRef,
    }: {
      promptText: string
      placeholderId: string
      setMessages: (fn: (prev: any[]) => any[]) => void
      persistenceEnabledRef: React.MutableRefObject<boolean>
      currentChatRef: React.MutableRefObject<any>
      persistedMessageIdsRef: React.MutableRefObject<Set<string>>
    }) => {
      const providerMeta = IMAGE_PROVIDERS[imageSettings.provider]
      const providerKey =
        imageSettings.provider === "openai"
          ? apiKeys.openai
          : imageSettings.provider === "huggingface"
            ? apiKeys.huggingface
            : ""

      isGeneratingImageRef.current = true
      setIsGeneratingImage(true)

      setMsgs((prev) => [
        ...prev,
        { id: placeholderId, role: "assistant", content: "_Generating image..._" },
      ])

      if (providerMeta.requiresKey && !providerKey) {
        if (imageSettings.provider === "openai" || imageSettings.provider === "huggingface") {
          promptForProviderKey(imageSettings.provider)
        }
        setMsgs((prev) =>
          prev.map((m: any) =>
            m.id === placeholderId
              ? { ...m, content: `Image generation requires an API key for ${providerMeta.name}. Update Image Settings to continue.` }
              : m,
          ),
        )
        isGeneratingImageRef.current = false
        setIsGeneratingImage(false)
        return
      }

      const chosenModel = imageSettings.model || providerMeta.defaultModel || providerMeta.models?.[0]?.id
      const promptTemplate = imageSettings.customPrompt.trim()
      let promptPayload = promptText
      if (promptTemplate) {
        promptPayload = promptTemplate.includes("{input}")
          ? promptTemplate.split("{input}").join(promptText)
          : `${promptTemplate}. ${promptText}`
      }

      const customStyle = (imageSettings.customStyle ?? "").trim()

      const requestBody: Record<string, unknown> = {
        provider: imageSettings.provider,
        prompt: promptPayload,
        content: promptText,
        title: MODES[mode].label,
        size: imageSettings.size,
        model: chosenModel,
        style: imageSettings.style,
      }
      if (imageSettings.size === "custom") {
        requestBody.customWidth = imageSettings.customWidth
        requestBody.customHeight = imageSettings.customHeight
      }
      if (imageSettings.style === "custom" && customStyle) {
        requestBody.customStyle = customStyle
      }
      if (providerKey) requestBody.apiKey = providerKey

      try {
        imageAbortControllerRef.current?.abort()
        const abortController = new AbortController()
        imageAbortControllerRef.current = abortController

        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify(requestBody),
        })

        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data?.success) throw new Error(data?.error || "Image generation failed")

        const markdown = `![Generated image](${data.imageUrl})\n\n*${data.provider} · ${data.model} · ${data.size}*\n\n**Prompt:** ${data.prompt}`

        setMsgs((prev) =>
          prev.map((m: any) => (m.id === placeholderId ? { ...m, content: markdown } : m)),
        )

        // Persist image message
        const enabled = persistenceEnabledRef.current
        const chatToUse = currentChatRef.current
        if (enabled && chatToUse && placeholderId) {
          const chatId = chatToUse.localId || chatToUse.id
          try {
            localChatStorage.addMessage(chatId, "assistant", markdown, undefined, placeholderId)
            persistedMessageIdsRef.current.add(placeholderId)
            console.log("✅ Image message persisted to localStorage")
          } catch (err) {
            console.error("❌ Failed to persist image message:", err)
          }
        }
      } catch (error) {
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && /abort/i.test(error.message))
        const message = error instanceof Error ? error.message : "Image generation failed"
        setMsgs((prev) =>
          prev.map((e: any) =>
            e.id === placeholderId
              ? isAbort
                ? { ...e, content: "_Image generation cancelled._" }
                : { ...e, content: `Image generation failed: ${message}` }
              : e,
          ),
        )
      } finally {
        imageAbortControllerRef.current = null
        isGeneratingImageRef.current = false
        setIsGeneratingImage(false)
      }
    },
    [apiKeys.openai, apiKeys.huggingface, imageSettings, mode, promptForProviderKey],
  )

  const handleImageRetry = useCallback(
    (messageId: string) => {
      console.log("Retrying image generation for message:", messageId)
      setMessages((prev: any) => {
        const messageIndex = prev.findIndex((msg: any) => msg.id === messageId)
        if (messageIndex === -1) return prev

        const message = prev[messageIndex]
        const promptMatch = message.content.match(/\*\*Prompt:\*\*\s*(.+)$/)
        const prompt = promptMatch ? promptMatch[1].trim() : ""
        if (!prompt) {
          console.error("Could not extract prompt from message")
          return prev
        }

        const updatedMessages = [...prev]
        updatedMessages[messageIndex] = { ...message, content: "_Regenerating image..._" }

        setTimeout(() => {
          void (async () => {
            setIsGeneratingImage(true)
            const providerMeta = IMAGE_PROVIDERS[imageSettings.provider]
            const providerKey =
              imageSettings.provider === "openai"
                ? apiKeys.openai
                : imageSettings.provider === "huggingface"
                  ? apiKeys.huggingface
                  : ""

            const chosenModel = imageSettings.model || providerMeta.defaultModel || providerMeta.models?.[0]?.id
            const customStyle = (imageSettings.customStyle ?? "").trim()

            const requestBody: Record<string, unknown> = {
              provider: imageSettings.provider,
              prompt,
              content: prompt,
              title: MODES[mode].label,
              size: imageSettings.size,
              model: chosenModel,
              style: imageSettings.style,
            }
            if (imageSettings.size === "custom") {
              requestBody.customWidth = imageSettings.customWidth
              requestBody.customHeight = imageSettings.customHeight
            }
            if (imageSettings.style === "custom" && customStyle) requestBody.customStyle = customStyle
            if (providerKey) requestBody.apiKey = providerKey

            try {
              imageAbortControllerRef.current?.abort()
              const abortController = new AbortController()
              imageAbortControllerRef.current = abortController

              const response = await fetch("/api/image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: abortController.signal,
                body: JSON.stringify(requestBody),
              })
              const data = await response.json().catch(() => ({}))
              if (!response.ok || !data?.success) throw new Error(data?.error || "Image generation failed")

              const markdown = `![Generated image](${data.imageUrl})\n\n*${data.provider} · ${data.model} · ${data.size}*\n\n**Prompt:** ${data.prompt}`
              setMessages((current: any) =>
                current.map((msg: any) => (msg.id === messageId ? { ...msg, content: markdown } : msg)),
              )
            } catch (error) {
              const isAbort =
                (error instanceof DOMException && error.name === "AbortError") ||
                (error instanceof Error && /abort/i.test(error.message))
              const errorMessage = error instanceof Error ? error.message : "Image generation failed"
              setMessages((current: any) =>
                current.map((msg: any) =>
                  msg.id === messageId
                    ? { ...msg, content: isAbort ? "_Image generation cancelled._" : `Image generation failed: ${errorMessage}` }
                    : msg,
                ),
              )
            } finally {
              imageAbortControllerRef.current = null
              setIsGeneratingImage(false)
            }
          })()
        }, 100)

        return updatedMessages
      })
    },
    [apiKeys.openai, apiKeys.huggingface, imageSettings, mode, setMessages],
  )

  return {
    imageGenerationEnabled,
    isImageSettingsDialogOpen,
    imageSettings,
    isGeneratingImage,
    isGeneratingImageRef,
    imageAbortControllerRef,
    imageSettingsLabel,
    setIsImageSettingsDialogOpen,
    handleToggleImageGeneration,
    handleOpenImageGenerationSettings,
    handleImageSettingsSave,
    handleImageRetry,
    generateImage,
    stopImageGeneration,
    detectImageIntent,
  }
}
