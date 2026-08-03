import Modal from './Modal'
import { languageName, useTranslation } from '../../i18n'
import { usePreferencesStore } from '../../state/preferencesStore'
import type { UiLanguage } from '../../domain/types'

export default function LanguagePicker({ open }: { open: boolean }) {
  const setLanguage = usePreferencesStore((state) => state.setLanguage)
  const { language, t } = useTranslation()

  function chooseLanguage(selected: UiLanguage) {
    setLanguage(selected)
  }

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      closeOnEscape={false}
      closeOnOverlayClick={false}
      ariaLabel={t('language.pickerTitle')}
    >
      <div className="dialog-body language-picker">
        <p className="language-picker-kicker">IA Hub</p>
        <h2 className="dialog-title">{t('language.pickerTitle')}</h2>
        <p className="dialog-copy">{t('language.pickerCopy')}</p>
        <div className="language-picker-options" role="group" aria-label={t('language.label')}>
          {(['en', 'es'] as UiLanguage[]).map((option) => {
            const label = languageName(language, option)
            return (
              <button
                key={option}
                type="button"
                className="language-option"
                onClick={() => chooseLanguage(option)}
              >
                <strong>{label}</strong>
                <span>{t('language.continue', { language: label })}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
