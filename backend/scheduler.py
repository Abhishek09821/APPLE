from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import json, os, re

scheduler = AsyncIOScheduler()
SCHEDULE_FILE = os.path.join(os.path.dirname(__file__), "data", "schedule.json")
os.makedirs(os.path.dirname(SCHEDULE_FILE), exist_ok=True)


def load_tasks():
    if os.path.exists(SCHEDULE_FILE):
        with open(SCHEDULE_FILE) as f:
            return json.load(f)
    return []


def save_tasks(tasks):
    with open(SCHEDULE_FILE, "w") as f:
        json.dump(tasks, f, indent=2)


def parse_time_string(time_str: str):
    """Parse 'HH:MM' or 'every morning' etc into cron params."""
    time_str = time_str.lower().strip()

    presets = {
        "every morning": {"hour": 9, "minute": 0},
        "morning": {"hour": 9, "minute": 0},
        "every evening": {"hour": 18, "minute": 0},
        "evening": {"hour": 18, "minute": 0},
        "every night": {"hour": 21, "minute": 0},
        "night": {"hour": 21, "minute": 0},
        "every noon": {"hour": 12, "minute": 0},
        "noon": {"hour": 12, "minute": 0},
    }

    if time_str in presets:
        return presets[time_str]

    match = re.match(r"(\d{1,2}):(\d{2})", time_str)
    if match:
        return {"hour": int(match.group(1)), "minute": int(match.group(2))}

    return {"hour": 9, "minute": 0}


def add_scheduled_task(command: str, time_str: str) -> dict:
    from ai_parser import fallback_parse
    import asyncio
    from executor import execute_action

    cron_params = parse_time_string(time_str)
    task_id = f"task_{len(load_tasks()) + 1}_{datetime.now().timestamp():.0f}"

    async def job():
        intent = fallback_parse(command)
        await execute_action(intent)

    scheduler.add_job(
        job,
        CronTrigger(**cron_params),
        id=task_id,
        replace_existing=True,
    )

    task = {
        "id": task_id,
        "command": command,
        "time": time_str,
        "cron": cron_params,
        "created_at": datetime.now().isoformat(),
        "active": True,
    }

    tasks = load_tasks()
    tasks.append(task)
    save_tasks(tasks)

    return task


def get_scheduled_tasks():
    return load_tasks()
