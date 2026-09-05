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

function Example({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-50 ring-1 ring-slate-100 p-3.5 text-[13px] text-slate-600 leading-relaxed">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">예시 · {title}</div>
      {children}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-brand-50 ring-1 ring-brand-100 p-3.5 text-[13px] text-slate-600 leading-relaxed">
      <div className="text-[11px] font-semibold text-brand-600 uppercase tracking-wide mb-1.5">💡 활용 팁</div>
      {children}
    </div>
  )
}

export function Manual() {
  return (
    <div className="max-w-[920px] mx-auto space-y-5 animate-fade-in">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center shrink-0">
          <IconManual size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">사용 설명서</h1>
          <p className="text-[13px] text-slate-400">Flow Plan의 화면·지표·권한·리포트와 실무 활용 예시를 함께 안내합니다.</p>
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
            ['schedule-engine', '일정 엔진 · 크리티컬 패스'],
            ['issue-risk', '이슈 · 리스크 · 현황 요약'],
            ['report', '리포트 · 이메일'],
            ['challenge', '오늘의 챌린지'],
            ['permission', '권한 · 역할'],
            ['settings', '설정'],
            ['scenario', '실무 활용 시나리오'],
            ['faq', 'FAQ · 문제 해결'],
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
              Flow Plan은 프로젝트의 <b>태스크 · 일정 · 진척 · 리스크 · 리포트</b>를 한 화면에서 관리하는 도구입니다.
            </p>
            <ul className="space-y-1.5">
              <Li><b>빠른 로그인</b> — 로그인 화면의 계정 버튼을 누르면 아이디/비밀번호가 자동 입력됩니다. <b>시스템 관리자</b>(admin)·<b>PM</b>(pm_a)·<b>멤버</b>(dev_back) 등 역할별로 접속해 권한 차이를 직접 확인해볼 수 있습니다.</Li>
              <Li>사이드바에서 <b>프로젝트</b>를 선택 → 프로젝트 카드를 클릭하면 <b>대시보드</b>가 열립니다.</Li>
              <Li>대시보드의 각 카드 우상단 <b>(i)</b> 아이콘에 마우스를 올리면 항목의 의미가 툴팁으로 표시됩니다.</Li>
              <Li><b>전체 일정 보기</b>(또는 태스크 상세의 뒤로가기 버튼)로 프로젝트 현황판·일정(Gantt)·태스크 상세를 오갈 수 있습니다.</Li>
            </ul>
            <Example title="처음 접속해서 보는 흐름">
              ① 프로젝트 목록에서 “Project A - 스마트팩토리 MES 구축” 클릭 → ② 대시보드에서 진척률·S-Curve·리스크 확인 →
              ③ “전체 일정 보기”로 Gantt에서 태스크별 계획/실제 바와 크리티컬 패스를 확인 → ④ 담당 태스크를 클릭해 상세 페이지에서
              진척률 기록·일정 편집.
            </Example>
          </div>
        </div>
      </section>

      {/* 2. 프로젝트 · 태스크 */}
      <section id="project-task" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="2. 프로젝트 · 태스크" icon={<IconCalendar size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li><b>프로젝트</b> — 이름·설명·상태와 담당 PM, 프로젝트 캘린더(근무일·휴일)를 가집니다. 프로젝트 화면에서 생성·편집합니다.</Li>
              <Li><b>태스크</b> — 계획 시작/종료일, 작업량(시간), 담당자, 상태(미착수/진행 중/지연/차단/완료), 진척률, 기준선(Baseline) 일정을 가집니다.</Li>
              <Li><b>하위 태스크(WBS)</b> — 부모 태스크 아래에 하위 태스크를 만들 수 있으며, 부모의 진척률은 자식의 진척률을 작업량 가중 평균한 값으로 <b>자동 집계</b>됩니다.</Li>
              <Li><b>그룹</b> — 태스크를 기획/HW 설계/SW 개발 등으로 분류합니다.</Li>
              <Li><b>마일스톤</b> — 프로젝트의 중간 목표(착수·설계 완료·개발 완료·오픈)로, 날짜와 진행률을 직접 관리합니다.</Li>
              <Li><b>의존성</b> — “A가 끝난 뒤 B가 시작” 형태의 선행/후행 관계(F.S, lag 일수 포함)를 설정합니다.</Li>
              <Li><b>담당자</b> — 태스크에 여러 명을 배정할 수 있고, 담당자의 작업량은 사용자별 작업량으로 집계됩니다.</Li>
            </ul>
            <Example title="WBS와 의존성 구성 예시">
              부모 “MES 백엔드 개발”(10/26~11/20) 아래에 하위 “시스템 아키텍처 설계 → DB 설계 → 인증·권한 모듈”을 순차 배치하고,
              “설비 인터페이스 명세 → 게이트웨이 펌웨어 → MES 백엔드”로 의존성을 연결하면 일정 엔진이 임계 경로를 자동 계산합니다.
            </Example>
            <Tip>
              하위 태스크를 만들 때는 부모 태스크 상세의 <b>“+ 하위 Task 추가”</b>를 사용합니다. 부모의 계획일 범위는 자식들의 범위를 자동으로 포함합니다.
            </Tip>
          </div>
        </div>
      </section>

      {/* 3. 진척률 지표 */}
      <section id="progress" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="3. 진척률 지표" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
            <div>
              <b>실제 진척률</b> — 각 태스크의 실제 진척률(effective progress)을 <b>작업량으로 가중 평균</b>한 값입니다.
              작업량이 큰 태스크가 전체 수치에 더 큰 영향을 줍니다.
            </div>
            <div>
              <b>계획 진척률</b> — 계획 일정을 <b>작업일 경과 비율</b>로만 페이싱한 기준값입니다. 태스크의 실제 완료 여부와 무관하게
              “계획 구간 안에서 오늘까지 진행됐어야 할 비율”을 계산합니다. 프로젝트 시작 전 0%, 마지막 계획 종료일에 100%가 됩니다.
            </div>
            <div>
              <b>Progress Gap</b> — <code className="text-xs bg-surface-100 px-1 py-0.5 rounded">계획 − 실제</code>.
              양수 = 실제가 계획을 못 따라감(<b>지연</b>), 음수 = <b>계획보다 빠름</b>.
            </div>
            <div>
              <b>태스크 상세의 4가지 진척률</b> — <code>Schedule</code>(일정 경과 기준) · <code>Work</code>(작업량 기준) ·
              <code>User Adj</code>(사용자 보정값) · <code>Effective</code>(실제 반영되는 최종값). Effective = 실제 관리 대상입니다.
            </div>
            <div className="text-xs text-slate-400">
              계산은 잎(leaf) 태스크만 사용합니다. 부모 태스크는 자식 작업량 합산이라 이중 계상을 막기 위해 제외됩니다.
              차트에 그리는 네 선의 차이는 <a href="#curve" className="text-brand-600 hover:underline">4. 진척 곡선</a>을 보세요.
            </div>
            <Example title="진척률 읽는 법">
              계획 9.4% vs 실제 19.1% → Gap <b>−9.7</b> = 실제가 계획보다 빠름(양호). 반대로 계획 40% vs 실제 35% → Gap
              <b> +5.0</b> = 5% 포인트 지연으로, 원인 파악이 필요한 상태입니다.
            </Example>
          </div>
        </div>
      </section>

      {/* 4. 진척 곡선 */}
      <section id="curve" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="4. 진척 곡선 (S-Curve) — 선 읽는 법" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              가로는 <b>날짜</b>, 세로는 <b>누적 진척률(%)</b>입니다. 네 선은 모양이 비슷해 보여도 <b>묻는 질문이 다릅니다.</b>
              같은 날의 %를 서로 바꿔 읽으면 안 됩니다. 오늘을 가리키는 세로 점선 위의 숫자가 대시보드 상단 KPI와 같습니다.
            </p>

            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-slate-400 bg-surface-50">
                    <th className="py-2 px-3 font-semibold">선</th>
                    <th className="py-2 px-3 font-semibold">한 줄 정의</th>
                    <th className="py-2 px-3 font-semibold">무엇으로 계산하나</th>
                    <th className="py-2 px-3 font-semibold">언제 바뀌나</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">Baseline<br /><span className="font-normal text-[11px] text-slate-400">회색 점선</span></td>
                    <td className="py-2.5 px-3">맨 처음 약속한 일정 페이스</td>
                    <td className="py-2.5 px-3">태스크를 만들 때 저장된 <b>최초 계획 시작~종료</b>의 작업일 경과 비율</td>
                    <td className="py-2.5 px-3">일정을 고쳐도 <b>거의 안 바뀜</b> (비교용 기준선)</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">계획<br /><span className="font-normal text-[11px] text-slate-400">옅은 회색 점선</span></td>
                    <td className="py-2.5 px-3">지금 적어 둔 일정대로면 그날까지 몇 %여야 하나</td>
                    <td className="py-2.5 px-3">현재 <b>계획 시작~종료</b>에서 그날까지 지난 작업일 ÷ 전체 작업일. 실제 완료량은 보지 않음</td>
                    <td className="py-2.5 px-3">계획 날짜를 수정할 때</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">실제<br /><span className="font-normal text-[11px] text-slate-400">검은 실선 (2배 두께)</span></td>
                    <td className="py-2.5 px-3">지금 일이 얼마나 끝났나</td>
                    <td className="py-2.5 px-3">각 태스크 <b>진척률(effective)</b>을 작업량으로 가중 평균. 과거는 <b>그날 저장한 스냅샷</b></td>
                    <td className="py-2.5 px-3">진척을 올리거나 현황판을 열어 그날 값이 기록될 때</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">예측<br /><span className="font-normal text-[11px] text-slate-400">빨간 점선</span></td>
                    <td className="py-2.5 px-3">이 상태면 앞으로 언제 끝나나</td>
                    <td className="py-2.5 px-3">오늘 <b>실제 %</b>에서 시작해, 남은 일·의존성(CPM)·예상 지연만큼 계획을 오른쪽으로 민 곡선. AI 추측이 아님</td>
                    <td className="py-2.5 px-3">진척·일정·선행 관계가 바뀔 때</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <div className="font-semibold text-ink-900 mb-1.5">오늘 숫자만 먼저 읽기</div>
              <ul className="space-y-1.5">
                <Li>계획 % = “현재 일정대로면 오늘은 여기까지여야 한다.” 날짜만 지나면 올라갑니다. 일을 안 해도 올라갈 수 있습니다.</Li>
                <Li>실제 % = “지금 완료된 일의 비율.” 진척을 안 올리면 그대로입니다.</Li>
                <Li>실제 &gt; 계획 = 일정 페이스보다 <b>일을 더 해 둔 상태</b>(앞섬). 실제 &lt; 계획 = <b>일정만 지나고 일은 덜 된 상태</b>(지연).</Li>
                <Li>Baseline이 계획보다 아래면, 지금 계획은 최초안보다 앞에 있거나 작업이 앞구간에 몰려 있다는 뜻입니다.</Li>
              </ul>
            </div>

            <Example title="오늘 실제 19.1% · 계획 10.8% 이면">
              날짜상 계획보다 일을 더 해 두었다는 뜻입니다. “그래프가 위로 가서 지연”이 아닙니다.
              실제선이 계획선 <b>위</b> = 앞섬, <b>아래</b> = 지연입니다.
            </Example>

            <div>
              <div className="font-semibold text-ink-900 mb-1.5">실제선이 가로로 멈추는 이유</div>
              <p>
                실제선은 매일 자동으로 오르지 않습니다. <b>일별 스냅샷</b>이 있는 날만 값이 바뀌고, 없는 날은 직전 %를 그대로 이어 그립니다.
                가로선은 “현장이 멈췄다”고 단정할 수 없고, <b>그 기간에 새 진척이 기록되지 않았다</b>는 뜻에 가깝습니다.
              </p>
            </div>

            <div>
              <div className="font-semibold text-ink-900 mb-1.5">예측선이 가로로 보이거나, 확대하면 이상해 보이는 이유</div>
              <ul className="space-y-1.5">
                <Li>예측은 오늘 실제에서 시작해 <b>프로젝트 끝까지</b> 이어집니다. 지연된 계획의 초반 %로 떨어지지 않습니다.</Li>
                <Li>지연이 있으면 계획 곡선을 그만큼 오른쪽으로 밉니다. 지연이 0이면 예측과 계획은 같은 모양입니다.</Li>
                <Li>차트를 드래그해 확대한 화면은 <b>전체 일정이 아닙니다.</b> 더블클릭 또는 전체보기로 처음~완료까지를 봐야 100%와 지연 구간이 맞습니다.</Li>
              </ul>
            </div>

            <div>
              <div className="font-semibold text-ink-900 mb-1.5">그 밖에 보이는 표시</div>
              <ul className="space-y-1.5">
                <Li><b>지연 구간 음영</b> — 계획 완료일부터 예측 완료일까지입니다. 확대 화면의 오늘 근처 색칠은 실제 영역 채움일 수 있으니, 음영 하단의 “계획 ○○ / 예측 ○○” 날짜를 확인하세요.</Li>
                <Li><b>마일스톤</b> — 계획 곡선 높이에 찍힌 중간 목표(착수·설계 완료·오픈 등). 예측 마일스톤은 같은 높이에서 날짜만 지연일만큼 오른쪽에 있습니다.</Li>
                <Li><b>오픈이 100%</b>에 있는 것은 “입력된 계획 종료일 기준으로 일이 끝나는 날”입니다. 예측 완료일이 더 오른쪽이면, 엔진이 남은 일·의존성으로 끝을 미룬 것입니다.</Li>
              </ul>
            </div>

            <Tip>
              드래그로 구간 확대, 확대 후 드래그로 이동, Shift+드래그로 다시 확대, +/− · 더블클릭 · 전체보기로 복귀합니다.
              선 의미가 헷갈리면 이 설명서 목차 <b>4. 진척 곡선</b>을 다시 보면 됩니다.
            </Tip>
          </div>
        </div>
      </section>

      {/* 5. 일정 엔진 */}
      <section id="schedule-engine" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="5. 일정 엔진 · 크리티컬 패스" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>일정은 <b>CPM(크리티컬 패스)</b> 엔진으로 결정적으로 계산됩니다. 태스크 계획일·작업량·의존성·캘린더만 입력하면 시작/종료일, 여유일(float), 임계 경로가 산출됩니다.</Li>
              <Li><b>크리티컬 패스</b> — 의존성을 따라 프로젝트 완료일을 결정하는 경로입니다. 이 경로의 태스크가 하루 늦어지면 전체 종료일도 하루 늦어집니다. Gantt와 태스크 상세에 “크리티컬 패스” 배지로 표시됩니다.</Li>
              <Li><b>float(여유일)</b> — 태스크가 늦어져도 전체 일정에 영향이 없는 여유 일수. 0이면 임계 태스크입니다.</Li>
              <Li><b>예측 완료일·예상 지연</b> — 현재 진척률(남은 작업량)을 반영해 산출됩니다. 계획 완료일은 <b>오픈 마일스톤</b> 기준, 예상 완료일은 오픈 + 지연일 기준으로 표시됩니다.</Li>
            </ul>
            <Example title="크리티컬 패스 활용 예시">
              프론트엔드 → 통합 테스트 → 성능·부하 → UAT → 배포 → 운영전환 경로가 크리티컬 패스라면, “통합 테스트”가 늦어지면
              오픈이 그만큼 밀립니다. 반대로 “알림·이벤트 서비스”처럼 float가 있는 태스크는 일부 지연돼도 완료일이 바뀌지 않습니다.
            </Example>
            <div className="text-xs text-slate-400 mt-1">
              수치는 새로고침 시 재계산됩니다. 순환 의존성 등 일정 계산 충돌이 있으면 409 오류로 안내됩니다.
            </div>
          </div>
        </div>
      </section>

      {/* 6. 이슈·리스크 */}
      <section id="issue-risk" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="6. 이슈 · 리스크 · 현황 요약" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li><b>이슈 태스크</b> — 문제가 등록된 태스크. 증상·원인·영향·해결 방법·해결 예정일을 기록합니다. 해결 예정일이 지나면 리스크로 반영됩니다.</Li>
              <Li><b>위험도</b> — NORMAL(정상)/WARNING(지연 위험)/CRITICAL(심각) 3단계. 지연·예측 초과·이슈 해결 지연을 종합해 부여됩니다.</Li>
              <Li><b>프로젝트 현황 요약</b> — 엔진이 계산한 지연 일수·완료 예측을 숫자로 보여 줍니다. 크리티컬 패스는 여유 0일이라, 그 노드가 N일 늦으면 프로젝트 완료일도 밀립니다. 빨간 경고 박스는 역할·담당 Task별로 다릅니다.</Li>
              <Li><b>오늘의 챌린지</b> — 같은 데이터로 “오늘 해야 할 일”을 개인별로 생성합니다(아래 8번).</Li>
            </ul>
            <Example title="리스크 대응 순서">
              대시보드에서 CRITICAL 항목(예: 크리티컬 패스 Task 지연) → 현황 요약의 태스크 링크로 상세 이동 →
              상세의 “진행 기록” 탭에서 지연 원인·대책·예상 추가 일수를 입력 → 챌린지에서 답변 완료 처리.
            </Example>
          </div>
        </div>
      </section>

      {/* 7. 리포트 */}
      <section id="report" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="7. 리포트 · 이메일" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li><b>데일리 리포트</b> — 담당자의 태스크 진행·이슈·다음 계획을 개인별로 요약합니다. “리포트” 화면에서 생성·확인할 수 있습니다.</Li>
              <Li><b>주간 리포트</b> — 프로젝트 단위로 생성됩니다. 프로젝트 진척·지연·크리티컬 패스·이슈를 요약하며, 프로젝트를 선택한 뒤 생성합니다.</Li>
              <Li>생성된 리포트는 <b>관리자에게 이메일 발송</b>할 수 있습니다. 발송에는 관리자 설정의 <b>SMTP</b> 정보가 필요합니다.</Li>
              <Li>요청 횟수가 제한됩니다(생성 10회/5분, 발송 5회/5분).</Li>
            </ul>
            <Example title="주간 보고 흐름">
              ① 리포트 화면 → 주간 탭 → 프로젝트 선택 → <b>“+ Weekly Report 생성”</b> → ② 내용 확인(진척·지연·이슈) →
              ③ PM 또는 관리자가 <b>“관리자에게 이메일 발송”</b>으로 팀에 공유.
            </Example>
          </div>
        </div>
      </section>

      {/* 8. 챌린지 */}
      <section id="challenge" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="8. 오늘의 챌린지" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>내가 담당한 태스크 중 <b>지연 · 이슈 · 크리티컬 패스 · 진척률 미갱신</b> 등 조치가 필요한 항목을 자동으로 골라내어,
                우선순위(긴급/주의/관심)와 함께 <b>오늘의 액션 아이템</b>으로 제시합니다.</Li>
              <Li>“오늘의 챌린지” 화면에서 <b>+ 챌린지 생성</b> 버튼으로 생성하고, 각 카드에 <b>답변</b>을 입력하면 완료 처리됩니다. 답변은 개인별로 기록됩니다.</Li>
              <Li>카드의 “관련 Task”를 클릭하면 해당 태스크 상세로 이동해 바로 조치할 수 있습니다.</Li>
            </ul>
            <Example title="챌린지 활용 예시">
              “크리티컬 패스 Task가 3일 지연 예상됩니다. 지연 원인을 입력해주세요.” → 카드의 관련 Task로 이동해
              상세의 진행 기록에서 지연 원인(외부 업체 지연 등)·대책·예상 추가 일수를 기록 → 챌린지에 답변 입력 → 완료.
            </Example>
          </div>
        </div>
      </section>

      {/* 9. 권한 */}
      <section id="permission" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="9. 권한 · 역할" icon={<IconShield size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>시스템은 역할(Role) 단위의 세분화 권한(20종)을 따릅니다. 권한 수정은 관리자 설정의 <b>권한 설정</b> 탭에서 할 수 있으며, 변경 즉시 적용됩니다.</p>
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
                    <td className="py-2">태스크·일정·의존성·마일스톤·예측·리포트 발송 등 운영 전반. 사용자/역할·시스템 설정·감사로그는 제외됩니다.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3"><b>Project Member</b></td>
                    <td className="py-2 pr-3">진척률 기록 · 이슈 관리</td>
                    <td className="py-2">담당 태스크의 진척률을 기록하고 이슈를 등록·해결하는 기본 업무. 일정 수정·삭제는 불가합니다.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Example title="권한 판단 예시">
              멤버(dev_back)는 자신이 담당한 태스크의 <b>진척률을 기록</b>할 수 있지만 <b>계획 일정을 변경</b>할 수는 없습니다.
              PM(pm_a)은 프로젝트 안에서 일정 편집·의존성 설정·리포트 발송까지 할 수 있습니다.
            </Example>
          </div>
        </div>
      </section>

      {/* 10. 설정 */}
      <section id="settings" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="10. 설정" icon={<IconShield size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>좌측 메뉴의 설정에서 화면 표시를 바꿀 수 있습니다. 관리자 탭은 관리자만 보입니다.</p>
            <ul className="space-y-1.5">
              <Li><b>화면 표시</b> — 완료·지연·크리티컬 패스의 이름·색·배지 모양, 지연 표기(+N일 등), 완료 표시, 진행 막대, 밀도. 이 브라우저에만 저장됩니다.</Li>
              <Li><b>사용자 관리</b> — 사용자 생성, 역할 변경, 계정 활성화/비활성화. (관리자)</Li>
              <Li><b>권한 설정</b> — 역할별 20종 권한을 체크박스로 부여/회수. 저장 즉시 반영됩니다.</Li>
              <Li><b>이메일(SMTP)</b> — 리포트 발송에 사용하는 메일 서버(호스트·포트·계정·암호·보안 방식)를 설정합니다.</Li>
              <Li><b>리포트 발송</b> — 데일리/주간 리포트의 이메일 발송 토글을 관리합니다.</Li>
              <Li><b>감사로그</b> — 로그인·권한 변경·일정 변경 등의 감사 기록을 열람합니다.</Li>
            </ul>
          </div>
        </div>
      </section>

      {/* 11. 실무 활용 시나리오 */}
      <section id="scenario" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="11. 실무 활용 시나리오" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">시나리오 A — 매일 아침 진척 확인</div>
              <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                <li>대시보드에서 <b>Progress Gap</b>과 <b>위험도</b>를 확인합니다.</li>
                <li>S-Curve에서 실제선이 계획선보다 아래인 구간을 드래그로 확대해 어느 시점부터 지연됐는지 봅니다.</li>
                <li>오늘의 챌린지에서 “조치 필요” 항목을 확인하고, 담당 태스크로 이동해 진행 기록을 갱신합니다.</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">시나리오 B — 지연 발생 시 대응</div>
              <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                <li>지연 태스크 상세에서 <b>일정·상태 편집</b>으로 계획 종료일을 조정하고 변경 사유를 기록합니다(변경 이력에 남습니다).</li>
                <li><b>진행 기록</b> 탭에서 지연 원인 카테고리·대책·예상 추가 일수를 입력합니다.</li>
                <li>변경 후 <b>예측 완료일</b>이 어떻게 달라지는지 S-Curve의 예측선(지연 반영)으로 확인합니다.</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">시나리오 C — 주간 보고 준비</div>
              <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                <li>리포트 화면 → 주간 탭 → 프로젝트 선택 → <b>Weekly Report 생성</b>.</li>
                <li>생성된 리포트에서 진척·지연·크리티컬 패스·이슈를 검토합니다.</li>
                <li>문제가 있는 항목은 현황 요약/태스크 링크로 들어가 상세 근거를 확인한 뒤, PM이 <b>이메일 발송</b>으로 팀에 공유합니다.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* 12. FAQ */}
      <section id="faq" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="12. FAQ · 문제 해결" icon={<IconManual size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
            <div>
              <b>Q. Baseline · 계획 · 실제 · 예측이 뭐가 다른가요?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                Baseline은 최초 일정, 계획은 지금 적어 둔 날짜 페이스, 실제는 완료된 일의 %, 예측은 앞으로 끝나는 시점입니다.
                자세한 표는 위 <a href="#curve" className="text-brand-600 hover:underline">4. 진척 곡선</a>을 보세요.
              </div>
            </div>
            <div>
              <b>Q. S-Curve의 예측선이 계획선과 왜 다른가요?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">예측선은 오늘 실제에서 시작해, 계획 곡선을 예상 지연일만큼 오른쪽으로 민 전망입니다. 지연이 없으면 계획과 같은 모양입니다. AI가 그린 선이 아닙니다.</div>
            </div>
            <div>
              <b>Q. 실제선·예측선이 가로로만 가는데 일이 멈춘 건가요?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">실제는 스냅샷이 있는 날만 바뀌고 없으면 직전 %를 유지합니다. 예측은 짧은 기간만 확대하면 기울기가 거의 안 보입니다. 전체보기로 프로젝트 끝까지를 확인하세요.</div>
            </div>
            <div>
              <b>Q. 계획 완료일과 오픈 마일스톤의 날짜가 다른 이유는?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">계획선 100%는 입력된 계획 종료일 기준이고, 예측 완료일은 남은 일·의존성으로 끝을 다시 계산한 값입니다. 음영 하단의 계획/예측 날짜를 기준으로 읽으세요.</div>
            </div>
            <div>
              <b>Q. 일정을 저장했는데 오류(409)가 나요.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">순환 의존성(예: A→B, B→A)이나 날짜 역전(시작일 &gt; 종료일)이 있으면 발생합니다. 의존성/날짜를 확인 후 다시 저장하세요.</div>
            </div>
            <div>
              <b>Q. 이메일 발송이 안 돼요.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">관리자 설정의 SMTP 정보가 올바른지 확인하세요. 발송 요청 횟수(5회/5분) 제한도 확인합니다.</div>
            </div>
            <div>
              <b>Q. 챌린지가 생성되지 않아요.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">챌린지는 “내가 담당하고 조치가 필요한” 태스크가 있을 때 생성됩니다. 담당 태스크가 없거나 모든 태스크가 정상이면 항목이 없을 수 있습니다.</div>
            </div>
            <div>
              <b>Q. 프로젝트 현황 요약이 안 보여요.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">요약은 최초 1회 생성 후 표시됩니다. 새로고침하면 생성되며, 일정 화면에서도 다시 생성할 수 있습니다.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}