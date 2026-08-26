"""Critical Path Method(CPM) 결정적 계산 모듈.

Finish-to-Start(FS) 의존성과 Lag를 기반으로 전방/후방 패스를 수행해
Early/Late Start/Finish, Total Float, Free Float, Critical Path를 계산한다.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.engine.calendar import WorkingCalendar


@dataclass
class TaskNode:
    id: int
    title: str = ""
    duration: int = 1  # 작업일 수
    plan_start: date | None = None
    earliest_start: date | None = None
    earliest_finish: date | None = None
    latest_start: date | None = None
    latest_finish: date | None = None
    total_float: float = 0.0
    free_float: float = 0.0
    is_critical: bool = False
    successors: list["Edge"] = field(default_factory=list)
    predecessors: list["Edge"] = field(default_factory=list)


@dataclass
class Edge:
    predecessor_id: int
    successor_id: int
    lag: int = 0
    dep_type: str = "FS"


class CPMNetwork:
    def __init__(self, nodes: dict[int, TaskNode], edges: list[Edge], cal: WorkingCalendar):
        self.nodes = nodes
        self.cal = cal
        self.edges = edges
        for e in edges:
            if e.predecessor_id in nodes:
                nodes[e.predecessor_id].successors.append(e)
            if e.successor_id in nodes:
                nodes[e.successor_id].predecessors.append(e)

    def _sorted_ids(self) -> list[int]:
        """Topological sort(Kahn's algorithm). 사이클 시 예외."""
        in_deg: dict[int, int] = {i: len(n.predecessors) for i, n in self.nodes.items()}
        import heapq

        # 결정성 유지를 위해 ID 순으로 큐
        queue = [i for i, d in in_deg.items() if d == 0]
        heapq.heapify(queue)
        order: list[int] = []
        while queue:
            i = heapq.heappop(queue)
            order.append(i)
            for e in self.nodes[i].successors:
                in_deg[e.successor_id] -= 1
                if in_deg[e.successor_id] == 0:
                    heapq.heappush(queue, e.successor_id)
        if len(order) != len(self.nodes):
            raise ValueError("Task Dependency에 사이클이 존재합니다.")
        return order

    def _duration_days(self, node: TaskNode) -> int:
        return max(1, node.duration)

    def forward_pass(self, start_override: dict[int, date] | None = None) -> date:
        """전방 패스: 각 노드의 ES/EF 계산. 프로젝트의 earliest finish(초기 예상 종료일) 반환."""
        order = self._sorted_ids()
        project_ef: date | None = None
        for i in order:
            node = self.nodes[i]
            if start_override and i in start_override:
                node.earliest_start = start_override[i]
            else:
                if not node.predecessors:
                    node.earliest_start = node.plan_start or self.cal.next_workday(date.today())
                else:
                    max_finish: date | None = None
                    for e in node.predecessors:
                        pred = self.nodes[e.predecessor_id]
                        ef = pred.earliest_finish
                        if ef is None:
                            continue
                        if e.dep_type == "FS":
                            # FS: lag는 종료 후의 작업일 공백(간격). lag=0 -> 다음 작업일 시작
                            candidate = self.cal.add_workdays(ef, e.lag + 1)
                        else:
                            candidate = self.cal.add_workdays(ef, e.lag)
                        if max_finish is None or candidate > max_finish:
                            max_finish = candidate
                    node.earliest_start = max_finish or self.cal.next_workday(date.today())
            node.earliest_finish = self.cal.add_workdays(node.earliest_start, self._duration_days(node) - 1)
            if project_ef is None or node.earliest_finish > project_ef:
                project_ef = node.earliest_finish
        return project_ef or self.cal.next_workday(date.today())

    def backward_pass(self, project_ef: date | None = None) -> None:
        """후방 패스: 각 노드의 LS/LF, Float 계산."""
        order = list(reversed(self._sorted_ids()))
        for i in order:
            node = self.nodes[i]
            if not node.successors:
                node.latest_finish = project_ef or node.earliest_finish
            else:
                min_ls: date | None = None
                for e in node.successors:
                    succ = self.nodes[e.successor_id]
                    if succ.latest_start is None:
                        continue
                    candidate = succ.latest_start
                    if e.dep_type == "FS":
                        # forward의 lag+1과 대칭
                        candidate = self.cal.add_workdays(succ.latest_start, -(e.lag + 1))
                    if min_ls is None or candidate < min_ls:
                        min_ls = candidate
                node.latest_finish = min_ls or node.earliest_finish
            node.latest_start = self.cal.add_workdays(node.latest_finish, -(self._duration_days(node) - 1))
            if node.latest_start >= node.earliest_start:
                node.total_float = float(self.cal.count_workdays(node.earliest_start, node.latest_start) - 1)
            else:
                node.total_float = -float(self.cal.count_workdays(node.latest_start, node.earliest_start) - 1)

    def free_float(self) -> None:
        for node in self.nodes.values():
            if not node.successors:
                node.free_float = 0.0
                continue
            min_es = min(self.nodes[e.successor_id].earliest_start for e in node.successors)
            if min_es >= node.earliest_finish:
                node.free_float = float(self.cal.count_workdays(node.earliest_finish, min_es) - 1)
            else:
                node.free_float = 0.0

    def compute(self, start_override: dict[int, date] | None = None) -> date:
        project_ef = self.forward_pass(start_override)
        self.backward_pass(project_ef)
        self.free_float()
        self._mark_critical()
        return project_ef

    def _mark_critical(self) -> None:
        for node in self.nodes.values():
            node.is_critical = abs(node.total_float) < 1e-6

    def critical_path_ids(self) -> list[int]:
        critical: list[int] = []
        # 결정적 순서: ID 오름차순
        for i in sorted(self.nodes):
            if self.nodes[i].is_critical:
                critical.append(i)
        return critical


def build_network(
    tasks: list[TaskNode],
    edges: list[Edge],
    cal: WorkingCalendar,
) -> CPMNetwork:
    nodes = {t.id: t for t in tasks}
    return CPMNetwork(nodes, edges, cal)