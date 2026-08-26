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
        raise NotImplementedError("Clova Studio 연동은 gateway URL 설정 필요. OpenAI/Anthropic/Mock 사용 권장.")


def get_ai_provider() -> AIProvider:
    provider = settings.ai_provider.lower()
    if provider == "openai" and settings.openai_api_key:
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    if provider == "anthropic" and settings.anthropic_api_key:
        return AnthropicProvider(settings.anthropic_api_key, settings.anthropic_model)
    if provider == "clova" and settings.clova_api_key:
        return ClovaProvider(settings.clova_api_key, settings.clova_gateway_url)
    return MockAIProvider()