from fastapi import APIRouter
from app.api.endpoints import users, modules, ws

api_router = APIRouter()
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(modules.router, prefix="/modules", tags=["modules"])
api_router.include_router(ws.router, tags=["websocket"])
