.PHONY: setup seed backend frontend test reset

setup:            ## 최초 셋업 (백엔드 venv + 프론트 의존성 설치)
	cd backend && uv venv && uv pip install -e ".[dev]"
	cd frontend && npm install

seed:             ## 시드 데이터 생성 (보통은 서버 기동 시 자동 생성됨)
	cd backend && .venv/bin/python -m app.seed

backend:          ## 백엔드 실행 → http://localhost:8000
	cd backend && .venv/bin/uvicorn app.main:app --port 8000

frontend:         ## 프론트 실행 → http://localhost:5173
	cd frontend && npm run dev

test:             ## 백엔드 테스트 (27개)
	cd backend && .venv/bin/pytest tests/ -q

reset:            ## DB 초기화 후 재시드
	rm -f backend/data/flow_plan.db
	cd backend && .venv/bin/python -m app.seed