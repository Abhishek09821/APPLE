import asyncio
import json
import platform
import secrets
import time
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import uuid4
from urllib.parse import quote
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import StreamingResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from models import CommandRequest, Settings, Routine, Plan
from ai_parser import parse_command, model_status, ModelUnavailable
from executor import execute_action, REVIEW_ACTIONS, close_browser
from storage import put, get, list_records, delete, settings, delete_history
from knowledge import ingest, answer, make_quiz, public_quiz, grade_answer, cancel_study_tasks, quiz_cache_id, MAX_BYTES
from speech import spoken_text, spoken_result, render_audio, cancel_synthesis
from memory import save_fact
from desktop_automation import permissions_status
from executor import process
from contacts import Contact, save_contact, resolve_whatsapp_action
from app_agent import automate_app
from user_profile import UserProfile, current_profile, save_profile

TOKEN = secrets.token_urlsafe(32)
PENDING = {}
ACTIVE = set()
EXECUTION_LOCK = asyncio.Lock()
ALLOWED_ORIGINS = {'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8000', 'http://127.0.0.1:8000'}

@asynccontextmanager
async def lifespan(app):
    yield
    for task in list(ACTIVE):
        task.cancel()
    await asyncio.gather(*ACTIVE, return_exceptions=True)
    await stop_speech()
    await cancel_study_tasks()
    await close_browser()


app = FastAPI(title='APPLE · Local desktop assistant', version='2.0.0', lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=list(ALLOWED_ORIGINS), allow_methods=['GET', 'POST', 'PUT', 'DELETE'], allow_headers=['Content-Type', 'X-Apple-Token'], expose_headers=['X-Apple-Spoken-Text'])
app.add_middleware(TrustedHostMiddleware, allowed_hosts=['localhost', '127.0.0.1', 'testserver'])


@app.middleware('http')
async def local_guard(request: Request, call_next):
    origin = request.headers.get('origin')
    if origin and origin not in ALLOWED_ORIGINS:
        return JSONResponse({'detail': 'Untrusted origin.'}, status_code=403)
    if request.method in {'POST', 'PUT', 'DELETE'} and request.headers.get('x-apple-token') != TOKEN:
        return JSONResponse({'detail': 'Reconnect to your local assistant.'}, status_code=403)
    return await call_next(request)


@app.exception_handler(ModelUnavailable)
async def model_error(request, exc):
    return JSONResponse({'detail': str(exc)}, status_code=503)


@app.exception_handler(ValueError)
async def input_error(request, exc):
    return JSONResponse({'detail': str(exc)}, status_code=400)


@app.get('/api/status')
async def status():
    return {'status': 'online', 'token': TOKEN, 'platform': platform.system(), 'ai': await model_status(),
            'settings': settings().model_dump(), 'profile': current_profile(), 'tasks_run': len(list_records('history', 10000))}


@app.get('/api/profile')
async def get_profile():
    return current_profile()


@app.put('/api/profile')
async def update_profile(value: UserProfile):
    return save_profile(value)


@app.get('/api/settings')
async def get_settings():
    return settings()


@app.put('/api/settings')
async def save_settings(value: Settings):
    put('settings', value.model_dump(), 'settings')
    return value


@app.get('/api/memories')
async def memories():
    return list_records('memory', 100)


@app.get('/api/contacts')
async def contacts():
    return list_records('contact', 100)


@app.post('/api/contacts')
async def add_contact(value: Contact):
    return save_contact(value)


@app.put('/api/contacts/{contact_id}')
async def update_contact(contact_id: str, value: Contact):
    return save_contact(value, contact_id)


@app.delete('/api/contacts/{contact_id}')
async def remove_contact(contact_id: str):
    delete('contact', contact_id)
    return {'deleted': True}


@app.get('/api/permissions')
async def permissions():
    return await permissions_status(process)


@app.post('/api/permissions/accessibility')
async def accessibility_settings():
    await process('open', 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
    return {'opened': True}


@app.delete('/api/memories/{memory_id}')
async def remove_memory(memory_id: str):
    delete('memory', memory_id)
    return {'deleted': True}


def remember(req, reply, **extra):
    return put('history', {'command': req.command, 'session_id': req.session_id, 'reply': reply, **extra})


async def run_plan(req, plan, emit):
    results = []
    learned = None
    async with EXECUTION_LOCK:
        for i, action in enumerate(plan.actions):
            action = resolve_whatsapp_action(action)
            await emit({'type': 'step', 'index': i, 'action': action.model_dump(), 'status': 'running'})
            if action.action == 'automate_app':
                result = await automate_app(action, emit)
            elif action.action == 'remember_fact':
                fact = save_fact(action.target)
                result = {'success': True, 'message': f'I’ll remember: {fact["text"]}'}
            elif action.action == 'recall_memory':
                facts = list_records('memory', 100)
                result = {'success': True, 'message': '\n'.join(f['text'] for f in facts) if facts else 'You haven’t asked me to remember anything yet.'}
            elif action.action == 'learn_document':
                try:
                    learned = await import_path(ImportPath(path=action.target))
                    result = {'success': True, 'message': f'Added {learned["name"]} to your knowledge library ({learned["pages"]} pages). Ask me about it, or start a practice quiz in the Library.'}
                except Exception as exc:
                    result = {'success': False, 'message': str(exc)}
            else:
                result = await execute_action(action)
            results.append({**action.model_dump(), **result})
            await emit({'type': 'step', 'index': i, 'action': action.model_dump(), 'status': 'done' if result['success'] else 'failed', 'result': result})
            if not result['success']:
                break
    success = all(r['success'] for r in results)
    reply = '\n'.join(r['message'] for r in results) if results else plan.reply
    if not success and len(results) < len(plan.actions):
        reply += '\nStopped before the remaining actions.'
    record = remember(req, reply, success=success, steps=results)
    await emit({'type': 'done', **record, 'document': learned, 'spoken_reply': spoken_result(reply, results)})


async def prepare(req, emit):
    if not req.command.strip():
        raise ValueError('Enter a command first.')
    await emit({'type': 'status', 'message': 'Understanding your request…'})
    if req.document_id:
        history = []
        for item in reversed(list_records('history', 60)):
            if item.get('session_id') == req.session_id and item.get('document_id') == req.document_id:
                history.extend([{'role': 'user', 'content': item['command']}, {'role': 'assistant', 'content': item['reply']}])
        reply, sources = await answer(req.document_id, req.command, history[-8:])
        await emit({'type': 'done', **remember(req, reply, success=True, sources=sources, document_id=req.document_id), 'spoken_reply': spoken_text(reply)})
        return
    routine_name = req.command.removeprefix('Run ').removeprefix('run ').strip().lower()
    routine = next((r for r in list_records('routine') if r['name'].lower() == routine_name), None)
    if routine:
        actions = []
        for command in routine['commands']:
            subplan = await parse_command(command, req.session_id)
            if not subplan.actions:
                raise ValueError(f'Routine step needs clarification: {command}. {subplan.reply}')
            actions.extend(subplan.actions)
        plan = Plan(reply=f'Running {routine["name"]}.', actions=actions)
    else:
        plan = await parse_command(req.command, req.session_id)
    plan = plan.model_copy(update={'actions': [resolve_whatsapp_action(a) for a in plan.actions]})
    await emit({'type': 'plan', **plan.model_dump()})
    if not settings().automation_enabled and any(a.action in REVIEW_ACTIONS | {'automate_app'} for a in plan.actions):
        now = time.monotonic()
        for key in list(PENDING):
            if now - PENDING[key][2] > 600:
                PENDING.pop(key, None)
        approval_id = uuid4().hex
        PENDING[approval_id] = (req, plan, now)
        await emit({'type': 'approval', 'approval_id': approval_id, 'reply': plan.reply,
                    'actions': [a.model_dump() for a in plan.actions]})
        return
    await run_plan(req, plan, emit)


def stream_job(worker):
    async def events():
        queue = asyncio.Queue()
        async def work():
            try:
                await worker(queue.put)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                await queue.put({'type': 'error', 'message': str(exc) or 'Request could not be completed.'})
            finally:
                await queue.put(None)
        task = asyncio.create_task(work())
        ACTIVE.add(task)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), 15)
                except asyncio.TimeoutError:
                    yield ': keepalive\n\n'
                    continue
                if event is None:
                    break
                yield 'data: ' + json.dumps(event) + '\n\n'
        finally:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            ACTIVE.discard(task)
    return StreamingResponse(events(), media_type='text/event-stream', headers={'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'})


@app.post('/api/command/stream')
async def command(req: CommandRequest):
    return stream_job(lambda emit: prepare(req, emit))


class Approval(BaseModel):
    approve: bool


@app.post('/api/approvals/{approval_id}')
async def approval(approval_id: str, value: Approval):
    entry = PENDING.pop(approval_id, None)
    if not entry or time.monotonic() - entry[2] > 600:
        raise HTTPException(410, 'This action expired or was already handled. Submit the command again.')
    req, plan, _ = entry
    if not value.approve:
        return {'cancelled': True}
    return stream_job(lambda emit: run_plan(req, plan, emit))


@app.post('/api/stop')
async def stop():
    for task in list(ACTIVE):
        task.cancel()
    PENDING.clear()
    await stop_speech()
    await cancel_study_tasks()
    return {'stopped': True, 'message': 'Pending work stopped. Already completed actions cannot be undone.'}


@app.get('/api/history')
async def history():
    return list_records('history')


class HistorySelection(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=1000)


@app.post('/api/history/delete')
async def remove_selected_history(value: HistorySelection):
    return {'deleted': delete_history(list(set(value.ids)))}


@app.delete('/api/history')
async def clear_history():
    return {'deleted': delete_history()}


@app.delete('/api/history/{record_id}')
async def remove_history(record_id: str):
    return {'deleted': delete_history([record_id])}


@app.get('/api/documents')
async def documents():
    return [{k: v for k, v in d.items() if k != 'chunks'} for d in list_records('document')]


@app.post('/api/documents')
async def upload(file: UploadFile = File(...)):
    data = await file.read(MAX_BYTES + 1)
    try:
        return await asyncio.to_thread(ingest, Path(file.filename or 'document.pdf').name, data)
    finally:
        await file.close()


class ImportPath(BaseModel):
    path: str = Field(min_length=1, max_length=2000)


@app.post('/api/documents/import')
async def import_path(value: ImportPath):
    path = Path(value.path).expanduser().resolve()
    if not path.is_relative_to(Path.home().resolve()) or not path.is_file():
        raise ValueError('Choose an existing document inside your home folder.')
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('Documents must be 20 MB or smaller.')
    return await asyncio.to_thread(ingest, path.name, path.read_bytes())


@app.delete('/api/documents/{document_id}')
async def remove_document(document_id: str):
    delete('document', document_id)
    delete('quiz_template', quiz_cache_id(document_id))
    return {'deleted': True}


@app.post('/api/documents/{document_id}/quiz')
async def quiz(document_id: str, request: Request):
    return public_quiz(await study_request(request, make_quiz(document_id)))


async def study_request(request, work):
    """Release local model work when End lesson/navigation aborts the request."""
    task = asyncio.create_task(work)
    try:
        while True:
            done, _ = await asyncio.wait({task}, timeout=.1)
            if done:
                if task.cancelled():
                    raise HTTPException(status_code=499, detail='Study session stopped.')
                return task.result()
            if await request.is_disconnected():
                raise HTTPException(status_code=499, detail='Study session closed.')
    finally:
        if not task.done():
            task.cancel()
        await asyncio.gather(task, return_exceptions=True)


class AnswerRequest(BaseModel):
    question_id: str
    answer: str = Field(min_length=1, max_length=5000)


@app.post('/api/quizzes/{quiz_id}/answer')
async def submit_answer(quiz_id: str, value: AnswerRequest, request: Request):
    return await study_request(request, grade_answer(quiz_id, value.question_id, value.answer))


@app.get('/api/routines')
async def routines():
    return list_records('routine')


@app.post('/api/routines')
async def teach_routine(value: Routine):
    commands = [c.strip() for c in value.commands if c.strip()]
    if len(commands) != len(value.commands) or any(len(c) > 2000 for c in commands):
        raise ValueError('Each routine step must contain 1–2,000 characters.')
    existing = next((r for r in list_records('routine') if r['name'].lower() == value.name.strip().lower()), None)
    return put('routine', {**value.model_dump(), 'name': value.name.strip(), 'commands': commands}, existing['id'] if existing else None)


@app.delete('/api/routines/{routine_id}')
async def remove_routine(routine_id: str):
    delete('routine', routine_id)
    return {'deleted': True}


SPEECH = None
class Speech(BaseModel):
    text: str = Field(min_length=1, max_length=12000)
    wait: bool = False


async def stop_speech():
    global SPEECH
    if SPEECH and SPEECH.returncode is None:
        SPEECH.terminate()
        await SPEECH.wait()
    SPEECH = None
    await cancel_synthesis()


@app.post('/api/speech/audio')
async def speech_audio(value: Speech):
    if platform.system() != 'Darwin':
        raise ValueError('Local speech requires macOS.')
    data = await render_audio(value.text, settings().speech_rate)
    return Response(content=data, media_type='audio/wav', status_code=200 if data else 204,
                    headers={'Cache-Control': 'no-store', 'X-Apple-Spoken-Text': quote(spoken_text(value.text), safe='')})


@app.post('/api/speech')
async def speak(value: Speech):
    global SPEECH
    if platform.system() != 'Darwin':
        raise ValueError('Native voice requires macOS.')
    await stop_speech()
    clean = spoken_text(value.text)
    if not clean:
        return {'speaking': False, 'completed': True}
    SPEECH = await asyncio.create_subprocess_exec('say', '-r', str(settings().speech_rate), '--', clean)
    if value.wait:
        process = SPEECH
        code = await process.wait()
        return {'speaking': False, 'completed': code == 0}
    return {'speaking': True}


@app.post('/api/speech/stop')
async def silence():
    await stop_speech()
    return {'stopped': True}


DIST = Path(__file__).parent.parent / 'frontend' / 'dist'
if DIST.exists():
    app.mount('/', StaticFiles(directory=DIST, html=True), name='app')

if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='127.0.0.1', port=8000)
