/** Renders the `**strong**` and `` `key` `` marks that translated text may use. */
export function RichText({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`')) {
      // Arrow keys sit in the same physical order whatever the text direction.
      return (
        <kbd key={i} dir="ltr" className="font-bold">
          {part.slice(1, -1)}
        </kbd>
      )
    }
    return part
  })
}
