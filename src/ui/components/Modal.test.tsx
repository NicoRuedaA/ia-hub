import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Modal from './Modal'

function ModalHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <Modal open={open} onClose={() => setOpen(false)} ariaLabel="Test dialog">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </Modal>
    </>
  )
}

describe('Modal', () => {
  it('traps focus, hides the background, and restores focus when closed', () => {
    const { container } = render(<ModalHarness />)
    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Test dialog' })
    const first = screen.getByRole('button', { name: 'First action' })
    const last = screen.getByRole('button', { name: 'Last action' })
    expect(dialog).toBeInTheDocument()
    expect(first).toHaveFocus()
    expect(container).toHaveAttribute('aria-hidden', 'true')
    expect(container.inert).toBe(true)

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(first).toHaveFocus()

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(container).not.toHaveAttribute('aria-hidden')
    expect(container.inert).toBeFalsy()
  })
})
