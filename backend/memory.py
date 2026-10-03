"""Explicit, inspectable user memories kept in the local database."""
from storage import put, list_records


def save_fact(text):
    text = text.strip()
    if not text or len(text) > 2000:
        raise ValueError('A memory must contain 1–2,000 characters.')
    existing = next((m for m in list_records('memory', 500) if m['text'].casefold() == text.casefold()), None)
    return existing or put('memory', {'text': text})


def relevant_memories(query):
    records = list_records('memory', 100)
    words = set(query.casefold().split())
    records.sort(key=lambda m: len(words & set(m['text'].casefold().split())), reverse=True)
    return '\n'.join(m['text'] for m in records[:12])[:6000]
