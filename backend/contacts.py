"""User-maintained WhatsApp address book. No contact or phone-number guessing."""
import re
import unicodedata
from pydantic import BaseModel, Field, field_validator
from storage import get, put, list_records


def alias_key(value):
    value = unicodedata.normalize('NFKC', value).casefold()
    value = value.translate(str.maketrans('', '', '\ufe0e\ufe0f\u200d'))
    return ' '.join(''.join(c if unicodedata.category(c)[0] in {'L', 'M', 'N'} else ' ' for c in value).split())


class Contact(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=30)
    aliases: list[str] = Field(default_factory=list, max_length=20)

    @field_validator('name')
    @classmethod
    def valid_name(cls, value):
        value = value.strip()
        if not alias_key(value) or any(unicodedata.category(c) == 'Cc' for c in value):
            raise ValueError('Use the contact’s WhatsApp display name, without line breaks.')
        return value

    @field_validator('phone')
    @classmethod
    def valid_phone(cls, value):
        value = re.sub(r'[ ()-]', '', value.strip())
        if not re.fullmatch(r'\+[1-9]\d{7,14}', value, flags=re.ASCII):
            raise ValueError('Use an international number with country code, such as +919876543210.')
        return value

    @field_validator('aliases')
    @classmethod
    def valid_aliases(cls, values):
        result, seen = [], set()
        for value in values:
            value = value.strip()
            if not value:
                continue
            key = alias_key(value)
            if not key or len(value) > 80 or any(unicodedata.category(c) == 'Cc' for c in value):
                raise ValueError('Each voice alias must be a short name without line breaks.')
            if key not in seen:
                result.append(value)
                seen.add(key)
        return result


def save_contact(value, contact_id=None):
    existing = list_records('contact', 1000)
    if contact_id and not get('contact', contact_id):
        raise ValueError('Saved contact not found. Refresh the list.')
    if not contact_id and len(existing) >= 100:
        raise ValueError('You can save up to 100 contacts.')
    keys = {alias_key(n) for n in [value.name, *value.aliases]}
    for item in existing:
        if item['id'] == contact_id:
            continue
        if item['phone'] == value.phone:
            raise ValueError(f'This number is already saved as {item["name"]}. Edit that contact to add an alias.')
        conflict = keys & {alias_key(n) for n in [item['name'], *item.get('aliases', [])]}
        if conflict:
            raise ValueError(f'A name or alias is already used by {item["name"]}. Use a distinct alias.')
    return put('contact', value.model_dump(), contact_id)


def resolve_contact(query):
    key = alias_key(query)
    number = re.sub(r'[ ()-]', '', query.strip())
    matches = [item for item in list_records('contact', 1000)
               if number == item['phone'] or key in {alias_key(n) for n in [item['name'], *item.get('aliases', [])]}]
    if len(matches) > 1:
        raise ValueError('More than one saved contact matches. Use a unique voice alias in Settings.')
    return matches[0] if matches else None


def resolve_whatsapp_action(action):
    if action.action not in {'whatsapp_send', 'whatsapp_open'}:
        return action
    contact = resolve_contact(action.target)
    # The expected display name can only come from the user's address book,
    # never from a model-generated control field.
    return action.model_copy(update={'target': contact['phone'] if contact else action.target,
                                      'control': contact['name'] if contact else ''})
