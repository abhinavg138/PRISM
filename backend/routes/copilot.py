from typing import Optional
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from backend.repositories.paimana_repository import paimana_repository
from backend.services.copilot_service import CopilotService
from backend.services.state_manager import app_state
from backend.services.rate_limiter import copilot_limiter

router = APIRouter(prefix="/api", tags=["Copilot"])

@router.post("/copilot/chat")
async def copilot_chat(request: Request):
    copilot_limiter.check(request)
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Malformed JSON payload"})

    if not isinstance(body, dict):
        return JSONResponse(status_code=400, content={"error": "Invalid request body"})

    message = body.get("message")
    active_project_id = body.get("activeProjectId")
    conversation_history = body.get("conversationHistory") or []

    if not message or not isinstance(message, str) or not message.strip():
        return JSONResponse(status_code=400, content={"error": "Message must be a non-empty string"})

    if len(message) > 2000:
        return JSONResponse(status_code=400, content={"error": "Message exceeds maximum allowed length of 2000 characters"})

    # Validate conversationHistory is a list
    if not isinstance(conversation_history, list):
        conversation_history = []

    try:
        active_list = (
            paimana_repository.list_projects()['allMatching']
            if app_state.current_data_source == 'PAIMANA'
            else app_state.demo_projects
        )

        response = await CopilotService.chat(
            user_query=message,
            projects=active_list,
            active_project_id=active_project_id,
            conversation_history=conversation_history
        )
        return response.model_dump()
    except Exception as err:
        print(f"[Copilot Chat Error]: {err}")
        return JSONResponse(
            status_code=500,
            content={
                "answer": "PRISM AI engine encountered an internal processing event. Please re-try.",
                "error": str(err) if str(err) else "Internal processing error",
                "groundedProjects": [],
                "suggestedQuestions": ["Show top critical projects", "Explain land acquisition bottlenecks"]
            }
        )
