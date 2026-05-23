import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewWrapperProps } from "@tiptap/react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import React from "react";

// ── React node view rendered inside the editor ──────────────────────────────

function HintBlockView({ deleteNode, selected }: NodeViewWrapperProps) {
  return React.createElement(
    NodeViewWrapper,
    {
      style: {
        margin: "12px 0",
        border: `2px solid ${selected ? "#f59e0b" : "rgba(245,158,11,0.4)"}`,
        borderRadius: 10,
        background: "rgba(245,158,11,0.07)",
        overflow: "hidden",
        transition: "border-color 150ms",
        userSelect: "none" as const,
      },
    },
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid rgba(245,158,11,0.25)",
          background: "rgba(245,158,11,0.10)",
        },
        contentEditable: false,
      },
      React.createElement(
        "span",
        { style: { fontSize: 12, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.04em" } },
        "💡 ПОДСКАЗКА"
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onMouseDown: (e: React.MouseEvent) => {
            e.preventDefault();
            deleteNode();
          },
          style: {
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#f59e0b",
            fontSize: 14,
            padding: "0 2px",
            lineHeight: 1,
            opacity: 0.7,
          },
          title: "Удалить подсказку",
        },
        "×"
      )
    ),
    React.createElement(
      NodeViewContent,
      {
        as: "div",
        style: {
          padding: "10px 14px",
          minHeight: 40,
          fontSize: 14,
          lineHeight: 1.6,
          color: "var(--text)",
          outline: "none",
          // allow text selection / editing
          userSelect: "text" as const,
        },
      }
    )
  );
}

// ── TipTap Node definition ──────────────────────────────────────────────────

export const HintBlockExtension = Node.create({
  name: "hintBlock",

  group: "block",
  content: "paragraph+",
  isolating: true,    // ← Enter doesn't escape the block
  defining: true,     // ← keeps block identity on paste / split

  parseHTML() {
    return [{ tag: "hint-block" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["hint-block", mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HintBlockView);
  },
});
