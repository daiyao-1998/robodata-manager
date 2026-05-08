from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.module import RobotModule
from app.schemas.module import RobotModuleCreate, RobotModuleUpdate

class CRUDRobotModule:
    def get(self, db: Session, id: int) -> Optional[RobotModule]:
        return db.query(RobotModule).filter(RobotModule.id == id).first()

    def get_multi(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[RobotModule]:
        return db.query(RobotModule).offset(skip).limit(limit).all()

    def create(self, db: Session, *, obj_in: RobotModuleCreate) -> RobotModule:
        db_obj = RobotModule(**obj_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, *, db_obj: RobotModule, obj_in: RobotModuleUpdate) -> RobotModule:
        obj_data = db_obj.__dict__
        update_data = obj_in.model_dump(exclude_unset=True)
        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, *, id: int) -> RobotModule:
        obj = db.query(RobotModule).get(id)
        db.delete(obj)
        db.commit()
        return obj

robot_module = CRUDRobotModule()
