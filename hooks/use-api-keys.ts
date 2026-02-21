"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { PROVIDERS, STORAGE_KEYS } from "@/lib/constants"
import type { KeyProvider, Provider } from "@/types/chat"
import type { ImageProviderId } from "@/types/image"

const { LEGACY_IMAGE_PROVIDER_KEYS: LEGACY_IMAGE_PROVIDER_KEYS_STORAGE_KEY } = STORAGE_KEYS

export type ApiKeyMap = {
  openai: string
  claude: string
  groq: string
  gemini: string
  huggingface: string
}

export interface UseApiKeysReturn {
  apiKeys: ApiKeyMap
  currentApiKey: string
  selectedProvider: KeyProvider
  tempApiKey: string
  isApiKeyDialogOpen: boolean
  setSelectedProvider: (p: KeyProvider) => void
  setTempApiKey: (v: string) => void
  setIsApiKeyDialogOpen: (v: boolean) => void
  handleSaveApiKey: () => void
  handleRemoveApiKey: () => void
  handleApiDialogChange: (open: boolean) => void
  handleOpenApiKeyDialog: (p?: KeyProvider) => void
  promptForProviderKey: (providerId: ImageProviderId) => void
  ensureProviderKey: (providerId: ImageProviderId) => boolean
  providerApiKeySet: Record<Provider, boolean>
}

export function useApiKeys(
  provider: Provider,
  setProvider: (p: Provider) => void,
  setError: (e: string | null) => void,
  clearSpeechError: () => void,
): UseApiKeysReturn {
  const [apiKeys, setApiKeys] = useState<ApiKeyMap>(() => ({
    openai: "",
    claude: "",
    groq: "",
    gemini: "",
    huggingface: "",
  }))

  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<KeyProvider>("groq")
  const [tempApiKey, setTempApiKey] = useState("")

  // Load API keys from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return

    const nextKeys: ApiKeyMap = {
      openai: "",
      claude: "",
      groq: "",
      gemini: "",
      huggingface: "",
    }

    try {
      const savedApiKeys = localStorage.getItem("radhika-api-keys")
      if (savedApiKeys) {
        const parsed = JSON.parse(savedApiKeys) as Partial<ApiKeyMap>
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.openai === "string") nextKeys.openai = parsed.openai
          if (typeof parsed.claude === "string") nextKeys.claude = parsed.claude
          if (typeof parsed.groq === "string") nextKeys.groq = parsed.groq
          if (typeof parsed.gemini === "string") nextKeys.gemini = parsed.gemini
          if (typeof parsed.huggingface === "string") nextKeys.huggingface = parsed.huggingface
        }
      }
    } catch (parseError) {
      console.error("Failed to parse saved API keys", parseError)
    }

    // Fallback: read individual provider keys saved from the settings page
    try {
      if (!nextKeys.openai) nextKeys.openai = localStorage.getItem("openai_api_key") || ""
      if (!nextKeys.claude) nextKeys.claude = localStorage.getItem("claude_api_key") || ""
      if (!nextKeys.groq) nextKeys.groq = localStorage.getItem("groq_api_key") || ""
      if (!nextKeys.gemini) nextKeys.gemini = localStorage.getItem("gemini_api_key") || ""
      if (!nextKeys.huggingface) nextKeys.huggingface = localStorage.getItem("huggingface_api_key") || ""
    } catch (fallbackError) {
      console.error("Failed to read legacy API key storage", fallbackError)
    }

    try {
      if (!nextKeys.huggingface) {
        const legacyKeys = localStorage.getItem(LEGACY_IMAGE_PROVIDER_KEYS_STORAGE_KEY)
        if (legacyKeys) {
          const parsedLegacy = JSON.parse(legacyKeys) as Record<string, unknown>
          const legacyHuggingface = parsedLegacy?.huggingface
          if (typeof legacyHuggingface === "string" && legacyHuggingface.trim()) {
            nextKeys.huggingface = legacyHuggingface.trim()
          }
        }
      }
    } catch (parseError) {
      console.error("Failed to parse legacy image provider keys", parseError)
    }

    setApiKeys(nextKeys)
    localStorage.setItem("radhika-api-keys", JSON.stringify(nextKeys))
    localStorage.removeItem(LEGACY_IMAGE_PROVIDER_KEYS_STORAGE_KEY)
  }, [])

  const currentApiKey = useMemo(() => {
    const selectedKey = apiKeys[provider as keyof ApiKeyMap]
    if (selectedKey) return selectedKey
    if (PROVIDERS[provider].requiresApiKey) return ""
    return ""
  }, [provider, apiKeys])

  const handleSaveApiKey = useCallback(() => {
    if (!tempApiKey.trim()) {
      setIsApiKeyDialogOpen(false)
      return
    }

    if (
      selectedProvider !== "openai" &&
      selectedProvider !== "claude" &&
      selectedProvider !== "huggingface" &&
      selectedProvider !== "groq" &&
      selectedProvider !== "gemini"
    ) {
      setIsApiKeyDialogOpen(false)
      return
    }

    const updatedKeys: ApiKeyMap = { ...apiKeys, [selectedProvider]: tempApiKey.trim() }
    setApiKeys(updatedKeys)
    localStorage.setItem("radhika-api-keys", JSON.stringify(updatedKeys))

    if (
      selectedProvider === "openai" ||
      selectedProvider === "claude" ||
      selectedProvider === "groq" ||
      selectedProvider === "gemini"
    ) {
      setProvider(selectedProvider as Provider)
    }
    setError(null)
    clearSpeechError()
    setIsApiKeyDialogOpen(false)
    setTempApiKey("")
  }, [apiKeys, selectedProvider, tempApiKey, clearSpeechError, setProvider, setError])

  const handleRemoveApiKey = useCallback(() => {
    if (
      selectedProvider !== "openai" &&
      selectedProvider !== "claude" &&
      selectedProvider !== "huggingface" &&
      selectedProvider !== "groq" &&
      selectedProvider !== "gemini"
    ) {
      setIsApiKeyDialogOpen(false)
      return
    }

    const updatedKeys: ApiKeyMap = { ...apiKeys, [selectedProvider]: "" }
    setApiKeys(updatedKeys)
    localStorage.setItem("radhika-api-keys", JSON.stringify(updatedKeys))

    if (selectedProvider === provider) {
      setProvider("groq")
    }

    setError(null)
    clearSpeechError()
    setIsApiKeyDialogOpen(false)
    setTempApiKey("")
  }, [apiKeys, selectedProvider, provider, clearSpeechError, setProvider, setError])

  const handleApiDialogChange = useCallback((open: boolean) => {
    setIsApiKeyDialogOpen(open)
    if (!open) setTempApiKey("")
  }, [])

  const handleOpenApiKeyDialog = useCallback(
    (p: KeyProvider = "openai") => {
      setSelectedProvider(p)
      setTempApiKey(apiKeys[p] ?? "")
      setIsApiKeyDialogOpen(true)
      setError(null)
    },
    [apiKeys, setError],
  )

  const promptForProviderKey = useCallback((providerId: ImageProviderId) => {
    if (providerId === "openai") {
      setSelectedProvider("openai")
      setTempApiKey("")
      setIsApiKeyDialogOpen(true)
      return
    }
    if (providerId === "huggingface") {
      setSelectedProvider("huggingface")
      setTempApiKey("")
      setIsApiKeyDialogOpen(true)
    }
  }, [])

  const ensureProviderKey = useCallback(
    (providerId: ImageProviderId) => {
      if (providerId === "pollinations_free" || providerId === "free_alternatives") return true
      if (providerId === "openai") return Boolean(apiKeys.openai)
      if (providerId === "huggingface") return Boolean(apiKeys.huggingface)
      return true
    },
    [apiKeys.openai, apiKeys.huggingface],
  )

  const providerApiKeySet: Record<Provider, boolean> = useMemo(
    () => ({
      groq: true,
      gemini: true,
      openai: Boolean(apiKeys.openai),
      claude: Boolean(apiKeys.claude),
    }),
    [apiKeys.openai, apiKeys.claude],
  )

  return {
    apiKeys,
    currentApiKey,
    selectedProvider,
    tempApiKey,
    isApiKeyDialogOpen,
    setSelectedProvider,
    setTempApiKey,
    setIsApiKeyDialogOpen,
    handleSaveApiKey,
    handleRemoveApiKey,
    handleApiDialogChange,
    handleOpenApiKeyDialog,
    promptForProviderKey,
    ensureProviderKey,
    providerApiKeySet,
  }
}
