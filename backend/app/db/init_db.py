import json
import os
from sqlalchemy.orm import Session
from app import crud, schemas
from app.core.config import settings

def init_db(db: Session) -> None:
    user = crud.user.get_by_username(db, username="admin")
    if not user:
        user_in = schemas.UserCreate(
            username="admin",
            password="adminpassword",
            is_superuser=True,
        )
        user = crud.user.create(db, obj_in=user_in)
        
    normal_user = crud.user.get_by_username(db, username="user")
    if not normal_user:
        user_in = schemas.UserCreate(
            username="user",
            password="userpassword",
            is_superuser=False,
        )
        crud.user.create(db, obj_in=user_in)
    
    # 由于数据已改为静态 JSON 托管，此处不再将模块数据插入到 SQLite 中。
    # 只需要保证管理员和普通用户的账号存在即可。
    pass
