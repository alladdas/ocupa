"""
GPTAnswerer — uses Gemini to answer job application form questions on behalf of the user.
Each instance is scoped to one (user, job) pair and holds the LLM context in memory.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

from google import genai

from models import UserProfile

logger = logging.getLogger(__name__)

# Rough years-of-experience by seniority, used as numeric fallback
_SENIORITY_YEARS = {'junior': 1, 'pleno': 3, 'senior': 6}

# Ordered by preference; first one that responds without error is used.
_MODELS_TO_TRY = [
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
]


def _probe_model(client: genai.Client, model: str) -> bool:
    try:
        client.models.generate_content(model=model, contents='hi')
        return True
    except Exception:
        return False


class GPTAnswerer:
    def __init__(self, api_key: str, user: UserProfile, job_description: str) -> None:
        self._client = genai.Client(api_key=api_key)
        self._user = user
        self._context = self._build_context(job_description)
        self._model = self._resolve_model()

    def _resolve_model(self) -> str:
        for model in _MODELS_TO_TRY:
            if _probe_model(self._client, model):
                logger.info(f'[GPTAnswerer] using model: {model}')
                return model
        logger.warning('[GPTAnswerer] all probe calls failed, defaulting to gemini-2.0-flash')
        return _MODELS_TO_TRY[0]

    # ── Context ──────────────────────────────────────────────────────────────

    def _build_context(self, job_description: str) -> str:
        u = self._user
        return (
            'Você é um assistente que preenche formulários de candidatura de emprego '
            'em nome do candidato. Use apenas informações reais do perfil fornecido. '
            'Seja conciso e profissional. Responda em português, a menos que a pergunta '
            'esteja claramente em inglês — nesse caso responda em inglês.\n\n'
            'PERFIL DO CANDIDATO:\n'
            f'Nome: {u.first_name} {u.last_name}\n'
            f'Email: {u.email}\n'
            f'Telefone: {u.phone}\n'
            f'Cidade: {u.city}\n'
            f'LinkedIn: {u.linkedin_url or "não informado"}\n'
            f'Senioridade: {u.seniority}\n'
            f'Anos de experiência: {u.experience_years}\n'
            f'Modelo de trabalho preferido: {u.work_model_preference}\n'
            f'Autorizado a trabalhar no Brasil: sim\n\n'
            f'CURRÍCULO (trecho):\n{u.resume_text[:3000]}\n\n'
            f'DESCRIÇÃO DA VAGA:\n{job_description[:2000]}'
        )

    # ── Internal ─────────────────────────────────────────────────────────────

    def _call(self, prompt: str) -> str:
        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=f'{self._context}\n\n{prompt}',
            )
            return response.text.strip()
        except Exception as exc:
            logger.warning(f'[GPTAnswerer] Gemini error: {exc}')
            return ''

    # ── Public API ────────────────────────────────────────────────────────────

    def answer_text(self, question: str) -> str:
        """Return a free-text answer, max 500 chars."""
        prompt = (
            f'PERGUNTA DO FORMULÁRIO: {question}\n\n'
            'Responda de forma direta e profissional. Máximo 500 caracteres. '
            'Não use asteriscos, hashtags ou qualquer formatação markdown.'
        )
        return self._call(prompt)[:500]

    def answer_numeric(self, question: str) -> int:
        """Return an integer answer (years of exp, salary range, etc.)."""
        prompt = (
            f'PERGUNTA DO FORMULÁRIO (resposta numérica inteira esperada): {question}\n\n'
            'Responda APENAS com um número inteiro. Nenhum texto adicional.'
        )
        result = self._call(prompt)
        numbers = re.findall(r'\d+', result)
        if numbers:
            return int(numbers[0])
        return self._user.experience_years or _SENIORITY_YEARS.get(self._user.seniority, 3)

    def answer_options(self, question: str, options: list[str]) -> str:
        """Pick the best matching option from the given list."""
        opts_str = '\n'.join(f'- {o}' for o in options)
        prompt = (
            f'PERGUNTA DO FORMULÁRIO: {question}\n\n'
            f'OPÇÕES DISPONÍVEIS:\n{opts_str}\n\n'
            'Contexto adicional do candidato: brasileiro, residente em São Paulo, Brasil. '
            'Brasileiros são considerados latinos (Hispanic/Latino = Yes). '
            'Para perguntas sobre autorização de trabalho nos EUA: o candidato precisaria de visto. '
            'Escolha EXATAMENTE UMA das opções acima que melhor se aplica ao candidato. '
            'Responda APENAS com o texto exato de uma das opções, sem pontuação extra, '
            'sem explicações e sem adicionar nenhum texto além da opção escolhida.'
        )
        result = self._call(prompt)

        # Levenshtein fuzzy-match to guard against LLM hallucinating option text
        try:
            from Levenshtein import distance as lev_distance
            return min(options, key=lambda o: lev_distance(result.lower(), o.lower()))
        except ImportError:
            pass

        # Fallback: substring match
        result_lower = result.lower()
        for opt in options:
            if opt.lower() in result_lower or result_lower in opt.lower():
                return opt
        return options[0]
