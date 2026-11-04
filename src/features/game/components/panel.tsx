import { clsx } from 'clsx'

export function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-ink/50 absolute inset-0 flex touch-pan-y overflow-y-auto overscroll-contain p-4">
      <dialog
        open
        aria-label={title}
        className="text-ink bg-cream border-ink shadow-ink static m-auto flex w-full max-w-sm flex-col gap-3 rounded-3xl border-4 p-6 shadow-[0_8px_0]"
      >
        <h2 className="font-display text-sauce text-center text-4xl">{title}</h2>
        {children}
      </dialog>
    </div>
  )
}

export function PanelButton({
  primary,
  disabled,
  onClick,
  children,
}: {
  primary?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'border-ink font-display cursor-pointer rounded-xl border-[3px] px-4 py-2 text-lg disabled:cursor-default disabled:opacity-50',
        primary ? 'bg-mustard' : 'bg-white',
      )}
    >
      {children}
    </button>
  )
}
