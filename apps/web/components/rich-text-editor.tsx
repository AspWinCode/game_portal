"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import LinkExtension from "@tiptap/extension-link";
import ImageExtension from "@tiptap/extension-image";
import UnderlineExtension from "@tiptap/extension-underline";
import { useEffect, useRef, useState } from "react";
import { HintBlockExtension } from "../lib/hint-block-extension";
import { uploadAdminMediaFile } from "../lib/api";

// ── Small helpers ─────────────────────────────────────────────────────────────

function ToolBtn({
  onClick,
  active,
  disabled,
  title,
  children
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      // onMouseDown prevents the editor from losing focus when clicking toolbar
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

  const busy = disabled || uploading;

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
      <Sep />
      <ToolBtn title="Заголовок 2" active={editor.isActive("heading", { level: 2 })} disabled={busy}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolBtn>
      <ToolBtn title="Заголовок 3" active={editor.isActive("heading", { level: 3 })} disabled={busy}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolBtn>
      <Sep />
      <ToolBtn title="Маркированный список" active={editor.isActive("bulletList")} disabled={busy}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •≡
      </ToolBtn>
      <ToolBtn title="Нумерованный список" active={editor.isActive("orderedList")} disabled={busy}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1≡
      </ToolBtn>
      <Sep />
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
      <ToolBtn title="Цитата" active={editor.isActive("blockquote")} disabled={busy}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </ToolBtn>
      <ToolBtn title="Код" active={editor.isActive("code")} disabled={busy}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        {"</>"}
      </ToolBtn>
      <Sep />
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

  // Keep a stable ref to the editor so the paste handler can access it after mount
  const editorRef = useRef<Editor | null>(null);

  // Keep onChange in a ref so the paste closure doesn't capture a stale copy
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  async function handleImageUpload(file: File) {
    setUploading(true);
    try {
      const asset = await uploadAdminMediaFile(file);
      editorRef.current?.chain().focus().setImage({ src: asset.url, alt: file.name }).run();
    } catch {
      // Silently ignore — no image inserted
    } finally {
      setUploading(false);
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      UnderlineExtension,
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

    // ── Paste handler: intercepts Ctrl+V / ⌘+V image pastes ──────────────
    editorProps: {
      handlePaste: (_view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith("image/"));
        if (!imageItem) return false; // let TipTap handle text paste normally

        const file = imageItem.getAsFile();
        if (!file) return false;

        void handleImageUpload(file);
        return true; // mark as handled — prevents TipTap's default base64 paste
      }
    }
  });

  // Keep editorRef in sync (handles HMR / editor recreation)
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync disabled state
  useEffect(() => {
    if (editor) editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Sync content when the parent swaps the step (value identity changes externally)
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
