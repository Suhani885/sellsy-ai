from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.repositories.conversation_repository import ConversationRepository
from app.schemas.chat import ChatRequest, ChatResponse, ConversationMessageOut
from app.services.chat_service import ChatService

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def send_message(payload: ChatRequest, db: Session = Depends(get_db)):
    service = ChatService(db)
    return await service.handle_message(payload.session_id, payload.message)


@router.get("/{session_id}/history", response_model=list[ConversationMessageOut])
def get_history(session_id: str, db: Session = Depends(get_db)):
    repo = ConversationRepository(db)
    return repo.get_all(session_id)
