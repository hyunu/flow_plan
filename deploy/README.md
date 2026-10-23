# Flow Plan — N100 배포

허브는 서버의 `/srv/services/flow-plan` 디렉터리를 빌드한다. MCP는 소스를 업로드하지 않으므로
**소스 동기화(rsync) → 스펙 검증 → 등록 → 계획 → 배포** 순서로 진행한다.

## 구성
| 항목 | 값 |
|---|---|
| 서비스 ID | `flow-plan` |
| 엔드포인트 | `http://100.85.245.79:8780` (테일넷, host 노출) |
| 컨테이너 | `backend`(FastAPI, 8000) · `ui`(Nginx, 80) |
| DB | SQLite → named volume `flow-plan-data` (`/app/data`) |
| 시크릿 | 서버 `.env`의 `SECRET_KEY`, `AI_PROVIDER` |

## 최초 배포
```bash
# 1) 소스 동기화 (서비스 디렉터리는 scaffold가 먼저 만들어야 한다)
deploy/sync.sh n100-pve-dev

# 2) 서버 .env 준비 (최초 1회)
ssh n100-pve-dev
cd /srv/services/flow-plan
umask 007
{ echo "SECRET_KEY=$(openssl rand -hex 32)"; echo "AI_PROVIDER=mock"; } > .env
chgrp hubdeploy .env && chmod 660 .env
```

그 다음 MCP: `hub_deploy_plan` → READY 확인 → `hub_deploy_apply(service_id="flow-plan", confirmed=true)`.

## 재배포
```bash
deploy/sync.sh            # 소스 동기화
```
이후 `hub_deploy_apply(service_id="flow-plan", confirmed=true)` — compose가 `up -d --build`로 반영한다.

## 주의
- **컴포넌트 이름은 허브 전체에서 고유**해야 한다. 허브 자동 매칭은 compose 서비스명으로
  서비스를 찾으므로, 다른 서비스가 쓰는 이름(예: pianosync의 `web`)과 겹치면 소속이 뒤바뀐다.
  그래서 프론트 컴포넌트는 `ui`를 쓴다.
- **`security.required_env`**: 허브가 검사하는 것은 *허브 서버 프로세스의 환경변수*다.
  앱 시크릿은 서비스 `.env`(660)에만 두고 compose `env_file`로 주입하므로 비워 둔다(pianosync 관례).
- **기본 계정**: 첫 기동 시 시드 데이터가 생성되어 `admin / admin123`이 만들어진다.
  테일넷 내부라도 비밀번호를 즉시 바꾸는 것을 권장한다(설정 → 사용자).
- **DB 초기화**: `docker compose down -v`는 `flow-plan-data` 볼륨을 지운다(모든 프로젝트 데이터 삭제).
- **AI 분석**: 키가 없으면 `AI_PROVIDER=mock`으로 두어도 일정 계산·대시보드·impact는 정상이다.
- **롤백**: `hub_deploy_rollback(deployment_id, confirmed=true)`. DB 볼륨은 롤백 대상이 아니다.
