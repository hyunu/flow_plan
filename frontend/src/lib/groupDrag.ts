import { useState } from 'react'
import { http } from '../api/client'
import type { DragEvent } from 'react'
import type { Group, Task } from '../api/types'

/** 대그룹 재배열/태스크 그룹 이동을 위한 네이티브 HTML5 DnD 훅 (라이브러리 불필요) */
export function useGroupDrag(opts: {
  groups: Group[]
  tasks: Task[]
  canReorder: boolean
  canMoveTask: boolean
  onChanged: () => void
}) {
  const { groups, tasks, canReorder, canMoveTask, onChanged } = opts
  const [drag, setDrag] = useState<{ kind: 'group' | 'task'; id: number } | null>(null)
  const [overGid, setOverGid] = useState<number | null>(null)

  const clear = () => {
    setDrag(null)
    setOverGid(null)
  }

  // 자식 하위까지 포함한 task id 목록 (부모를 이동하면 하위도 함께 이동)
  const collectWithSubtree = (taskId: number): number[] => {
    const byParent = new Map<number, Task[]>()
    for (const t of tasks) {
      if (t.parent_id == null) continue
      const arr = byParent.get(t.parent_id)
      if (arr) arr.push(t)
      else byParent.set(t.parent_id, [t])
    }
    const out: number[] = []
    const walk = (id: number) => {
      out.push(id)
      for (const c of byParent.get(id) ?? []) walk(c.id)
    }
    walk(taskId)
    return out
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
        const ids = collectWithSubtree(d.id)
        await Promise.all(
          ids.map((id) =>
            http.put(`/tasks/${id}`, { group_id: gid, change_reason: '그룹 이동 (드래그)' }),
          ),
        )
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
    draggingGroup,
    draggingTask,
    onGroupDragStart,
    onTaskDragStart,
    onGroupDragOver,
    onGroupDragLeave,
    onGroupDrop,
    onDragEnd: clear,
  }
}

export type GroupDragApi = ReturnType<typeof useGroupDrag>