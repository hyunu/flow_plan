import os
import tempfile

os.environ["AI_PROVIDER"] = "mock"  # 테스트는 외부 AI를 호출하지 않는다
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test_flowplan.db"