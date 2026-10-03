from typing import Literal
from pydantic import BaseModel, Field, ConfigDict


class Action(BaseModel):
    model_config = ConfigDict(extra='forbid')
    action: Literal['open_app', 'open_website', 'google_search', 'youtube_search',
                    'find_file', 'open_file', 'create_folder', 'whatsapp_send',
                    'whatsapp_open', 'type_text', 'press_key', 'run_shortcut', 'learn_document',
                    'list_apps', 'inspect_app', 'search_app', 'click_control', 'set_field',
                    'remember_fact', 'recall_memory', 'automate_app']
    target: str = Field(min_length=1, max_length=2000)
    message: str = Field(default='', max_length=5000)
    control: str = Field(default='', max_length=300)


class Plan(BaseModel):
    reply: str = Field(max_length=12000)
    actions: list[Action] = Field(default_factory=list, max_length=12)


class CommandRequest(BaseModel):
    command: str = Field(min_length=1, max_length=8000)
    session_id: str = Field(default='default', max_length=100)
    document_id: str | None = None


class Routine(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default='', max_length=300)
    commands: list[str] = Field(min_length=1, max_length=12)


class Settings(BaseModel):
    model: str = Field(default='qwen3:8b', min_length=1, max_length=100)
    voice: bool = True
    speech_rate: int = Field(default=175, ge=100, le=250)
    automation_enabled: bool = False
    setup_completed: bool = False
    auto_tutor: bool = True
