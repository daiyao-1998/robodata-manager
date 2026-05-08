from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.db.session import engine, SessionLocal
from app.db.init_db import init_db
from app.models.user import Base as UserBase
from app.models.module import Base as ModuleBase

# 创建数据库表
UserBase.metadata.create_all(bind=engine)
ModuleBase.metadata.create_all(bind=engine)

# 初始化数据
db = SessionLocal()
init_db(db)
db.close()

app = FastAPI(
    title=settings.PROJECT_NAME, openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Robot Module DataManager API"}
