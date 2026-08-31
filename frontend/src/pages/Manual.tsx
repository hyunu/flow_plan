import { IconCalendar, IconManual, IconReport, IconShield } from '../components/icons'
import { PanelHeader } from '../components/ui'

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-brand-500 shrink-0 mt-0.5">•</span>
      <span>{children}</span>
    </li>
  )
}

export function Manual() {
  return (
    <div className="max-w-[900px] mx-auto space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center shrink-0">
          <IconManual size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">사용 설명서</h1>
          <p className="text-[13px] text-slate-400">Flow Plan의 화면·지표·권한·리포트에 대한 안내입니다.</p>
        </div>
      </div>

      {/* 목차 */}
      <div className="card p-5">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">목차</div>
        <div className="grid sm:grid-cols-2 gap-1">
          {[
            ['start', '시작하기'],
            ['project-task', '프로젝트 · 태스크'],
            ['progress', '진척률 지표'],
            ['curve', '진척 곡선 (S-Curve)'],
            ['schedule-engine', '일정 계산 엔진 · Critical Path'],
            ['issue-risk', '이슈 · 리스크 · AI 요약'],
            ['report', '리포트 · 이메일'],
            ['challenge', 'Daily Challenge'],
            ['permission', '권한 · 역할'],
            ['settings', '관리자 설정'],
          ].map(([id, label], i) => (
            <a
              key={id}
              href={`#${id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-ink-700 hover:bg-surface-100 hover:text-brand-600 transition-colors"
            >
              <span className="w-5 h-5 rounded-md bg-surface-100 text-slate-400 grid place-items-center text-[11px] font-bold shrink-0">
                {i + 1}
              </span>
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* 1. 시작하기 */}
      <section id="start" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="1. 시작하기" icon={<IconManual size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              Flow Plan은 프로젝트 태스크·일정·진척·리스크를 한 화면에서 관리하는 도구입니다. 로그인 화면의
              <b> 빠른 로그인</b> 버튼으로 시스템 관리자·PM·멤버 역할로 바로 접속하거나, 계정 정보로 로그인할 수 있습니다.
            </p>
            <ul className="space-y-1.5">
              <Li>왼쪽 사이드바에서 <b>프로젝트</b>를 선택해 프로젝트 목록에 진입하고, 프로젝트 카드를 클릭하면 <b>대시보드</b>가 열립니다.</Li>
              <Li>대시보드는 프로젝트의 진척·일정·리스크를 요약해 보여주고, 각 카드의 <b>(i)</b> 아이콘 위에 마우스를 올리면 항목의 의미를 툴팁으로 확인할 수 있습니다.</Li>
              <Li><b>전체 일정 보기</b> 버튼으로 태스크 일정(Gantt)·그룹·마일스톤·의존성·이슈를 담은 일정 화면으로 이동합니다.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 2. 프로젝트 · 태스크 */}
      <section id="project-task" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="2. 프로젝트 · 태스크" icon={<IconCalendar size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li><b>프로젝트</b>는 이름·설명·상태와 담당 PM, 프로젝트 캘린더(휴일)를 가집니다. 프로젝트 화면에서 생성·편집할 수 있습니다.</Li>
              <Li><b>태스크</b>는 계획 시작/종료일, 작업량(시간), 담당자, 상태(미착수/진행 중/완료), 진척률, 기준선 일정을 가집니다.</Li>
              <Li><b>하위 태스크</b>를 만들어 WBS 계층 구조를 구성할 수 있습니다. 부모 태스크의 진척률은 자식 태스크에서 자동 집계됩니다.</Li>
              <Li><b>작업 그룹</b>으로 태스크를 분류할 수 있고, <b>마일스톤</b>은 프로젝트의 중간 목표(착수·설계 완료 등)로 진행률을 직접 관리합니다.</Li>
              <Li><b>의존성</b>(선행/후행)을 설정하면 태스크 순서가 일정 계산에 반영됩니다. 예) A 완료 후 B 시작.</Li>
              <Li>담당자가 배정된 태스크의 작업량은 <b>사용자별 작업량</b>으로 집계됩니다.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. 진척률 지표 */}
      <section id="progress" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="3. 진척률 지표" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
            <div>
              <b>전체 진척률</b> — 각 태스크의 실제 진척률(effective progress)을 <b>작업량으로 가중 평균</b>한 값입니다.
              작업량이 큰 태스크가 전체 수치에 더 큰 영향을 줍니다.
            </div>
            <div>
              <b>계획 진척률</b> — 계획 일정을 <b>시간 경과(작업일)만으로 페이싱</b>한 기준값입니다. 태스크의 실제 완료 여부와
              무관하게 “계획 구간 안에서 오늘까지 진행됐어야 할 비율”을 작업량 가중 평균으로 계산합니다.
              프로젝트 시작 전까지는 0%, 마지막 계획 종료일에 정확히 <b>100%</b>가 됩니다.
            </div>
            <div>
              <b>Progress Gap</b> — <code className="text-xs bg-surface-100 px-1 py-0.5 rounded">계획 진척률 − 실제 진척률</code> 입니다.
              양수면 실제가 계획을 따라가지 못하는 <b>지연</b> 상태, 음수면 <b>계획 이상 진행</b> 상태를 뜻합니다.
            </div>
            <div className="text-xs text-slate-400">
              지표는 잎(leaf) 태스크만 사용해 계산합니다. 부모 태스크는 자식 작업량을 합산한 집계치라 이중 계상을 막기 위해 제외됩니다.
            </div>
          </div>
        </div>
      </section>

      {/* 4. 진척 곡선 */}
      <section id="curve" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="4. 진척 곡선 (S-Curve)" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>가로는 날짜, 세로는 누적 진척률(%)입니다.</p>
            <ul className="space-y-1.5">
              <Li><b className="text-indigo-600">계획</b> — 계획 일정을 시간 경과로 페이싱한 곡선입니다. 프로젝트 캘린더(휴일·요일제)를 반영하며, 오늘 지점의 값은 대시보드 ‘계획 진척률’과 동일하고 마지막 계획 종료일에 100%에 도달합니다.</Li>
              <Li><b className="text-slate-400">Baseline</b> — 기준선 일정이 설정된 경우 비교용으로 표시됩니다.</Li>
              <Li><b className="text-emerald-600">실제</b> — 실제 진척 작업량을 태스크 시작일~오늘 구간에 배분해 누적한 곡선입니다.</Li>
              <Li><b className="text-amber-600">예측</b> — 오늘 실적부터 예측 완료일까지 100%로 이어지는 전망입니다.</Li>
              <Li><b>노란 음영 구간</b>은 계획 완료일 이후 예측 완료일까지의 <b>지연 구간</b>입니다.</Li>
              <Li>새로고침 버튼으로 최신 진척률을 다시 불러옵니다.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 5. 일정 엔진 */}
      <section id="schedule-engine" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="5. 일정 계산 엔진 · Critical Path" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>일정은 <b>CPM(Critical Path Method)</b> 엔진으로 결정적으로 계산됩니다. 태스크 계획일·작업량·의존성·캘린더만 입력하면 시작/종료일, 여유일(float), 임계 경로가 산출됩니다.</Li>
              <Li><b>Critical Path</b>는 의존성을 따라 프로젝트 완료일을 결정하는 경로입니다. 이 경로의 태스크가 늦어지면 전체 종료일이 그만큼 늦어집니다.</Li>
              <Li><b>float(여유일)</b>은 해당 태스크가 시작이나 완료를 늦춰도 전체 일정에 영향이 없는 여유 일수입니다. 0이면 임계(여유 없음) 태스크입니다.</Li>
              <Li><b>예측 완료일·예상 지연</b>은 현재 진척률을 반영한 예측 일정으로 계산됩니다. 태스크가 계획보다 늦게 완료될 것으로 예상되면 예상 지연 일수를 산출합니다.</Li>
            </ul>
            <div className="text-xs text-slate-400 mt-2">수치는 화면 새로고침 시 재계산됩니다. 일정 계산 충돌(예: 순환 의존성)이 있으면 409 오류로 안내됩니다.</div>
          </div>
        </div>
      </section>

      {/* 6. 이슈·리스크 */}
      <section id="issue-risk" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="6. 이슈 · 리스크 · AI 요약" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li><b>이슈 태스크</b>는 문제가 등록된 태스크입니다. 원인·해결 예정일·해결 방법을 기록해 관리합니다. 해결 예정일이 지나면 리스크 항목으로 반영됩니다.</Li>
              <Li>대시보드의 <b>위험도</b>는 NORMAL(정상)/WARNING(지연 위험)/CRITICAL(심각)으로 표시되며, 지연·예측 초과·이슈 해결 지연을 종합해 부여됩니다.</Li>
              <Li><b>AI 현황 요약</b>은 프로젝트 데이터를 바탕으로 생성되는 자연어 요약입니다. 지연 원인·리스크 항목·권장 대처 순서를 제시합니다. 일정 화면에서도 다시 생성할 수 있습니다.</Li>
              <Li><b>예측 일정 저장(forecast)</b>은 진척 기반 예측 일정을 스냅샷으로 저장해 추후 증거로 활용할 수 있습니다.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 7. 리포트 */}
      <section id="report" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="7. 리포트 · 이메일" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li><b>데일리 리포트</b> — 담당자의 태스크 진행·이슈·다음 계획을 요약합니다. 본인 계정은 ‘리포트’ 화면에서 생성하고 확인할 수 있습니다.</Li>
              <Li><b>주간 리포트</b> — 프로젝트 단위로 생성됩니다. 프로젝트 진척·지연·Critical Path·이슈를 요약합니다.</Li>
              <Li>생성 후 <b>이메일 발송</b>이 가능하며, 발송에는 관리자 설정의 SMTP(메일 서버) 정보가 필요합니다.</Li>
              <Li>리포트 생성·발송은 일정 시간당 요청 횟수가 제한됩니다(생성 10회/5분, 발송 5회/5분).</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 8. Challenge */}
      <section id="challenge" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="8. Daily Challenge" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>매일 업무 데이터(지연·이슈·Critical Path 등)를 바탕으로 AI가 <b>오늘의 액션 아이템</b>을 생성합니다.</Li>
              <Li>‘Daily Challenge’ 화면에서 <b>챌린지 생성</b> 후 각 항목에 수행 여부를 답변합니다. 답변은 개인별로 기록됩니다.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 9. 권한 */}
      <section id="permission" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="9. 권한 · 역할" icon={<IconShield size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>시스템은 역할(Role) 단위의 세분화 권한을 따릅니다. 권한 수정은 관리자 설정의 <b>권한 설정</b> 탭에서 할 수 있으며, 변경 즉시 적용됩니다.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] mt-2 border-collapse">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-1.5 pr-3 font-semibold">역할</th>
                    <th className="py-1.5 pr-3 font-semibold">기본 권한</th>
                    <th className="py-1.5 font-semibold">설명</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  <tr>
                    <td className="py-2 pr-3"><b>System Administrator</b></td>
                    <td className="py-2 pr-3">전체 20종</td>
                    <td className="py-2">프로젝트·태스크·일정·리포트 전반과 사용자/역할, 시스템(SMTP), 감사로그까지 모두 관리합니다.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3"><b>Project Manager</b></td>
                    <td className="py-2 pr-3">17종</td>
                    <td className="py-2">태스크·일정·의존성·마일스톤·예측·리포트 발송 등 프로젝트 운영 전반. 다만 사용자/역할, 시스템 설정, 감사로그는 제외됩니다.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3"><b>Project Member</b></td>
                    <td className="py-2 pr-3">진척률 기록·이슈 관리</td>
                    <td className="py-2">담당 태스크의 진척률을 기록하고 이슈를 등록·해결하는 기본 업무. 일정 수정·삭제는 불가합니다.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              프로젝트 <b>담당 PM</b>은 해당 프로젝트 안에서 PM 수준 권한이 추가로 적용됩니다. 프로젝트·태스크·의존성·마일스톤·그룹·
              캘린더·예측·리포트에 개별 권한 키가 부여됩니다(설정 화면에서 역할×권한 매트릭스로 확인·변경).
            </div>
          </div>
        </div>
      </section>

      {/* 10. 설정 */}
      <section id="settings" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="10. 관리자 설정" icon={<IconShield size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>좌측 탭으로 구성되어 있으며 관리자만 접근할 수 있습니다.</p>
            <ul className="space-y-1.5">
              <Li><b>사용자 관리</b> — 사용자를 생성하고 역할을 변경하며 계정을 활성화/비활성화합니다. 역할을 바꾸면 권한이 즉시 적용됩니다.</Li>
              <Li><b>권한 설정</b> — 역할별로 20종 권한을 체크박스로 부여/회수합니다. ‘저장’ 시 즉시 반영되며, 로그인/새로고침한 사용자부터 새 권한이 적용됩니다.</Li>
              <Li><b>이메일(SMTP)</b> — 리포트 발송에 사용하는 메일 서버(호스트·포트·계정·암호·보안 방식)를 설정합니다.</Li>
              <Li><b>리포트 발송</b> — 데일리/위클리 리포트의 이메일 발송 토글을 관리합니다.</Li>
              <Li><b>감사로그</b> — 로그인·권한 변경·일정 변경 등의 감사 기록을 열람할 수 있습니다.</Li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}