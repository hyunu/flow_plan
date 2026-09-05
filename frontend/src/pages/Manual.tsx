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
      <div className="text-[11px] font-semibold text-brand-600 uppercase tracking-wide mb-1.5">활용 팁</div>
      {children}
    </div>
  )
}

const TOC: [string, string][] = [
  ['start', '시작하기 · 화면 구성'],
  ['project-task', '프로젝트 · 태스크'],
  ['dashboard', '현황판 · 일정(Gantt)'],
  ['progress', '진척률 지표'],
  ['curve', '진척 곡선 (S-Curve)'],
  ['schedule-engine', '일정 엔진 · 크리티컬 패스'],
  ['issue-risk', '이슈 · 리스크 · 현황 요약'],
  ['report', '리포트 · 이메일'],
  ['challenge', '오늘의 챌린지'],
  ['notice', '알림'],
  ['permission', '권한 · 역할'],
  ['settings', '설정 · 화면 표시'],
  ['scenario', '실무 활용 시나리오'],
  ['faq', 'FAQ · 문제 해결'],
]

export function Manual() {
  return (
    <div className="max-w-[920px] mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center shrink-0">
          <IconManual size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">사용 설명서</h1>
          <p className="text-[13px] text-slate-400">
            지금 화면에 있는 메뉴·버튼·권한 기준으로, 일정 엔진 숫자와 실무 흐름을 안내합니다.
          </p>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">목차</div>
        <div className="grid sm:grid-cols-2 gap-1">
          {TOC.map(([id, label], i) => (
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

      <section id="start" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="1. 시작하기 · 화면 구성" icon={<IconManual size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              Flow Plan은 프로젝트의 <b>태스크 · 3중 일정(최초계획/현재계획/실제) · 진척 · 크리티컬 패스 · 리스크 · 리포트</b>를
              한곳에서 봅니다. 완료일·지연일·진척 %는 <b>일정 엔진</b>이 계산하고, 문장 다듬기·현황 요약에만 AI를 씁니다.
            </p>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">로그인</div>
              <ul className="space-y-1.5">
                <Li>
                  로그인 화면 하단 <b>시드 계정</b> 버튼을 누르면 아이디·비밀번호가 채워집니다.{' '}
                  <b>시스템 관리자</b>(admin / admin123), <b>PM</b>(pm_a / pm123), <b>멤버</b>(dev_back / member123).
                </Li>
                <Li>
                  같은 비밀번호의 다른 멤버(dev_fe, dev_mes, plan, qa 등)는 아이디를 직접 입력하면 됩니다. 역할마다 보이는
                  프로젝트·챌린지·편집 버튼이 다릅니다.
                </Li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">왼쪽 사이드바</div>
              <ul className="space-y-1.5">
                <Li>
                  <b>프로젝트</b> · <b>오늘의 챌린지</b> · <b>리포트</b> · <b>설정</b>. 좁은 화면에서는 헤더 햄버거로 같은
                  메뉴가 열립니다.
                </Li>
                <Li>가장자리 원형 버튼으로 사이드바를 접거나 펼칩니다. 접으면 아이콘만 보이고, 올리면 이름이 뜹니다.</Li>
                <Li>하단에는 이름·역할(관리자/PM/멤버)과 <b>로그아웃</b>이 있습니다. 로그아웃은 한 번 더 확인합니다.</Li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">오른쪽 위 아이콘</div>
              <ul className="space-y-1.5">
                <Li>
                  <b>책</b> — 이 설명서. <b>달/해</b> — 다크/라이트. <b>종</b> — 알림. 설명서는 사이드바에 없습니다.
                </Li>
                <Li>종 옆 빨간 숫자는 아직 안 읽은 알림 개수입니다. 알림 동작은 <a href="#notice" className="text-brand-600 hover:underline">10. 알림</a>을 보세요.</Li>
              </ul>
            </div>
            <Example title="처음 접속 흐름">
              ① 시드 계정으로 로그인 → ② <b>프로젝트</b>에서 “Project A - 스마트팩토리 MES 구축” 클릭 → ③ 현황판에서
              진척·곡선·위험도 확인 → ④ <b>전체 일정 보기</b>로 Gantt → ⑤ 태스크를 눌러 상세에서 진척·진행 기록.
            </Example>
          </div>
        </div>
      </section>

      <section id="project-task" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="2. 프로젝트 · 태스크" icon={<IconCalendar size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <ul className="space-y-1.5">
              <Li>
                <b>내 프로젝트</b> — 관리자는 “전체 프로젝트 조회 가능”, 그 외는 “참여 중인 프로젝트”만 보입니다. 카드에는
                이름·번호·설명·상태(<b>활성</b>/<b>보관</b>)·생성일이 있고, 클릭하면 현황판으로 갑니다.
              </Li>
              <Li>
                관리자·PM만 <b>+ 새 프로젝트</b>로 이름을 넣어 만들 수 있습니다. 목록 화면에서 프로젝트를 고치는 칸은 없습니다.
              </Li>
              <Li>
                시드 예: <b>Project A - 스마트팩토리 MES 구축</b>, <b>Project B - 커머스 앱 리뉴얼</b>,{' '}
                <b>Project C - 차세대 ERP 구축</b>.
              </Li>
              <Li>
                <b>태스크</b> — 계획 시작/종료, 작업량(시간), 담당자, 상태(미착수·진행 중·지연·차단·완료), 진척, 최초계획(Baseline).
              </Li>
              <Li>
                <b>하위 태스크(WBS)</b> — 상세의 <b>+ 하위 Task 추가</b>로 만듭니다. 부모 진척은 자식 진척을 작업량으로 가중
                평균합니다. 부모 계획 기간은 자식을 포함하도록 맞춰집니다.
              </Li>
              <Li>
                <b>그룹</b> — 기획/HW 설계/SW 개발 등. 간트에서 그룹 행을 누르면 접고 펼칩니다.
              </Li>
              <Li>
                <b>마일스톤</b> — 착수·설계 완료·오픈 같은 중간 목표. 현황판 곡선과 Milestone 목록에 같이 나옵니다.
              </Li>
              <Li>
                <b>의존성</b> — “A가 끝난 뒤 B가 시작”(F.S, lag 일수). 일정 화면 <b>의존성 관리</b>에서 다룹니다.
              </Li>
              <Li>
                <b>담당자</b> — 여러 명을 넣을 수 있습니다. 마지막 한 명은 빼지 못합니다. 작업량은 사람별로 모아 현황판
                <b>사용자별 작업량</b>에 나갑니다.
              </Li>
            </ul>
            <Example title="WBS와 의존성">
              부모 “MES 백엔드 개발” 아래 “아키텍처 → DB → 인증·권한”을 두고, “설비 인터페이스 → 펌웨어 → 백엔드”로 이으면
              엔진이 크리티컬 패스를 다시 계산합니다.
            </Example>
          </div>
        </div>
      </section>

      <section id="dashboard" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="3. 현황판 · 일정(Gantt)" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">현황판</div>
              <ul className="space-y-1.5">
                <Li>
                  위쪽 KPI: <b>전체 진척률</b>, <b>계획 진척률</b>, <b>Progress Gap</b>, <b>지연 Task</b>, <b>미해결 Issue</b>,{' '}
                  <b>예상 완료일</b>, <b>예상 지연</b>(+N일 또는 <b>정상</b>). 카드 오른쪽 <b>(i)</b>에 마우스를 올리면 설명이 뜹니다.
                </Li>
                <Li>
                  위험도는 제목 옆 <b>위험도 NORMAL / WARNING / CRITICAL</b>로 표시됩니다.
                </Li>
                <Li>
                  <b>전체 일정 보기</b>로 Gantt·테이블로 갑니다. <b>지연 Task</b>·<b>Issue</b>의 <b>전체 보기</b>는 일정 화면에
                  필터를 달고 엽니다.
                </Li>
                <Li>
                  가운데: 진척 곡선, Milestone(<b>일정 보기</b>, <b>계획 완료일</b>), <b>프로젝트 현황 요약</b>.
                </Li>
                <Li>
                  현황 요약이 없으면 “AI 분석을 준비 중입니다... (새로고침 시 표시)”가 나옵니다. 준비되면{' '}
                  <b>문제점·개선책 자세히</b> / <b>간단히</b>로 접습니다.
                </Li>
                <Li>
                  아래 세 칸: <b>지연 Task</b>, <b>크리티컬 패스</b>, <b>Issue</b>. 맨 아래: <b>사용자별 작업량</b>(클릭하면 그
                  사람 담당만), <b>최근 일정 변경</b>.
                </Li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">전체 일정</div>
              <ul className="space-y-1.5">
                <Li>
                  헤더 <b>현황판으로</b>, 배지 <b>전체 일정</b>. 뷰는 <b>간트</b> / <b>테이블</b>.
                </Li>
                <Li>
                  권한이 있으면 <b>태스크 추가</b>, 간트에서 <b>의존성 관리</b>. 칩 <b>지연 Task만 표시</b>, <b>○○ 담당 Task</b>는
                  ×로 끕니다.
                </Li>
                <Li>
                  간트 막대 범례: <b>Baseline</b> · <b>계획</b> · <b>진척</b> · <b>예측</b> · <b>크리티컬</b>. 태스크 행을 누르면
                  상세로 갑니다.
                </Li>
                <Li>
                  세로 휠·핀치로 확대, 가로 스크롤·드래그로 이동. <b>전체보기</b>, + / −. 색은 설정의 화면 표시 테마를 따릅니다.
                </Li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">태스크 상세</div>
              <ul className="space-y-1.5">
                <Li>
                  위: 상태 배지, <b>크리티컬 패스</b>, 지연, 번호. 권한이 있으면 <b>일정·상태 편집</b>.
                </Li>
                <Li>
                  메타: <b>그룹</b>, <b>담당자</b>, <b>계획 기간</b>, <b>작업량</b>, <b>예상 완료</b>.
                </Li>
                <Li>
                  진척 네 칸: <b>Schedule</b>(일정 기준) · <b>Work</b>(작업량) · <b>User Adj</b>(보정) · <b>Effective</b>(최종).
                  일정 비교: Baseline(고칠 수 없음) · Current Plan · Actual · Forecast.
                </Li>
                <Li>
                  PM은 계획 시작/종료를 고칩니다. 멤버는 실제 시작/종료, 작업량, 상태, <b>진척률 보정</b>과 진행 기록만 고칩니다.
                  저장 시 <b>변경 사유</b>를 남기면 변경 이력에 들어갑니다.
                </Li>
                <Li>
                  탭 <b>진행 기록</b> / <b>변경 이력</b>. 진행 기록: 수행 내용, 현재 상황, 문제점, 지연 원인 카테고리(요구사항
                  변경·외부 업체 지연 등), 대책, 예상 추가 일수, 다음 계획.
                </Li>
                <Li>
                  오른쪽: 담당자 추가/삭제, <b>+ 하위 Task 추가</b>.
                </Li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="progress" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="4. 진척률 지표" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
            <div>
              <b>실제(전체) 진척률</b> — 각 태스크 Effective를 <b>작업량으로 가중 평균</b>합니다. 큰 태스크가 숫자에 더 많이
              들어갑니다.
            </div>
            <div>
              <b>계획 진척률</b> — 현재 계획 시작~종료의 <b>작업일 경과 비율</b>입니다. 일을 안 해도 날짜가 지나면 올라갈 수
              있습니다. 시작 전 0%, 마지막 계획 종료일에 100%.
            </div>
            <div>
              <b>Progress Gap</b> — <code className="text-xs bg-surface-100 px-1 py-0.5 rounded">계획 − 실제</code>. 양수 =
              일정만 지나고 일은 덜 됨(<b>지연</b>), 음수 = <b>계획보다 빠름</b>.
            </div>
            <div className="text-xs text-slate-400">
              집계는 잎(leaf) 태스크만 씁니다. 부모는 자식 합이라 빼서 두 번 세지 않습니다. 네 선의 차이는{' '}
              <a href="#curve" className="text-brand-600 hover:underline">5. 진척 곡선</a>을 보세요.
            </div>
            <Example title="숫자 읽기">
              계획 9.4% · 실제 19.1% → Gap <b>−9.7</b> = 앞섬. 계획 40% · 실제 35% → Gap <b>+5.0</b> = 5%p 지연.
            </Example>
          </div>
        </div>
      </section>

      <section id="curve" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="5. 진척 곡선 (S-Curve) — 선 읽는 법" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              가로는 <b>날짜</b>, 세로는 <b>누적 진척률(%)</b>입니다. 범례는 <b>최초계획</b> · <b>계획</b> · 실제 · <b>예측</b>
              입니다. 오늘 세로 점선 위의 숫자가 현황판 KPI와 같습니다. 색은 <a href="#settings" className="text-brand-600 hover:underline">화면 표시</a> 테마를 따릅니다.
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
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">
                      최초계획(Baseline)
                      <br />
                      <span className="font-normal text-[11px] text-slate-400">회색 점선</span>
                    </td>
                    <td className="py-2.5 px-3">맨 처음 약속한 일정 페이스</td>
                    <td className="py-2.5 px-3">만들 때 저장된 <b>최초 계획 시작~종료</b>의 작업일 경과 비율</td>
                    <td className="py-2.5 px-3">일정을 고쳐도 <b>거의 안 바뀜</b></td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">
                      계획
                      <br />
                      <span className="font-normal text-[11px] text-slate-400">옅은 회색 점선</span>
                    </td>
                    <td className="py-2.5 px-3">지금 적어 둔 일정대로면 그날까지 몇 %여야 하나</td>
                    <td className="py-2.5 px-3">현재 계획 구간에서 그날까지 지난 작업일 ÷ 전체 작업일. 실제 완료량은 보지 않음</td>
                    <td className="py-2.5 px-3">계획 날짜를 고칠 때</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">
                      실제
                      <br />
                      <span className="font-normal text-[11px] text-slate-400">검은 실선</span>
                    </td>
                    <td className="py-2.5 px-3">지금 일이 얼마나 끝났나</td>
                    <td className="py-2.5 px-3">Effective를 작업량 가중. 과거는 <b>그날 스냅샷</b></td>
                    <td className="py-2.5 px-3">진척을 올리거나 현황판을 열어 그날 값이 기록될 때</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-semibold text-ink-900 whitespace-nowrap">
                      예측
                      <br />
                      <span className="font-normal text-[11px] text-slate-400">점선</span>
                    </td>
                    <td className="py-2.5 px-3">이 상태면 앞으로 언제 끝나나</td>
                    <td className="py-2.5 px-3">오늘 실제에서 시작해 남은 일·의존성·예상 지연만큼 계획을 오른쪽으로 민 곡선. AI 추측이 아님</td>
                    <td className="py-2.5 px-3">진척·일정·선행이 바뀔 때</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="space-y-1.5">
              <Li>실제가 계획 <b>위</b> = 앞섬, <b>아래</b> = 지연. “선이 위로 가서 지연”이 아닙니다.</Li>
              <Li>
                실제선이 가로로 가면 그날 스냅샷이 없어 직전 %를 이은 경우가 많습니다. 현장이 멈췄다고 단정하지 마세요.
              </Li>
              <Li>
                예측은 오늘부터 프로젝트 끝까지입니다. 짧은 구간만 확대하면 기울기가 안 보입니다. <b>전체보기</b>로 복귀하세요.
              </Li>
              <Li>
                지연 음영은 계획 완료일~예측 완료일입니다. 아래 <b>계획 ○○ / 예측 ○○</b> 날짜를 기준으로 읽습니다.
              </Li>
            </ul>
            <Tip>
              드래그로 확대, 확대 후 드래그로 이동, Shift+드래그로 다시 확대, +/− · 더블클릭 · 전체보기. 선 색·두께는 설정
              화면 표시에서 바꿉니다.
            </Tip>
          </div>
        </div>
      </section>

      <section id="schedule-engine" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="6. 일정 엔진 · 크리티컬 패스" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>
                일정은 <b>CPM</b>으로 결정적으로 계산합니다. 계획일·작업량·의존성·근무일 캘린더만 넣으면 시작/종료, 여유일(float),
                임계 경로가 나옵니다. 화면에는 <b>크리티컬 패스</b>로 적고, 간트 범례만 <b>크리티컬</b>로 짧게 씁니다.
              </Li>
              <Li>
                이 경로의 태스크가 하루 늦으면 프로젝트 종료일도 하루 늦습니다. float가 0이면 임계입니다. float가 있으면 조금
                늦어도 오픈이 안 밀릴 수 있습니다.
              </Li>
              <Li>
                <b>예측 완료일·예상 지연</b>은 남은 작업과 의존성을 반영합니다. 계획 완료일은 입력된 종료(오픈 마일스톤) 기준입니다.
              </Li>
              <Li>숫자는 화면을 열 때 다시 계산합니다. 순환 의존성 등은 저장 시 409로 막습니다.</Li>
            </ul>
            <Example title="크리티컬 패스">
              프론트엔드 → 통합 테스트 → UAT → 배포가 임계면 “통합 테스트”가 밀리면 오픈이 밀립니다. float가 있는 “알림
              서비스”는 조금 늦어도 완료일이 안 바뀔 수 있습니다.
            </Example>
          </div>
        </div>
      </section>

      <section id="issue-risk" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="7. 이슈 · 리스크 · 현황 요약" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>
                <b>이슈 태스크</b> — 증상·원인·영향·해결·해결 예정일. 예정일이 지나면 위험도에 들어갑니다. 멤버도 이슈를
                다룰 수 있습니다(<code className="text-xs bg-surface-100 px-1 rounded">task.manage_issues</code>).
              </Li>
              <Li>
                <b>위험도</b> — NORMAL / WARNING / CRITICAL. 지연·예측 초과·이슈 기한을 같이 봅니다.
              </Li>
              <Li>
                <b>프로젝트 현황 요약</b> — 엔진 숫자(지연일·완료 예측)를 문장으로 풀어 줍니다. 빨간 강조는 역할·담당에 따라
                다릅니다. <b>이 노드 → 전체 +N일</b>처럼 크리티컬이 전체 완료를 미는 관계를 보여 줍니다.
              </Li>
            </ul>
            <Example title="대응 순서">
              현황판 CRITICAL → 태스크 상세 → 진행 기록에 원인·대책·추가 일수 → 챌린지에서 답변.
            </Example>
          </div>
        </div>
      </section>

      <section id="report" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="8. 리포트 · 이메일" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              리포트는 <b>백엔드가 매일 자동으로 만들지 않습니다.</b> 리포트 화면에서 버튼을 누르거나, 메일을 보낼 때(그날/그주
              본문이 없으면) 만들어집니다.
            </p>
            <ul className="space-y-1.5">
              <Li>
                탭 <b>일일</b> / <b>주간</b>. 일일 부제: “오늘 할 일과 지연을 한눈에”. 주간: “프로젝트 한 주의 일정 상태”.
              </Li>
              <Li>
                <b>일일</b> — 목록은 <b>로그인한 사람 것</b>만. <b>오늘 리포트 만들기</b>도 나에 대해서만. 멤버는 담당 태스크만,
                멤버십이 없는 관리자는 전체 프로젝트를 묶습니다. 같은 날 다시 만들면 덮어씁니다.
              </Li>
              <Li>
                <b>주간</b> — <b>프로젝트 선택</b> 후 <b>이번 주 리포트 만들기</b>. 프로젝트 전체 일정입니다. 만들기는 PM·관리자만
                (멤버에게는 “주간 리포트 생성은 관리자만 할 수 있습니다.”). 볼 수 있는 프로젝트면 누가 만들었든 같은 주간 본문이
                보입니다. 월요일 시작 주 기준, 같은 주면 덮어씁니다.
              </Li>
              <Li>
                PM·관리자의 <b>이메일</b>은 수신 대상에게 보냅니다(설정 <b>리포트 발송</b>의 데일리/위클리 수신). SMTP가 켜져
                있어야 합니다. 일일 메일은 사람마다 그 사람용 본문을 만들어 보냅니다.
              </Li>
              <Li>
                카드에서 마크다운을 <b>복사</b>할 수 있습니다. 생성 10회/5분, 발송 5회/5분 제한이 있습니다.
              </Li>
            </ul>
            <Example title="주간 보고">
              리포트 → 주간 → 프로젝트 선택 → <b>이번 주 리포트 만들기</b> → 진척·지연·크리티컬 패스·이슈 확인 → PM이{' '}
              <b>이메일</b>.
            </Example>
          </div>
        </div>
      </section>

      <section id="challenge" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="9. 오늘의 챌린지" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <ul className="space-y-1.5">
              <Li>
                지연·이슈 기한·크리티컬 패스·진척 공백처럼 오늘 손볼 일을 카드로 줍니다. 우선순위 <b>긴급 / 주의 / 관심</b>,
                종류는 <b>크리티컬 지연</b> · <b>크리티컬 점검</b> · <b>이슈 기한</b> · <b>일반 지연</b> · <b>진척 공백</b>.
              </Li>
              <Li>
                <b>멤버</b>는 본인 담당만, <b>PM</b>은 소속 프로젝트 전체, <b>관리자</b>(멤버십 없음)는 전 프로젝트입니다.
              </Li>
              <Li>
                서버가 떠 있는 동안 <b>약 60분마다</b> 전 사용자 챌린지를 맞춥니다. 화면에는 만들기 버튼이 없습니다. 목록을 연다고
                새로 만들지 않습니다.
              </Li>
              <Li>
                <b>관련 Task #번호</b>로 상세로 갑니다. <b>답변</b>(또는 Enter)을 내면 그날 그 종류는 다시 안 만들고, 관련 알림은
                숨깁니다. 답변한 카드는 열린 목록에서 빠집니다.
              </Li>
              <Li>빈 화면: “지금 처리할 챌린지가 없습니다. 지연·이슈가 생기면 자동으로 생깁니다.”</Li>
            </ul>
            <Example title="하루 흐름">
              종 또는 챌린지에서 “긴급 · 「작업지시 API」 크리티컬 패스가 지연됩니다” → 상세 진행 기록 → 답변.
            </Example>
          </div>
        </div>
      </section>

      <section id="notice" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="10. 알림" icon={<IconManual size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <ul className="space-y-1.5">
              <Li>
                헤더 종을 누르면 목록이 열립니다. 바깥을 누르거나 Esc, 다른 메뉴로 이동하면 닫힙니다. 항목을 누르면 읽음 처리 후
                링크(태스크·리포트)로 갑니다.
              </Li>
              <Li>
                <b>모두 읽음</b>, <b>읽은 알림 숨기기</b>. 유형 라벨: <b>오늘의 챌린지</b>, <b>일일 리포트</b>, <b>주간 리포트</b>.
                시간은 방금 / N분 전 / 어제 HH:MM 등입니다.
              </Li>
              <Li>
                챌린지 알림은 <b>새로 생긴 긴급·주의만</b> 쌓입니다. <b>관심</b>은 알림을 안 만듭니다. 관리자 전체 보기는{' '}
                <b>긴급만</b> 알립니다. 같은 태스크 링크는 한 건입니다. 화면만 새로고침해서 같은 알림을 또 넣지 않습니다.
              </Li>
              <Li>
                메일 발송 뒤에는 “일일/주간 리포트를 메일로 보냈습니다”가 생깁니다.
              </Li>
            </ul>
          </div>
        </div>
      </section>

      <section id="permission" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="11. 권한 · 역할" icon={<IconShield size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              역할마다 세부 권한(20종)이 있습니다. 관리자가 설정 <b>권한 설정</b>에서 바꾸면 바로 적용됩니다.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] mt-2 border-collapse">
                <thead>
                  <tr className="text-left text-slate-400">
                    <th className="py-1.5 pr-3 font-semibold">역할</th>
                    <th className="py-1.5 pr-3 font-semibold">기본</th>
                    <th className="py-1.5 font-semibold">화면에서 하는 일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  <tr>
                    <td className="py-2 pr-3"><b>System Administrator</b></td>
                    <td className="py-2 pr-3">20종</td>
                    <td className="py-2">모든 프로젝트, 사용자·권한·SMTP·리포트 발송, 일정·리포트 전반</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3"><b>Project Manager</b></td>
                    <td className="py-2 pr-3">17종</td>
                    <td className="py-2">소속 프로젝트의 태스크·일정·의존성·담당·주간 리포트·메일. 사용자/SMTP/권한 탭은 없음</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-3"><b>Project Member</b></td>
                    <td className="py-2 pr-3">진척 · 이슈</td>
                    <td className="py-2">담당 진척·진행 기록·이슈. 계획일 변경·주간 리포트 만들기·메일 없음</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Example title="권한">
              dev_back은 담당 태스크 진척은 올리지만 계획 종료일은 못 바꿉니다. pm_a는 같은 프로젝트에서 일정·의존성·주간
              리포트·메일을 할 수 있습니다.
            </Example>
          </div>
        </div>
      </section>

      <section id="settings" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="12. 설정 · 화면 표시" icon={<IconShield size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              사이드바 <b>설정</b>은 누구나 엽니다. <b>화면 표시</b>는 전원, 나머지 탭은 관리자만 보입니다.
            </p>
            <ul className="space-y-1.5">
              <Li>
                <b>화면 표시</b> — 이 브라우저에만 저장됩니다. 저장 버튼은 없고 고른 즉시 반영됩니다. 배지뿐 아니라{' '}
                <b>간트 막대와 진척 곡선 색</b>도 같이 바뀝니다.
              </Li>
              <Li>
                <b>색 테마</b> — 기본 · 선명 · 고대비 · 색약 배려 · 소프트 · 모노. <b>초기화</b>로 되돌립니다.
              </Li>
              <Li>
                <b>표시 방식</b> — 배지 모양(알약/둥근 사각/각진 사각), 채움(연한 면/진한 면/테두리만/글자만), 지연 표기(+N일 /
                지연 N일 / 숫자만 / 숨김), 완료 표시(배지만/체크/취소선/흐리게), 진행 막대·밀도.
              </Li>
              <Li>
                <b>표시 항목</b> — 상태 배지, 지연 표시, 크리티컬 패스, 정상 진행을 화면에서만 숨길 수 있습니다. 엔진 숫자는
                그대로입니다.
              </Li>
              <Li>
                <b>이름과 색 직접 고치기</b>, 오른쪽 <b>미리보기</b>로 확인합니다.
              </Li>
              <Li>
                관리자: <b>사용자 관리</b>(+ 새 사용자, 역할·활성), <b>권한 설정</b>, <b>이메일(SMTP)</b>(발송 활성화, TLS),{' '}
                <b>리포트 발송</b>(데일리 수신 / 위클리 수신). 감사로그는 설정 탭에 없습니다.
              </Li>
            </ul>
          </div>
        </div>
      </section>

      <section id="scenario" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="13. 실무 활용 시나리오" icon={<IconReport size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-3">
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">A — 매일 아침</div>
              <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                <li>종에서 긴급·주의를 확인하고, 필요하면 오늘의 챌린지로 갑니다.</li>
                <li>담당 프로젝트 현황판에서 Progress Gap과 위험도를 봅니다.</li>
                <li>곡선에서 실제선이 계획보다 아래인 구간을 확대해 언제부터 벌어진지 봅니다.</li>
                <li>챌린지 카드의 관련 Task에서 진행 기록을 남기고 답변합니다.</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">B — 지연이 났을 때</div>
              <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                <li>멤버는 진행 기록·진척·실제일만 고칩니다. 계획일을 바꿔야 하면 PM에게 요청합니다.</li>
                <li>PM은 <b>일정·상태 편집</b>으로 계획 종료를 조정하고 변경 사유를 남깁니다.</li>
                <li>현황판 예상 완료일·예측선이 어떻게 밀리는지 확인합니다.</li>
              </ol>
            </div>
            <div>
              <div className="font-semibold text-ink-900 mb-1.5">C — 주간 보고</div>
              <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                <li>리포트 → 주간 → 프로젝트 → <b>이번 주 리포트 만들기</b>.</li>
                <li>본문의 진척·지연·크리티컬 패스·이슈를 현황판·상세와 맞춰 봅니다.</li>
                <li>SMTP가 되어 있으면 PM이 <b>이메일</b>로 보냅니다. 수신자는 설정의 위클리 수신을 따릅니다.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <div className="card p-6">
          <PanelHeader title="14. FAQ · 문제 해결" icon={<IconManual size={15} />} />
          <div className="text-sm text-slate-600 leading-relaxed space-y-2.5">
            <div>
              <b>Q. 최초계획 · 계획 · 실제 · 예측이 뭐가 다른가요?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                최초계획은 처음 약속, 계획은 지금 적어 둔 날짜 페이스, 실제는 끝난 일의 %, 예측은 앞으로 끝나는 시점입니다.{' '}
                <a href="#curve" className="text-brand-600 hover:underline">5. 진척 곡선</a> 표를 보세요.
              </div>
            </div>
            <div>
              <b>Q. 예측선이 계획과 다른 이유는?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                오늘 실제에서 시작해 예상 지연만큼 오른쪽으로 민 선입니다. 지연이 없으면 계획과 같은 모양입니다. AI가 그린 선이
                아닙니다.
              </div>
            </div>
            <div>
              <b>Q. 실제선이 가로로만 가는데 일이 멈춘 건가요?</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                스냅샷이 있는 날만 올라갑니다. 없으면 직전 %를 유지합니다. 예측은 짧은 확대에서 기울기가 안 보일 수 있으니
                전체보기를 쓰세요.
              </div>
            </div>
            <div>
              <b>Q. 일정을 저장하면 409가 납니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">순환 의존성이나 시작일 &gt; 종료일이면 막힙니다. 의존성·날짜를 고친 뒤 다시 저장하세요.</div>
            </div>
            <div>
              <b>Q. 리포트 목록이 비어 있습니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                자동 생성이 아닙니다. 일일은 <b>오늘 리포트 만들기</b>, 주간은 PM·관리자가 <b>이번 주 리포트 만들기</b>를 눌러야
                합니다. 일일은 다른 사람 것을 볼 수 없습니다.
              </div>
            </div>
            <div>
              <b>Q. 이메일이 안 갑니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                관리자 설정에서 SMTP·발송 활성화, 수신자의 데일리/위클리 수신, 5회/5분 제한을 확인하세요.
              </div>
            </div>
            <div>
              <b>Q. 챌린지가 없거나 늦게 생깁니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                조치할 태스크가 없으면 비어 있습니다. 서버가 약 60분마다 만듭니다. 페이지를 연다고 즉시 생기지 않습니다. 답변한
                항목은 그날 같은 종류로 다시 안 나옵니다. 관리자는 관심 단계는 알림만 없고, 목록에는 있을 수 있습니다.
              </div>
            </div>
            <div>
              <b>Q. 멤버로 로그인이 멈춘 것처럼 보입니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">
                예전에는 로그인 중에 챌린지를 만들어 오래 걸렸습니다. 지금은 로그인과 알림 조회에서 만들지 않습니다. 그래도
                멈추면 서버를 다시 켠 뒤 시드 비밀번호(member123)로 시도하세요.
              </div>
            </div>
            <div>
              <b>Q. 현황 요약이 안 보입니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">처음에는 준비 중 안내가 나옵니다. 새로고침하거나 일정 화면을 열면 채워지는 경우가 많습니다.</div>
            </div>
            <div>
              <b>Q. 화면 색이 다른 사람과 다릅니다.</b>
              <div className="text-[13px] text-slate-500 mt-0.5">설정 → 화면 표시는 이 기기에만 남습니다. 다른 PC·브라우저와 공유되지 않습니다.</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
