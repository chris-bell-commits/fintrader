"""Chat endpoint: send a message to the AI assistant and get its response."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, field_validator

from app.db import get_db
from app.llm import chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("message must not be empty")
        return v


@router.post("")
async def post_chat(req: ChatRequest) -> dict:
    """Send a message to the assistant and return its full response with actions."""
    async with get_db() as conn:
        return await chat(req.message, conn)
