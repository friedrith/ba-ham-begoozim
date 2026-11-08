import { clsx } from 'clsx'

import { MESSAGES, type Locale, type Messages } from '../i18n'

/** Switches to the other language, named in that language so its readers can find it. */
export function LanguageButton({
  t,
  onChange,
  className,
}: {
  t: Messages
  onChange: (locale: Locale) => void
  className?: string
}) {
  const other = MESSAGES[t.locale === 'fa' ? 'en' : 'fa']
  return (
    <button
      type="button"
      lang={other.locale}
      onClick={() => onChange(other.locale)}
      className={clsx(
        'bg-cream border-ink cursor-pointer rounded-full border-[3px] px-3 py-1 text-sm font-bold',
        className,
      )}
    >
      {other.languageName}
    </button>
  )
}
