import { useRef } from 'react'
import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  codeMirrorPlugin,
  diffSourcePlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  CodeToggle,
  ListsToggle,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  InsertCodeBlock,
  DiffSourceToggleWrapper,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Failed to read image file'))
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

const editorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  markdownShortcutPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  imagePlugin({
    imageUploadHandler: async (file: File) => fileToDataUrl(file),
  }),
  tablePlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: 'txt' }),
  codeMirrorPlugin({
    codeBlockLanguages: {
      js: 'JavaScript',
      jsx: 'JSX',
      ts: 'TypeScript',
      css: 'CSS',
      html: 'HTML',
      json: 'JSON',
      md: 'Markdown',
      bash: 'Shell',
      txt: 'Plain text',
    },
  }),
  diffSourcePlugin(),
  toolbarPlugin({
    toolbarContents: () => (
      <DiffSourceToggleWrapper>
        <UndoRedo />
        <BoldItalicUnderlineToggles />
        <CodeToggle />
        <ListsToggle />
        <InsertCodeBlock />
        <BlockTypeSelect />
        <CreateLink />
        <InsertImage />
        <InsertTable />
        <InsertThematicBreak />
      </DiffSourceToggleWrapper>
    ),
  }),
]

type ArticleMdxEditorProps = {
  markdown: string
  onChange: (markdown: string) => void
  placeholder?: string
  maxLength?: number
}

/** Rich MDX/markdown editor for article body (toolbar + rich / source modes). */
export function ArticleMdxEditor({ markdown, onChange, placeholder, maxLength }: ArticleMdxEditorProps) {
  const editorRef = useRef<MDXEditorMethods>(null)
  return (
    <div className="article-mdx-editor-wrap">
      <MDXEditor
        ref={editorRef}
        markdown={markdown}
        onChange={(md) => {
          if (maxLength != null && md.length > maxLength && md.length > markdown.length) {
            const next = markdown.length <= maxLength ? md.slice(0, maxLength) : markdown
            queueMicrotask(() => editorRef.current?.setMarkdown(next))
            if (next !== markdown) onChange(next)
            return
          }
          onChange(md)
        }}
        placeholder={placeholder}
        className="article-mdx-editor-root"
        contentEditableClassName="article-mdx-content"
        plugins={editorPlugins}
      />
    </div>
  )
}
