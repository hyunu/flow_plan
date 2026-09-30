import { useState } from 'react'
import { http } from '../api/client'
import type { DragEvent } from 'react'
import type { Group } from '../api/types'

/** 대그룹 재배열/태스크 그룹 이동을 위한 네이티브 HTML5 DnD 훅 (라이브러리 불필요) */
export function useGroupDrag(opts: {
  groups: Group[]
  canReorder: boolean
  canMoveTask: boolean
  onChanged: () => void
}) {
  const { groups, canReorder, canMoveTask, onChanged } = opts
  const [drag, setDrag] = useState<{ kind: 'group' | 'task'; id: number } | null>(null)
  const [overGid, setOverGid] = useState<number | null>(null)
  const [overTaskId, setOverTaskId] = useState<number | null>(null)
  const [overTaskPos, setOverTaskPos] = useState<'before' | 'after' | null>(null)

  const clear = () => {
    setDrag(null)
    setOverGid(null)
    setOverTaskId(null)
    setOverTaskPos(null)
  }

  const onGroupDragStart = (e: DragEvent, gid: number) => {
    if (!canReorder) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    setDrag({ kind: 'group', id: gid })
  }
  const onTaskDragStart = (e: DragEvent, taskId: number) => {
    if (!canMoveTask) {
      e.preventDefault()
      return
    }
    e.dataTransfer.effectAllowed = 'move'
    setDrag({ kind: 'task', id: taskId })
  }
  const onGroupDragOver = (e: DragEvent, gid: number) => {
    if (!drag) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overGid !== gid) setOverGid(gid)
  }
  const onGroupDragLeave = (gid: number) => {
    if (overGid === gid) setOverGid(null)
  }
  // 태스크 행 위로 드래그: 행 위 절반이면 '앞에', 아래 절반이면 '뒤에' 삽입
  const onTaskDragOver = (e: DragEvent, taskId: number) => {
    if (drag?.kind !== 'task' || drag.id === taskId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overGid !== null) setOverGid(null)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const pos = rect.height > 0 && e.clientY >= rect.top + rect.height / 2 ? 'after' : 'before'
    if (overTaskId !== taskId || overTaskPos !== pos) {
      setOverTaskId(taskId)
      setOverTaskPos(pos)
    }
  }
  const onTaskDragLeave = (taskId: number) => {
    if (overTaskId === taskId) {
      setOverTaskId(null)
      setOverTaskPos(null)
    }
  }
  const onTaskDrop = async (e: DragEvent, taskId: number) => {
    e.preventDefault()
    const d = drag
    const pos = overTaskPos
    clear()
    if (!d || d.kind !== 'task' || d.id === taskId) return
    try {
      await http.put(`/tasks/${d.id}/order`, pos === 'after' ? { after_id: taskId } : { before_id: taskId })
      onChanged()
    } catch {
      onChanged()
    }
  }
  const onGroupDrop = async (e: DragEvent, gid: number) => {
    e.preventDefault()
    const d = drag
    clear()
    if (!d) return
    try {
      if (d.kind === 'group') {
        if (d.id === gid) return
        const ordered = [...groups]
        const src = ordered.findIndex((g) => g.id === d.id)
        const [moved] = ordered.splice(src, 1)
        ordered.splice(
          ordered.findIndex((g) => g.id === gid),
          0,
          moved,
        )
        await Promise.all(
          ordered.map((g, i) => {
            const so = (i + 1) * 10
            return so !== g.sort_order ? http.put(`/groups/${g.id}`, { sort_order: so }) : Promise.resolve(null)
          }),
        )
      } else {
        // 태스크 → 그룹 맨 뒤로 이동 (같은 부모 레벨 유지, 순서는 그 그룹 끝에 붙임)
        await http.put(`/tasks/${d.id}/order`, { group_id: gid })
      }
      onChanged()
    } catch {
      onChanged()
    }
  }

  const draggingGroup = drag?.kind === 'group' ? drag.id : null
  const draggingTask = drag?.kind === 'task' ? drag.id : null

  return {
    drag,
    overGid,
    overTaskId,
    overTaskPos,
    draggingGroup,
    draggingTask,
    onGroupDragStart,
    onTaskDragStart,
    onGroupDragOver,
    onGroupDragLeave,
    onGroupDrop,
    onTaskDragOver,
    onTaskDragLeave,
    onTaskDrop,
    onDragEnd: clear,
  }
}

export type GroupDragApi = ReturnType<typeof useGroupDrag>