import json
import os
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.api import deps
from app.api.endpoints.ws import manager

router = APIRouter()

@router.get("/", response_model=List[dict])
def read_modules(
    skip: int = 0,
    limit: int = 100,
) -> Any:
    json_path = os.path.join(os.path.dirname(__file__), "../../../data.json")
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 为前端补充必须的 id 字段
        for idx, item in enumerate(data):
            if "id" not in item:
                item["id"] = idx + 1
        return data
    except Exception as e:
        return []

@router.post("/", response_model=dict)
async def create_module(
    *,
    db: Session = Depends(deps.get_db),
    module_in: schemas.RobotModuleCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    raise HTTPException(status_code=403, detail="数据已改为 JSON 静态托管，请直接修改 data.json 文件，不支持通过网页新增。")

@router.put("/{id}", response_model=dict)
async def update_module(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    module_in: schemas.RobotModuleUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    raise HTTPException(status_code=403, detail="数据已改为 JSON 静态托管，请直接修改 data.json 文件，不支持通过网页修改。")

@router.delete("/{id}", response_model=dict)
async def delete_module(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    raise HTTPException(status_code=403, detail="数据已改为 JSON 静态托管，请直接修改 data.json 文件，不支持通过网页删除。")
