import os
import json
import requests
from bs4 import BeautifulSoup
from google import genai
from google.genai.types import Tool

# -----------------------------------------------
# 1. Настройка
# -----------------------------------------------
# Убедитесь, что переменные окружения установлены
project_url = os.environ.get("PROJECT_URL", "https://example.com")
api_key = os.environ.get("API_KEY")

client = genai.Client(api_key=api_key)

# Инструмент, позволяющий модели читать содержимое URL
url_tool = Tool(url_context={})

# -----------------------------------------------
# 2. Генерация текста документации и плана скриншотов
# -----------------------------------------------
print(f"🔍 Анализирую проект по ссылке: {project_url}")

text_prompt = f"""
Ты — ИИ-агент технического писателя. Проанализируй веб-страницу проекта {project_url}.
На основе увиденного, напиши понятное руководство пользователя на русском языке.

Требования к руководству:
1. Формат: Markdown.
2. Опиши назначение проекта.
3. Выдели основные возможности и интерфейс.
4. Добавь пошаговые инструкции для ключевых сценариев.
5. В конце ответа (строго после текста руководства) определи 3-4 раздела для скриншотов. 
   Выведи их в формате JSON-блока:
   {{
     "screenshots": [
       "Главная страница",
       "Создание новой задачи"
     ]
   }}
"""

try:
    text_response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=text_prompt,
        config={"tools": [url_tool]},
    )
    
    full_response = text_response.text
    print("✅ Текст документации сгенерирован.")
    
    # Вывод результата для проверки
    print("\n--- Сгенерированный контент ---")
    print(full_response)

except Exception as e:
    print(f"❌ Ошибка при генерации текста: {e}")
    exit(1)
