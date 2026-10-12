from __future__ import annotations

import json
from typing import Any

from huggingface_hub import InferenceClient


def chat_completion_json(
    *,
    hf_token: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> dict[str, Any]:
    model_id, separator, provider = model.partition(":")
    client = InferenceClient(
        model=model_id,
        provider=provider if separator else "auto",
        token=hf_token,
        timeout=20,
    )
    response = client.chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0,
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content
    if not isinstance(content, str):
        raise ValueError("Hugging Face returned an empty or non-text response.")
    result = json.loads(content)
    if not isinstance(result, dict):
        raise ValueError("Hugging Face response must be a JSON object.")
    return result
