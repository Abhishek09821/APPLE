from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json
from datetime import datetime
from ai_parser import parse_command
from executor import execute_action
from scheduler import scheduler, add_scheduled_task, get_scheduled_tasks
from history import save_command, get_history

app = FastAPI(title="APPLE Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CommandRequest(BaseModel):
    command: str


class ScheduleRequest(BaseModel):
    command: str
    time: str  # e.g. "09:00" or "every morning"


@app.on_event("startup")
async def startup():
    scheduler.start()
    print("✅ APPLE backend started")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()


@app.get("/")
async def root():
    return {"status": "APPLE is running", "version": "1.0.0"}


@app.post("/command")
async def handle_command(req: CommandRequest):
    """Main command endpoint — parses intent and executes action."""
    try:
        # Parse intent with Gemini
        intent = await parse_command(req.command)

        # Execute the action
        result = await execute_action(intent)

        # Save to history
        save_command(req.command, intent, result)

        return {
            "success": True,
            "command": req.command,
            "intent": intent,
            "result": result,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/command/stream")
async def handle_command_stream(req: CommandRequest):
    """Streaming version — sends step-by-step execution updates."""

    async def event_stream():
        try:
            # Step 1: Parse
            yield f"data: {json.dumps({'step': 'parsing', 'message': 'Analyzing command intent...'})}\n\n"
            await asyncio.sleep(0.3)

            intent = await parse_command(req.command)
            yield f"data: {json.dumps({'step': 'intent', 'message': 'Intent detected: ' + intent['action'], 'intent': intent})}\n\n"
            await asyncio.sleep(0.3)

            # Step 2: Plan
            yield f"data: {json.dumps({'step': 'planning', 'message': 'Generating action plan...'})}\n\n"
            await asyncio.sleep(0.4)

            # Step 3: Execute
            yield f"data: {json.dumps({'step': 'executing', 'message': 'Executing automation pipeline...'})}\n\n"
            result = await execute_action(intent)

            # Step 4: Done
            save_command(req.command, intent, result)
            yield f"data: {json.dumps({'step': 'done', 'message': result.get('message', 'Done!'), 'result': result})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/history")
async def get_command_history():
    return {"history": get_history()}


@app.post("/schedule")
async def schedule_task(req: ScheduleRequest):
    task = add_scheduled_task(req.command, req.time)
    return {"success": True, "task": task}


@app.get("/schedule")
async def list_scheduled():
    return {"tasks": get_scheduled_tasks()}


@app.get("/status")
async def status():
    return {
        "status": "online",
        "timestamp": datetime.now().isoformat(),
        "tasks_run": len(get_history()),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
