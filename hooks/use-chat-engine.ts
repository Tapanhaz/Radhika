"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { ChangeEvent, FormEvent } from "react"
import type { Mode, Provider, UserPersonalization } from "@/types/chat"

export interface UseChatEngineReturn {
  messages: any[]
  setMessages: (fn: any) => void
  input: string
  isLoading: boolean
  isChatLoading: boolean
  isChatLoadingRef: React.MutableRefObject<boolean>
  chatAbortControllerRef: React.MutableRefObject<AbortController | null>
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  setInput: (v: string) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>
  sendChatMessage: (userMessage: any) => Promise<void>
  stopStreaming: () => void
  handleComposerSubmitRef: React.MutableRefObject<((event: FormEvent<HTMLFormElement>) => Promise<void>) | null>
}

export function useChatEngine(opts: {
  mode: Mode
  provider: Provider
  currentApiKey: string
  userPersonalization: UserPersonalization
  speakMessage: (content: string, id?: string, mode?: Mode) => void
  voiceEnabledRef: React.MutableRefObject<boolean>
  sourcesEnabled: boolean
  sourcesType: "any" | "wikipedia" | "documentation"
}): UseChatEngineReturn {
  const { mode, provider, currentApiKey, userPersonalization, speakMessage, voiceEnabledRef, sourcesEnabled, sourcesType } = opts

  const [messages, setMessages] = useState<any[]>([])
  const [localInput, setLocalInput] = useState("")
  const [isChatLoading, setIsChatLoading] = useState(false)

  const chatAbortControllerRef = useRef<AbortController | null>(null)
  const isChatLoadingRef = useRef(false)
  const handleComposerSubmitRef = useRef<((event: FormEvent<HTMLFormElement>) => Promise<void>) | null>(null)

  useEffect(() => {
    isChatLoadingRef.current = isChatLoading
  }, [isChatLoading])

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setLocalInput(e.target.value)
  }, [])

  const setInput = useCallback((value: string) => {
    setLocalInput(value)
  }, [])

  const stopStreaming = useCallback(() => {
    if (!isChatLoadingRef.current) return
    console.log("⛔ Stop requested by user")
    chatAbortControllerRef.current?.abort()
    chatAbortControllerRef.current = null
    setIsChatLoading(false)
  }, [])

  /**
   * Send a chat message to the API and stream the response.
   */
  const sendChatMessage = useCallback(
    async (userMessage: any) => {
      if (isChatLoading) {
        console.log("Already loading, skipping duplicate request")
        return
      }

      setIsChatLoading(true)
      chatAbortControllerRef.current?.abort()
      const abortController = new AbortController()
      chatAbortControllerRef.current = abortController

      // Snapshot current messages
      let currentMessages: any[] = []
      setMessages((prev: any) => {
        currentMessages = [...prev]
        return prev
      })

      if (
        currentMessages.length === 0 ||
        currentMessages[currentMessages.length - 1].id !== userMessage.id
      ) {
        currentMessages = [...currentMessages, userMessage]
      }

      const assistantMessageId = `assistant-${Date.now()}`
      let accumulatedContent = ""

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortController.signal,
          body: JSON.stringify({
            messages: currentMessages,
            mode,
            provider,
            userGender: userPersonalization.gender,
            userAge: userPersonalization.age,
            conversationTone: mode === "bff" ? undefined : userPersonalization.tone,
            ...(currentApiKey ? { apiKey: currentApiKey } : {}),
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `Failed to get response: ${response.status}`)
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) throw new Error("No response stream available")

        // Add empty assistant message placeholder
        setMessages((prev: any) => [
          ...prev,
          { id: assistantMessageId, role: "assistant" as const, content: "" },
        ])

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) {
              console.log("✅ Stream complete, total content length:", accumulatedContent.length)
              break
            }
            const chunk = decoder.decode(value, { stream: true })
            if (chunk) {
              accumulatedContent += chunk
              setMessages((prev: any) =>
                prev.map((msg: any) =>
                  msg.id === assistantMessageId ? { ...msg, content: accumulatedContent } : msg,
                ),
              )
            }
          }
        } catch (streamError) {
          console.error("❌ Stream error:", streamError)
          try { await reader.cancel() } catch { /* ignore */ }
          setMessages((prev: any) => prev.filter((msg: any) => msg.id !== assistantMessageId))
          throw streamError
        }

        if (!accumulatedContent || accumulatedContent.trim() === "") {
          setMessages((prev: any) => prev.filter((msg: any) => msg.id !== assistantMessageId))
          throw new Error("No response received from AI")
        }

        // Extract sources if enabled
        if (sourcesEnabled) {
          const { extractSourcesFromContent, addExampleSources, filterSourcesByType } = await import(
            "@/lib/chat/extract-sources"
          )
          let extractedSources = extractSourcesFromContent(accumulatedContent)
          if (extractedSources.length === 0) extractedSources = addExampleSources(accumulatedContent)
          if (sourcesType !== "any") extractedSources = filterSourcesByType(extractedSources, sourcesType)
          if (extractedSources.length > 0) {
            setMessages((prev: any) =>
              prev.map((msg: any) =>
                msg.id === assistantMessageId ? { ...msg, sources: extractedSources } : msg,
              ),
            )
          }
        }

        if (voiceEnabledRef.current && accumulatedContent) {
          speakMessage(accumulatedContent, undefined, mode)
        }
      } catch (error) {
        console.error("❌ Chat error:", error)
        const isAbort =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && /abort/i.test(error.message))

        setMessages((prev: any) => {
          const hasEmptyAssistant = prev.some(
            (msg: any) => msg.id === assistantMessageId && !msg.content,
          )
          if (hasEmptyAssistant) return prev.filter((msg: any) => msg.id !== assistantMessageId)
          if (isAbort) return prev
          return [
            ...prev,
            {
              id: `error-${Date.now()}`,
              role: "assistant" as const,
              content: "Sorry, I encountered an error. Please try again.",
            },
          ]
        })
      } finally {
        setIsChatLoading(false)
        chatAbortControllerRef.current = null
      }
    },
    [mode, provider, currentApiKey, userPersonalization, speakMessage, voiceEnabledRef, sourcesEnabled, sourcesType, isChatLoading, setMessages],
  )

  // handleSubmit delegates to handleComposerSubmitRef (set from the parent)
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (handleComposerSubmitRef.current) {
        await handleComposerSubmitRef.current(e)
      } else {
        console.warn("handleComposerSubmit not ready yet")
      }
    },
    [],
  )

  return {
    messages,
    setMessages,
    input: localInput,
    isLoading: isChatLoading,
    isChatLoading,
    isChatLoadingRef,
    chatAbortControllerRef,
    handleInputChange,
    setInput,
    handleSubmit,
    sendChatMessage,
    stopStreaming,
    handleComposerSubmitRef,
  }
}
