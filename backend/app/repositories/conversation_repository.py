from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.conversation import ConversationMessage


class ConversationRepository:
    def __init__(self, db: Session):
        self.db = db

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        structured_output: dict | None = None,
    ) -> ConversationMessage:
        message = ConversationMessage(
            session_id=session_id,
            role=role,
            content=content,
            structured_output=structured_output,
        )
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def get_recent(self, session_id: str, limit: int = 10) -> list[ConversationMessage]:
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.created_at.desc())
            .limit(limit)
        )
        messages = list(self.db.execute(stmt).scalars().all())
        return list(reversed(messages))  # chronological order

    def get_all(self, session_id: str) -> list[ConversationMessage]:
        stmt = (
            select(ConversationMessage)
            .where(ConversationMessage.session_id == session_id)
            .order_by(ConversationMessage.created_at.asc())
        )
        return list(self.db.execute(stmt).scalars().all())

    def get_all_agent_messages(self) -> list[ConversationMessage]:
        """Every agent turn across every session — used for analytics
        aggregation (recommendation counts, upsell counts, etc.)."""
        stmt = select(ConversationMessage).where(ConversationMessage.role == "agent")
        return list(self.db.execute(stmt).scalars().all())

    def count_distinct_sessions(self) -> int:
        stmt = select(func.count(func.distinct(ConversationMessage.session_id)))
        return self.db.execute(stmt).scalar_one()
