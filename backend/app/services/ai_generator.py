import json
import logging
import re
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIGenerator:
    """
    Centralized AI generator connecting to local or cloud LLM providers:
    - Ollama (localhost:11434 with llama, mistral, etc.)
    - LM Studio / vLLM / OpenAI-compatible local AI
    - Google Gemini (if GEMINI_API_KEY is configured)
    - OpenAI (if OPENAI_API_KEY is configured)
    """

    @staticmethod
    def is_ai_available() -> bool:
        provider = (settings.LLM_PROVIDER or "ollama").lower()
        if provider == "gemini" and settings.GEMINI_API_KEY:
            return True
        if provider == "openai" and settings.OPENAI_API_KEY:
            return True
        if provider in ("ollama", "lm_studio", "vllm", "openai_compatible", "local_ai"):
            return True
        return False

    @staticmethod
    def generate_text(
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 800,
        temperature: float = 0.2,
        timeout: float = 40.0
    ) -> Optional[str]:
        provider = (settings.LLM_PROVIDER or "ollama").lower()

        # 1. Try Ollama if configured or default
        if provider == "ollama":
            res = AIGenerator._generate_ollama(prompt, system_prompt, max_tokens, temperature, timeout)
            if res:
                return res

        # 2. Try Local OpenAI-compatible (LM Studio, vLLM, etc.)
        elif provider in ("lm_studio", "vllm", "openai_compatible", "local_ai"):
            base_url = settings.LOCAL_AI_BASE_URL if provider != "lm_studio" else "http://localhost:1234/v1"
            res = AIGenerator._generate_openai_compatible(
                base_url=base_url,
                model=settings.LOCAL_AI_MODEL or "default",
                api_key=settings.LOCAL_AI_API_KEY,
                prompt=prompt,
                system_prompt=system_prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                timeout=timeout
            )
            if res:
                return res

        # 3. Google Gemini
        elif provider == "gemini" and settings.GEMINI_API_KEY:
            res = AIGenerator._generate_gemini(prompt, system_prompt, timeout)
            if res:
                return res

        # 4. OpenAI
        elif provider == "openai" and settings.OPENAI_API_KEY:
            res = AIGenerator._generate_openai(prompt, system_prompt, max_tokens, temperature, timeout)
            if res:
                return res

        # Fallback probe to Ollama even if provider was different, if Ollama is running
        if provider != "ollama":
            res = AIGenerator._generate_ollama(prompt, system_prompt, max_tokens, temperature, timeout=20.0)
            if res:
                return res

        return None

    @staticmethod
    def generate_json(
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 1500,
        temperature: float = 0.1,
        timeout: float = 50.0
    ) -> Optional[Dict[str, Any]]:
        full_system = (system_prompt or "") + "\n\nCRITICAL: Respond ONLY with a valid JSON object. Do not include markdown code blocks, conversational text, or explanations outside the JSON."
        raw_text = AIGenerator.generate_text(
            prompt=prompt,
            system_prompt=full_system,
            max_tokens=max_tokens,
            temperature=temperature,
            timeout=timeout
        )
        if not raw_text:
            return None

        # Clean JSON markdown fences if present
        clean_json = raw_text.strip()
        if "```json" in clean_json:
            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
        elif "```" in clean_json:
            clean_json = clean_json.split("```")[1].split("```")[0].strip()

        # Extract innermost or matching JSON object
        brace_start = clean_json.find('{')
        brace_end = clean_json.rfind('}')
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            clean_json = clean_json[brace_start:brace_end + 1]

        try:
            return json.loads(clean_json)
        except Exception as e:
            logger.warning("Failed to parse JSON from AI response: %s. Response was: %s", e, raw_text[:200])
            return None

    @staticmethod
    def _generate_ollama(
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        timeout: float
    ) -> Optional[str]:
        url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        try:
            with httpx.Client(timeout=timeout) as client:
                # Find available model
                model = settings.OLLAMA_MODEL
                try:
                    tags_resp = client.get(f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/tags", timeout=3.0)
                    if tags_resp.status_code == 200:
                        models = [m.get("name") for m in tags_resp.json().get("models", []) if m.get("name")]
                        if models and model not in models:
                            model = models[0]
                except Exception:
                    pass

                payload = {
                    "model": model,
                    "prompt": prompt,
                    "system": system_prompt or "You are Clario, an elite AI document intelligence assistant.",
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens,
                        "top_p": 0.9
                    }
                }
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    return resp.json().get("response", "").strip()
        except Exception as exc:
            logger.debug("Ollama generation call failed: %s", exc)
        return None

    @staticmethod
    def _generate_openai_compatible(
        base_url: str,
        model: str,
        api_key: str,
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        timeout: float
    ) -> Optional[str]:
        url = f"{base_url.rstrip('/')}/chat/completions" if not base_url.endswith("/chat/completions") else base_url
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }

        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
        except Exception as exc:
            logger.debug("OpenAI-compatible call failed: %s", exc)
        return None

    @staticmethod
    def _generate_gemini(
        prompt: str,
        system_prompt: Optional[str],
        timeout: float
    ) -> Optional[str]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        combined_text = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        payload = {
            "contents": [{"parts": [{"text": combined_text}]}]
        }
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception as exc:
            logger.debug("Gemini generation failed: %s", exc)
        return None

    @staticmethod
    def _generate_openai(
        prompt: str,
        system_prompt: Optional[str],
        max_tokens: int,
        temperature: float,
        timeout: float
    ) -> Optional[str]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": settings.OPENAI_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            with httpx.Client(timeout=timeout) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return data["choices"][0]["message"]["content"].strip()
        except Exception as exc:
            logger.debug("OpenAI call failed: %s", exc)
        return None
