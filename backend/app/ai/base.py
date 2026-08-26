"""AI Provider 추상화 계층.

요구사항 §47-15: 향후 AI 모델 교체가 가능하도록 AI 계층을 독립시킨다.
- 일정 계산은 이 계층에서 수행하지 않는다(엔진 담당).
- AI는 해석, 질문, 리포트 생성만 담당.
"""
from __future__ import annotations

import abc


class AIProvider(abc.ABC):
    name: str = "base"

    @abc.abstractmethod
    def generate(self, prompt: str, system: str | None = None, max_tokens: int = 1500) -> str:
        ...


class MockAIProvider(AIProvider):
    """AI 키 없이 동작하는 스텁. 실제 응답을 모사한다."""

    name = "mock"

    def generate(self, prompt: str, system: str | None = None, max_tokens: int = 1500) -> str:
        head = system or ""
        return (
            f"[Mock AI 응답]\n"
            f"주어진 데이터를 기반으로 분석한 결과입니다.\n"
            f"요청 맥락: {prompt[:200]}"
        )