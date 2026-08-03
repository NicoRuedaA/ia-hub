import { useState } from 'react'
import { useTranslation } from '../../i18n'
import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  requireType?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  requireType,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')

  const handleConfirm = () => {
    if (requireType && typed !== requireType) return
    setTyped('')
    onConfirm()
  }

  const handleCancel = () => {
    setTyped('')
    onCancel()
  }

  return (
    <Modal open={open} onClose={handleCancel} ariaLabel={title}>
      <div className="dialog-body">
        <svg viewBox="0 0 24 24" fill="none" width="20" height="20" aria-hidden="true" style={{ color: danger ? 'var(--red)' : 'var(--ink-soft)' }}>
          <path d="M12 8v5m0 3v.01M10.3 4.9 3.2 17.2A1.2 1.2 0 0 0 4.24 19h15.52a1.2 1.2 0 0 0 1.04-1.8L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        <h2 className="dialog-title" style={{ marginTop: 14 }}>{title}</h2>
        <p className="dialog-copy">{message}</p>
        {requireType && (
          <div>
            <label htmlFor="confirm-phrase" className="dialog-label">
              {t('confirm.typeToConfirm', { phrase: requireType })}
            </label>
            <input
              id="confirm-phrase"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="dialog-input"
              autoFocus
            />
          </div>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            onClick={handleCancel}
            className="button-quiet"
          >
             {t('confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={requireType ? typed !== requireType : false}
            className={danger ? 'button-danger' : 'button-primary'}
          >
             {confirmLabel ?? t('confirm.confirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
