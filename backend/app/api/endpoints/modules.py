import json
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app import crud, models, schemas
from app.api import deps
from app.api.endpoints.ws import manager

router = APIRouter()

@router.get("/", response_model=List[schemas.RobotModule])
def read_modules(
    db: Session = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    modules = crud.robot_module.get_multi(db, skip=skip, limit=limit)
    return modules

@router.post("/", response_model=schemas.RobotModule)
async def create_module(
    *,
    db: Session = Depends(deps.get_db),
    module_in: schemas.RobotModuleCreate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    module = crud.robot_module.create(db=db, obj_in=module_in)
    await manager.broadcast(json.dumps({"action": "create", "data": module.id}))
    return module

@router.put("/{id}", response_model=schemas.RobotModule)
async def update_module(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    module_in: schemas.RobotModuleUpdate,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    module = crud.robot_module.get(db=db, id=id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module = crud.robot_module.update(db=db, db_obj=module, obj_in=module_in)
    await manager.broadcast(json.dumps({"action": "update", "data": module.id}))
    return module

@router.delete("/{id}", response_model=schemas.RobotModule)
async def delete_module(
    *,
    db: Session = Depends(deps.get_db),
    id: int,
    current_user: models.User = Depends(deps.get_current_active_superuser),
) -> Any:
    module = crud.robot_module.get(db=db, id=id)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    module = crud.robot_module.remove(db=db, id=id)
    await manager.broadcast(json.dumps({"action": "delete", "data": id}))
    return module
