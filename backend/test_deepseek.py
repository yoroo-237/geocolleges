import httpx
import json
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

deepseek_key = os.getenv('DEEPSEEK_API_KEY')
if not deepseek_key:
    print("DEEPSEEK_API_KEY not found in environment")
else:
    try:
        resp = httpx.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {deepseek_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": "Tu es un parseur de requêtes. Retourne UNIQUEMENT du JSON valide."},
                    {"role": "user", "content": "lycée avec bus"},
                ],
                "max_tokens": 400,
                "temperature": 0,
            },
            timeout=10.0,
        )
        print(f"Status: {resp.status_code}")
        data = resp.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        print(f"Raw response: {repr(content)}")
        try:
            parsed = json.loads(content.strip("`").strip())
            print(f"Parsed JSON: {parsed}")
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
    except Exception as e:
        print(f"Error: {e}")
