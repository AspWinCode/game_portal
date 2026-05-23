"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import UnderlineExtension from "@tiptap/extension-underline";
import { Color as ColorExtension, TextStyle as TextStyleExtension, FontFamily as FontFamilyExtension, FontSize as FontSizeExtension } from "@tiptap/extension-text-style";
import HighlightExtension from "@tiptap/extension-highlight";
import { useEffect, useRef, useState } from "react";
import { HintBlockExtension } from "../lib/hint-block-extension";
import { uploadAdminMediaFile } from "../lib/api";

// ── Emoji data ────────────────────────────────────────────────────────────────

const EMOJI_ROWS: string[][] = [
  ["😀","😂","😍","🥰","😎","🤔","😅","😭","😡","🥺"],
  ["👍","👎","👏","🙌","🤝","💪","🙏","✌️","👋","🤞"],
  ["❤️","🔥","⭐","✅","❌","💡","🎉","🎯","🚀","💎"],
  ["🐶","🐱","🦊","🐻","🦁","🐸","🐧","🦋","🌸","🌈"],
  ["🍕","🍎","🍩","🍦","☕","🎮","⚽","🏆","🎵","🎨"],
];

// ── Text colours palette ──────────────────────────────────────────────────────

const TEXT_COLORS = [
  { label: "Чёрный",    value: "#111111" },
  { label: "Белый",     value: "#ffffff" },
  { label: "Серый",     value: "#6b7280" },
  { label: "Красный",   value: "#ef4444" },
  { label: "Оранжевый", value: "#f97316" },
  { label: "Жёлтый",    value: "#eab308" },
  { label: "Зелёный",   value: "#22c55e" },
  { label: "Голубой",   value: "#06b6d4" },
  { label: "Синий",     value: "#3b82f6" },
  { label: "Фиолетовый",value: "#a855f7" },
  { label: "Розовый",   value: "#ec4899" },
];

const HIGHLIGHT_COLORS = [
  { label: "Нет",        value: "" },
  { label: "Жёлтый",    value: "#fef08a" },
  { label: "Зелёный",   value: "#bbf7d0" },
  { label: "Голубой",   value: "#bae6fd" },
  { label: "Розовый",   value: "#fbcfe8" },
  { label: "Оранжевый", value: "#fed7aa" },
  { label: "Фиолетовый",value: "#e9d5ff" },
];

const FONT_FAMILIES = [
  { label: "По умолчанию", value: "" },
  { label: "Serif",        value: "Georgia, serif" },
  { label: "Mono",         value: "'Courier New', monospace" },
  { label: "Comic",        value: "'Comic Sans MS', cursive" },
];

const FONT_SIZES = ["12px","14px","16px","18px","20px","24px","28px","32px","36px"];

// ── Small helpers ─────────────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children,
  style: extraStyle,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        padding: "2px 8px",
        border: "none",
        borderRadius: 5,
        background: active ? "var(--bg-tertiary)" : "transparent",
        color: active ? "var(--text)" : "var(--muted)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        lineHeight: "24px",
        opacity: disabled ? 0.4 : 1,
        transition: "background 100ms, color 100ms",
        minWidth: 28,
        textAlign: "center" as const,
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}

function Sep() {
  return (
    <span style={{ width: 1, alignSelf: "stretch", background: "var(--panel-border)", margin: "4px 2px" }} />
  );
}

// ── Color swatch dropdown ─────────────────────────────────────────────────────

function ColorDropdown({
  label,
  title,
  swatchColor,
  disabled,
  colors,
  onPick,
  onCustom,
}: {
  label: string;
  title: string;
  swatchColor: string;
  disabled: boolean;
  colors: { label: string; value: string }[];
  onPick: (v: string) => void;
  onCustom?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        title={title}
        disabled={disabled}
        onMouseDown={(e) => { e.preventDefault(); if (!disabled) setOpen((o) => !o); }}
        style={{
          padding: "2px 6px",
          border: "none",
          borderRadius: 5,
          background: "transparent",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 13,
          lineHeight: "24px",
          opacity: disabled ? 0.4 : 1,
          display: "flex",
          alignItems: "center",
          gap: 3,
          color: "var(--muted)",
        }}
      >
        <span style={{
          display: "inline-block",
          width: 12,
          height: 12,
          borderRadius: 2,
          background: swatchColor || "transparent",
          border: "1.5px solid var(--panel-border)",
        }} />
        {label}
      </button>
      {open ? (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onMouseDown={() => setOpen(false)}
          />
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 1000,
            background: "var(--bg-secondary, #1e1e2e)",
            border: "1px solid var(--panel-border)",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 140,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}>
            {colors.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(c.value); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "3px 6px",
                  borderRadius: 4,
                  color: "var(--text)",
                  fontSize: 12,
                  textAlign: "left",
                }}
              >
                <span style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  background: c.value || "transparent",
                  border: "1.5px solid var(--panel-border)",
                  flexShrink: 0,
                }} />
                {c.label}
              </button>
            ))}
            {onCustom ? (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onCustom(); setOpen(false); }}
                style={{
                  marginTop: 4,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: 11,
                  textAlign: "left",
                  padding: "2px 6px",
                }}
              >
                + Свой цвет…
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Font-size select ──────────────────────────────────────────────────────────

function FontSizeSelect({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const current = editor.getAttributes("textStyle").fontSize ?? "";

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (!v) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(v).run();
    }
  }

  return (
    <select
      disabled={disabled}
      value={current}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={handleChange}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--muted)",
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: "2px 2px",
        borderRadius: 4,
        lineHeight: "24px",
        maxWidth: 58,
      }}
    >
      <option value="">Размер</option>
      {FONT_SIZES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

// ── Emoji picker panel ────────────────────────────────────────────────────────

function EmojiPicker({
  onPick,
  onClose,
}: {
  onPick: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onMouseDown={onClose} />
      <div style={{
        position: "absolute",
        top: "100%",
        left: 0,
        zIndex: 1000,
        background: "var(--bg-secondary, #1e1e2e)",
        border: "1px solid var(--panel-border)",
        borderRadius: 10,
        padding: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
      }}>
        {EMOJI_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: "flex", gap: 2, marginBottom: 2 }}>
            {row.map((em) => (
              <button
                key={em}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onPick(em); }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 20,
                  lineHeight: 1,
                  padding: "3px 4px",
                  borderRadius: 5,
                  transition: "background 80ms",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-tertiary)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "none"; }}
              >
                {em}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({
  editor,
  disabled,
  uploading,
  onImageUpload
}: {
  editor: Editor;
  disabled: boolean;
  uploading: boolean;
  onImageUpload: (file: File) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onImageUpload(file);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleLink() {
    const prev = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Введи ссылку (URL):", prev || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url.trim(), target: "_blank" }).run();
    }
  }

  function handleVideo() {
    const url = window.prompt("Ссылка на видео (YouTube или MP4):", "");
    if (!url?.trim()) return;
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
    if (yt) {
      editor.chain().focus().insertContent(
        `<iframe width="100%" height="280" src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen style="border-radius:8px;display:block;margin:8px 0"></iframe><p></p>`
      ).run();
    } else {
      editor.chain().focus().insertContent(
        `<video controls style="width:100%;border-radius:8px;display:block;margin:8px 0"><source src="${url.trim()}"/></video><p></p>`
      ).run();
    }
  }

  function handleCustomColor() {
    const v = window.prompt("Введи цвет (hex, например #ff0000):", "");
    if (!v) return;
    editor.chain().focus().setColor(v.trim()).run();
  }

  function handleCustomHighlight() {
    const v = window.prompt("Введи цвет фона (hex):", "");
    if (!v) return;
    editor.chain().focus().setHighlight({ color: v.trim() }).run();
  }

  const busy = disabled || uploading;
  const currentTextColor = editor.getAttributes("textStyle").color ?? "#111111";
  const currentHighlight = editor.getAttributes("highlight").color ?? "";

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 1,
      padding: "4px 6px",
      borderBottom: "1px solid var(--panel-border)",
      background: "var(--bg-soft)",
      borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
    }}>
      {/* Font family */}
      <select
        disabled={busy}
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          fontSize: 12,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.4 : 1,
          padding: "2px 2px",
          borderRadius: 4,
          lineHeight: "24px",
          maxWidth: 80,
        }}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Font size */}
      <FontSizeSelect editor={editor} disabled={busy} />

      <Sep />

      {/* Text formatting */}
      <ToolBtn title="Жирный (Ctrl+B)" active={editor.isActive("bold")} disabled={busy}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <b>B</b>
      </ToolBtn>
      <ToolBtn title="Курсив (Ctrl+I)" active={editor.isActive("italic")} disabled={busy}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <i>I</i>
      </ToolBtn>
      <ToolBtn title="Подчёркнутый (Ctrl+U)" active={editor.isActive("underline")} disabled={busy}
        onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <u>U</u>
      </ToolBtn>
      <ToolBtn title="Зачёркнутый" active={editor.isActive("strike")} disabled={busy}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <s>S</s>
      </ToolBtn>

      <Sep />

      {/* Color pickers */}
      <ColorDropdown
        label="A"
        title="Цвет текста"
        swatchColor={currentTextColor}
        disabled={busy}
        colors={TEXT_COLORS}
        onPick={(v) => {
          if (!v) editor.chain().focus().unsetColor().run();
          else editor.chain().focus().setColor(v).run();
        }}
        onCustom={handleCustomColor}
      />
      <ColorDropdown
        label="H"
        title="Цвет выделения"
        swatchColor={currentHighlight}
        disabled={busy}
        colors={HIGHLIGHT_COLORS}
        onPick={(v) => {
          if (!v) editor.chain().focus().unsetHighlight().run();
          else editor.chain().focus().setHighlight({ color: v }).run();
        }}
        onCustom={handleCustomHighlight}
      />

      <Sep />

      {/* Headings */}
      <ToolBtn title="Заголовок 2" active={editor.isActive("heading", { level: 2 })} disabled={busy}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolBtn>
      <ToolBtn title="Заголовок 3" active={editor.isActive("heading", { level: 3 })} disabled={busy}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolBtn>

      <Sep />

      {/* Lists */}
      <ToolBtn title="Маркированный список" active={editor.isActive("bulletList")} disabled={busy}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •≡
      </ToolBtn>
      <ToolBtn title="Нумерованный список" active={editor.isActive("orderedList")} disabled={busy}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1≡
      </ToolBtn>

      <Sep />

      {/* Link / media */}
      <ToolBtn title="Ссылка" active={editor.isActive("link")} disabled={busy}
        onClick={handleLink}>
        🔗
      </ToolBtn>
      <ToolBtn
        title={uploading ? "Загружаю..." : "Вставить изображение (или Ctrl+V)"}
        disabled={busy}
        onClick={() => imageInputRef.current?.click()}>
        {uploading ? "⏳" : "🖼"}
      </ToolBtn>
      <ToolBtn title="Вставить видео (YouTube / MP4)" disabled={busy}
        onClick={handleVideo}>
        🎬
      </ToolBtn>

      <Sep />

      {/* Quote / code */}
      <ToolBtn title="Цитата" active={editor.isActive("blockquote")} disabled={busy}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </ToolBtn>
      <ToolBtn title="Код" active={editor.isActive("code")} disabled={busy}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        {"</>"}
      </ToolBtn>

      <Sep />

      {/* Emoji */}
      <div style={{ position: "relative" }}>
        <ToolBtn
          title="Вставить эмодзи"
          disabled={busy}
          onClick={() => setShowEmoji((o) => !o)}
        >
          😊
        </ToolBtn>
        {showEmoji ? (
          <EmojiPicker
            onPick={(em) => {
              editor.chain().focus().insertContent(em).run();
              setShowEmoji(false);
            }}
            onClose={() => setShowEmoji(false)}
          />
        ) : null}
      </div>

      <Sep />

      {/* Hint block */}
      <ToolBtn
        title="Добавить подсказку (видна ребёнку только после одобрения тренером)"
        active={editor.isActive("hintBlock")}
        disabled={busy}
        onClick={() => {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "hintBlock",
              content: [{ type: "paragraph", content: [{ type: "text", text: "Напиши текст подсказки здесь..." }] }],
            })
            .run();
        }}
      >
        💡
      </ToolBtn>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  disabled = false,
  minHeight = 120,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: number;
}) {
  const [uploading, setUploading] = useState(false);

  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const asset = await uploadAdminMediaFile(file);
      editorRef.current?.chain().focus().setImage({ src: asset.url, alt: file.name }).run();
    } catch {
      // Silently ignore
    } finally {
      setUploading(false);
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
      TextStyleExtension,
      ColorExtension,
      HighlightExtension.configure({ multicolor: true }),
      FontFamilyExtension,
      FontSizeExtension,
      LinkExtension.configure({ openOnClick: false }),
      ImageExtension.configure({ inline: false, allowBase64: false }),
      HintBlockExtension,
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,

    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },

    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },

    editorProps: {
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (!imageItem) return false;

        const file = imageItem.getAsFile();
        if (!file) return false;

        void handleImageUpload(file);
        return true;
      }
    }
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  const lastValueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    if (value !== lastValueRef.current && value !== editor.getHTML()) {
      lastValueRef.current = value;
      editor.commands.setContent(value || "");
    }
  }, [editor, value]);

  if (!editor) return null;

  return (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--panel-border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--bg-tertiary)",
        overflow: "hidden",
        transition: "border-color var(--transition), box-shadow var(--transition)",
      }}
      onFocusCapture={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = "var(--primary)";
        el.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)";
      }}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "var(--panel-border)";
          el.style.boxShadow = "none";
        }
      }}
    >
      {!disabled ? (
        <Toolbar
          editor={editor}
          disabled={disabled}
          uploading={uploading}
          onImageUpload={(file) => void handleImageUpload(file)}
        />
      ) : null}
      <EditorContent
        editor={editor}
        className="rich-editor-content"
        style={{ minHeight, cursor: disabled ? "default" : "text" }}
      />
      {uploading ? (
        <div style={{
          position: "absolute", bottom: 8, right: 12,
          fontSize: 12, color: "var(--muted)", pointerEvents: "none"
        }}>
          Загружаю изображение...
        </div>
      ) : null}
    </div>
  );
}
