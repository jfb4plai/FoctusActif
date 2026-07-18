import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { TeacherRoster } from './TeacherRoster.jsx'

const LINKS = [
  { id: 'link-1', student_id: 'student-1', teacher_id: 'teacher-1', status: 'linked' },
  { id: 'link-2', student_id: 'student-2', teacher_id: 'teacher-1', status: 'linked' },
]

describe('TeacherRoster', () => {
  it('affiche un élément par élève lié', () => {
    render(<TeacherRoster links={LINKS} onSelectStudent={vi.fn()} />)
    expect(screen.getAllByTestId('roster-item')).toHaveLength(2)
  })

  it('déclenche onSelectStudent avec le student_id au clic', async () => {
    const onSelectStudent = vi.fn()
    render(<TeacherRoster links={LINKS} onSelectStudent={onSelectStudent} />)

    await userEvent.click(screen.getAllByTestId('roster-item')[0])

    expect(onSelectStudent).toHaveBeenCalledWith('student-1')
  })

  it('affiche un état vide si aucun élève n\'est lié', () => {
    render(<TeacherRoster links={[]} onSelectStudent={vi.fn()} />)
    expect(screen.getByText(/aucun élève lié/i)).toBeInTheDocument()
  })
})
