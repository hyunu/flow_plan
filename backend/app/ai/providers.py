from __future__ import annotations

from app.ai.base import AIProvider, MockAIProvider
from app.core.config import settings


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str):
        from openai import OpenAI

        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate(self, prompt: str, system: str | None = None, max_tokens: int = 1500) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
        )
        return resp.choices[0].message.content or ""


class AnthropicProvider(AIProvider):
    name = "anthropic"

    def __init__(self, api_key: str, model: str):
        import anthropic

        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def generate(self, prompt: str, system: str | None = None, max_tokens: int = 1500) -> str:
        kwargs = {"max_tokens": max_tokens, "messages": [{"role": "user", "content": prompt}]}
        if system:
            kwargs["system"] = system
        resp = self.client.messages.create(model=self.model, **kwargs)
        return "".join(b.text for b in resp.content if b.type == "text")


class ClovaProvider(AIProvider):
    """Clova Studio(HyperClova)용 스텁. API 연동은 환경변수 준비 시 활성화."""

    name = "clova"

    def __init__(self, api_key: str, gateway_url: str | None):
        self.api_key = api_key
        self.gateway_url = gateway_url

    def generate(self, prompt: str, system: str | None = None, max_tokens: int = 1500) -> str:
        raise NotImplementedError("Clova Studio 연동은 gateway URL 설정 필요. OpenAI/Anthropic/Gemini/Mock 사용 권장.")


class GeminiProvider(AIProvider):
    """Google Gemini (Google AI Studio) — REST API 직접 호출(httpx).

    API Key는 서버에만 존재하며 클라이언트로 노출하지 않는다(§43.8).
    """

    name = "gemini"
    BASE = "https://generativelanguage.googleapis.com/v1beta"

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str, system: str | None = None, max_tokens: int = 1500) -> str:
        import httpx
        import re
        import time

        # Gemini는 thinking 모델로, maxOutputTokens 예산에 생각 토큰이 포함된다.
        # 실제 출력이 잘리지 않도록 요청 토큰을 넉넉히 잡는다.
        budget = max(8000, max_tokens * 4)

        payload: dict = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": budget},
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        url = f"{self.BASE}/models/{self.model}:generateContent"
        headers = {"x-goog-api-key": self.api_key}

        resp = None
        for attempt in range(3):
            resp = httpx.post(url, headers=headers, json=payload, timeout=settings.ai_timeout_seconds)
            if resp.status_code != 429 and resp.status_code < 500:
                break
            # 쿼터/서버 오류: Retry-After 또는 짧은 백오프 후 재시도 (응답 지연 최소화)
            delay = 2 * (attempt + 1)
            try:
                retry_after = int(resp.headers.get("Retry-After", ""))
                if retry_after:
                    delay = min(retry_after, 8)
            except (TypeError, ValueError):
                pass
            time.sleep(delay)

        if resp is None or resp.status_code >= 400:
            raise RuntimeError(f"Gemini API 오류({resp.status_code if resp else '?'}): {resp.text[:300] if resp else ''}")
        data = resp.json()
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"Gemini 응답 파싱 실패: {str(data)[:300]}")

        # 마크다운 코드블록(```json ... ```)이 감싼 경우 제거
        m = re.match(r"^```(?:json|text)?\s*\n?(.*?)(?:\n?```)?\s*$", text, re.S)
        if m:
            text = m.group(1)
        return text.strip()


def get_ai_provider() -> AIProvider:
    provider = settings.ai_provider.lower()
    if provider == "openai" and settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    if provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicProvider(settings.anthropic_api_key, settings.anthropic_model)
    if provider == "clova" and settings.clova_api_key:
        return ClovaProvider(settings.clova_api_key, settings.clova_gateway_url)
    if provider == "gemini" and settings.gemini_api_key:
        return GeminiProvider(settings.gemini_api_key, settings.gemini_model)
    return MockAIProvider()