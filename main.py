
import re
import os
import time
import datetime
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Header, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, ForeignKey, event, UniqueConstraint, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./yuanbao.db")

DAILY_POST_LIMIT = 5
DAILY_CLAIM_LIMIT = 3
INITIAL_USES = 10
MAX_LIST_LIMIT = 100 
CACHE_TTL = 3.0

# --- Database Setup ---
connect_args = {}
pool_size = 5
max_overflow = 10

if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    engine = create_engine(DATABASE_URL, connect_args=connect_args)
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=40,
        pool_timeout=30,
        pool_recycle=1800
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class CodeDB(Base):
    __tablename__ = "codes"
    id = Column(String, primary_key=True, index=True)
    content = Column(String)
    core_code = Column(String, index=True)
    creator_id = Column(String, index=True)
    remaining_uses = Column(Integer, default=INITIAL_USES)
    created_at = Column(Float, index=True)
    date_str = Column(String, index=True) 

    __table_args__ = (
        Index('idx_creator_date', 'creator_id', 'date_str'),
    )

class ClaimDB(Base):
    __tablename__ = "claims"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True)
    code_id = Column(String, ForeignKey("codes.id"), index=True)
    claimed_at = Column(Float)
    date_str = Column(String, index=True)

    __table_args__ = (
        UniqueConstraint('user_id', 'code_id', name='uq_user_code_claim'),
        Index('idx_user_date', 'user_id', 'date_str'),
    )

Base.metadata.create_all(bind=engine)

# --- Pydantic Models ---
class CodeCreate(BaseModel):
    content: str
    id: str 

# --- Global Cache ---
LIST_CACHE: Dict[str, Any] = {
    "data": [],
    "timestamp": 0.0
}

# --- App & Middleware ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器开小差了，请稍后再试"},
    )

# --- Dependencies ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_today_str():
    return datetime.datetime.now().strftime("%Y-%m-%d")

# --- Routes ---

@app.get("/health")
def health_check():
    """Endpoint for Load Balancer to check service status"""
    return {"status": "ok"}

@app.get("/api/codes")
def get_codes(
    x_user_id: str = Header(...),
    db: Session = Depends(get_db)
):
    global LIST_CACHE
    now = time.time()
    
    # 1. READ STRATEGY: Check Memory Cache
    codes_data = []
    
    if now - LIST_CACHE["timestamp"] < CACHE_TTL:
        codes_data = LIST_CACHE["data"]
    else:
        # Cache expired, query DB
        codes_objs = db.query(CodeDB).filter(CodeDB.remaining_uses > 0)\
            .order_by(CodeDB.created_at.desc())\
            .limit(MAX_LIST_LIMIT)\
            .all()
        
        # Sort Oldest -> Newest for stream view
        codes_objs.sort(key=lambda x: x.created_at)

        codes_data = [{
            "id": c.id,
            "content": c.content,
            "remainingUses": c.remaining_uses,
            "createdAt": c.created_at * 1000,
            "creator_id": c.creator_id
        } for c in codes_objs]

        LIST_CACHE["data"] = codes_data
        LIST_CACHE["timestamp"] = now

    if not codes_data:
        return []

    # 2. PERSONALIZATION
    code_ids = [c["id"] for c in codes_data]
    user_claims = db.query(ClaimDB.code_id).filter(
        ClaimDB.user_id == x_user_id,
        ClaimDB.code_id.in_(code_ids)
    ).all()
    claimed_ids = {c[0] for c in user_claims}

    response_data = []
    for c in codes_data:
        item = c.copy()
        item["isOwn"] = (item["creator_id"] == x_user_id)
        item["isUsed"] = (item["id"] in claimed_ids)
        del item["creator_id"]
        response_data.append(item)
        
    return response_data

@app.get("/api/user/stats")
def get_user_stats(
    x_user_id: str = Header(...),
    db: Session = Depends(get_db)
):
    today = get_today_str()
    post_count = db.query(CodeDB).filter(CodeDB.creator_id == x_user_id, CodeDB.date_str == today).count()
    claim_count = db.query(ClaimDB).filter(ClaimDB.user_id == x_user_id, ClaimDB.date_str == today).count()
    
    return {
        "todayPostCount": post_count,
        "todayClaimCount": claim_count,
        "postLimit": DAILY_POST_LIMIT,
        "claimLimit": DAILY_CLAIM_LIMIT
    }

@app.post("/api/codes")
def create_code(
    code_in: CodeCreate,
    x_user_id: str = Header(...),
    db: Session = Depends(get_db)
):
    today = get_today_str()
    
    post_count = db.query(CodeDB).filter(CodeDB.creator_id == x_user_id, CodeDB.date_str == today).count()
    if post_count >= DAILY_POST_LIMIT:
        raise HTTPException(status_code=400, detail=f"今日发布次数已达上限 ({DAILY_POST_LIMIT}次)")

    match = re.search(r'[A-Z]{2}\d{4}\s[a-zA-Z0-9]+:\/[A-Z0-9]+', code_in.content)
    if not match:
        raise HTTPException(status_code=400, detail="格式不正确") 
    core_code = match.group(0)
    
    existing = db.query(CodeDB).filter(CodeDB.core_code == core_code, CodeDB.remaining_uses > 0).first()
    if existing:
        raise HTTPException(status_code=400, detail="该邀请码已在列表中")

    new_code = CodeDB(
        id=code_in.id,
        content=code_in.content,
        core_code=core_code,
        creator_id=x_user_id,
        remaining_uses=INITIAL_USES,
        created_at=datetime.datetime.now().timestamp(),
        date_str=today
    )
    db.add(new_code)
    try:
        db.commit()
        db.refresh(new_code)
        LIST_CACHE["timestamp"] = 0 
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="发布失败，可能重复")
    
    return {
        "id": new_code.id,
        "content": new_code.content,
        "remainingUses": new_code.remaining_uses,
        "createdAt": new_code.created_at * 1000,
        "isOwn": True,
        "isUsed": False
    }

@app.post("/api/codes/{code_id}/claim")
def claim_code(
    code_id: str,
    x_user_id: str = Header(...),
    db: Session = Depends(get_db)
):
    today = get_today_str()
    
    # Lock for update
    if engine.name != 'sqlite':
        code = db.query(CodeDB).filter(CodeDB.id == code_id).with_for_update().first()
    else:
        code = db.query(CodeDB).filter(CodeDB.id == code_id).first()

    if not code:
        raise HTTPException(status_code=404, detail="红包不存在")
    
    if code.remaining_uses <= 0:
        raise HTTPException(status_code=400, detail="已被领完")

    if code.creator_id == x_user_id:
        raise HTTPException(status_code=400, detail="不能领取自己发布的邀请码")

    claim_count = db.query(ClaimDB).filter(ClaimDB.user_id == x_user_id, ClaimDB.date_str == today).count()
    if claim_count >= DAILY_CLAIM_LIMIT:
        raise HTTPException(status_code=400, detail=f"今日领取次数已达上限 ({DAILY_CLAIM_LIMIT}次)")

    try:
        new_claim = ClaimDB(
            user_id=x_user_id,
            code_id=code_id,
            claimed_at=datetime.datetime.now().timestamp(),
            date_str=today
        )
        db.add(new_claim)
        code.remaining_uses -= 1
        db.commit()
        db.refresh(code)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="您已经领取过该邀请码")
    except Exception as e:
        db.rollback()
        logger.error(f"Claim error: {e}")
        raise HTTPException(status_code=500, detail="系统繁忙，请重试")

    return {
        "id": code.id,
        "remainingUses": code.remaining_uses,
        "isOwn": False,
        "isUsed": True
    }

if __name__ == "__main__":
    import uvicorn
    # Usage in prod: gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
    uvicorn.run(app, host="0.0.0.0", port=8000)
