import { useState } from 'react'
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
  confirmLabel = 'Confirm',
  danger = false,
  requireType,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
      <div className="p-6 sm:p-7">
        <div className={`mb-5 grid h-10 w-10 place-items-center rounded-xl ${danger ? 'bg-rose-300/[0.08] text-rose-300 ring-1 ring-rose-300/15' : 'bg-cyan-300/[0.08] text-cyan-300 ring-1 ring-cyan-300/15'}`}>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
            <path d="M12 8v5m0 3v.01M10.3 4.9 3.2 17.2A1.2 1.2 0 0 0 4.24 19h15.52a1.2 1.2 0 0 0 1.04-1.8L13.7 4.9a1.96 1.96 0 0 0-3.4 0Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{message}</p>
        {requireType && (
          <div className="mt-5">
            <label htmlFor="confirm-phrase" className="mb-2 block text-xs text-slate-400">
              Type <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-300">{requireType}</code> to confirm
            </label>
            <input
              id="confirm-phrase"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/[0.09] bg-white/[0.045] px-3 text-sm text-slate-200 outline-none placeholder:text-slate-400 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
              autoFocus
            />
          </div>
        )}
        <div className="mt-7 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="h-10 rounded-xl px-4 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={requireType ? typed !== requireType : false}
            className={`h-10 rounded-xl px-4 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              danger
                ? 'bg-rose-500 text-white hover:bg-rose-400'
                : 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
