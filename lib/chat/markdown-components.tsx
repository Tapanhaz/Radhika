"use client"

import { useMemo } from "react"
import type { Components } from "react-markdown"
import { CodeBlock } from "@/components/chat/code-block"
import type { UIStyle } from "@/types/chat"

/**
 * Build the react-markdown component overrides based on the current UI style.
 */
export function useMarkdownComponents(uiStyle: UIStyle): Components {
  return useMemo<Components>(
    () => ({
      h1: ({ children }) => (
        <h1
          className={`mb-2 text-base font-semibold text-slate-900 dark:text-slate-100 lg:text-lg ${uiStyle === "pixel" ? "pixel-font text-sm" : ""}`}
        >
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2
          className={`mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100 lg:text-base ${uiStyle === "pixel" ? "pixel-font text-xs" : ""}`}
        >
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3
          className={`mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100 ${uiStyle === "pixel" ? "pixel-font text-xs" : ""}`}
        >
          {children}
        </h3>
      ),
      p: ({ children }) => (
        <p
          className={`mb-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300 ${uiStyle === "pixel" ? "pixel-font text-xs" : ""}`}
        >
          {children}
        </p>
      ),
      ul: ({ children }) => (
        <ul
          className={`ml-4 mb-2 list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300 ${uiStyle === "pixel" ? "ml-0 list-none pixel-font text-xs" : ""}`}
        >
          {children}
        </ul>
      ),
      ol: ({ children }) => (
        <ol
          className={`ml-4 mb-2 list-decimal space-y-1 text-sm text-slate-700 dark:text-slate-300 ${uiStyle === "pixel" ? "ml-0 list-none pixel-font text-xs" : ""}`}
        >
          {children}
        </ol>
      ),
      li: ({ children }) => (
        <li
          className={`text-sm text-slate-700 dark:text-slate-300 ${uiStyle === "pixel" ? 'pixel-font text-xs before:content-["▶_"] before:text-cyan-600 dark:before:text-cyan-400' : ""}`}
        >
          {children}
        </li>
      ),
      strong: ({ children }) => (
        <strong
          className={`text-slate-900 dark:text-slate-100 ${uiStyle === "pixel" ? "pixel-font" : "font-semibold"}`}
        >
          {children}
        </strong>
      ),
      em: ({ children }) => (
        <em
          className={`italic text-slate-700 dark:text-slate-300 ${uiStyle === "pixel" ? "pixel-font" : ""}`}
        >
          {children}
        </em>
      ),
      code: ({ children, className }) => {
        const isInline = !className?.includes("language-")
        return (
          <CodeBlock isInline={isInline} className={className} isPixel={uiStyle === "pixel"}>
            {String(children).replace(/\n$/, "")}
          </CodeBlock>
        )
      },
      pre: ({ children }) => <>{children}</>,
      blockquote: ({ children }) => (
        <blockquote
          className={`border-l-4 border-cyan-500/70 pl-4 text-sm italic text-slate-600 dark:text-slate-400 ${uiStyle === "pixel" ? "pixel-font" : ""}`}
        >
          {children}
        </blockquote>
      ),
      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-cyan-600 underline transition hover:text-cyan-500 dark:text-cyan-400 ${uiStyle === "pixel" ? "pixel-font" : ""}`}
        >
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="my-3 overflow-x-auto">
          <table
            className={`min-w-full border-collapse text-sm ${uiStyle === "pixel" ? "pixel-font text-xs" : ""}`}
          >
            {children}
          </table>
        </div>
      ),
      thead: ({ children }) => (
        <thead className="bg-slate-100 dark:bg-slate-800">{children}</thead>
      ),
      tbody: ({ children }) => (
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">{children}</tbody>
      ),
      tr: ({ children }) => (
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">{children}</tr>
      ),
      th: ({ children }) => (
        <th className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-left font-semibold text-slate-900 dark:text-slate-100">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-slate-300 dark:border-slate-600 px-3 py-2 text-slate-700 dark:text-slate-300">
          {children}
        </td>
      ),
    }),
    [uiStyle],
  )
}
