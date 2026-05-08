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
    
    # 插入一些测试数据
    modules = crud.robot_module.get_multi(db)
    if not modules:
        # 尝试从 backend/data.json 读取数据
        json_path = os.path.join(os.path.dirname(__file__), "../../data.json")
        if os.path.exists(json_path):
            try:
                with open(json_path, "r", encoding="utf-8") as f:
                    test_modules_data = json.load(f)
                for item in test_modules_data:
                    # 如果缺少某些非必填字段，可以在这里处理，但 Pydantic 通常会自动处理
                    module_in = schemas.RobotModuleCreate(**item)
                    crud.robot_module.create(db, obj_in=module_in)
                return
            except Exception as e:
                print(f"Error loading data.json: {e}")
        
        # 如果 data.json 不存在或读取失败，则使用硬编码的默认数据
        test_modules = [
            schemas.RobotModuleCreate(
                name="Unitree A1", manufacturer="Unitree",
                peak_torque=33.5, nominal_torque=15.0, start_stop_torque=25.0, stall_torque=40.0, nominal_speed=21.0, 
                response_time=5.0, speed_fluctuation=0.5, torque_fluctuation=1.2,
                overload_time_1_5x=60.0, overload_time_2x=30.0, overload_time_2_5x=10.0, overload_time_3x=2.0,
                weight=0.6, reduction_ratio=6.33, voltage=24.0,
                description="High performance robot dog joint."
            ),
            schemas.RobotModuleCreate(
                name="CyberDog Module", manufacturer="Xiaomi",
                peak_torque=32.0, nominal_torque=14.0, start_stop_torque=22.0, stall_torque=35.0, nominal_speed=220.0, 
                response_time=6.0, speed_fluctuation=0.6, torque_fluctuation=1.5,
                overload_time_1_5x=50.0, overload_time_2x=25.0, overload_time_2_5x=8.0, overload_time_3x=1.5,
                weight=0.55, reduction_ratio=6.0, voltage=24.0,
                description="Xiaomi CyberDog joint module."
            ),
            schemas.RobotModuleCreate(
                name="Agility Robotics Digit", manufacturer="Agility",
                peak_torque=50.0, nominal_torque=20.0, start_stop_torque=35.0, stall_torque=60.0, nominal_speed=150.0, 
                response_time=4.0, speed_fluctuation=0.3, torque_fluctuation=0.8,
                overload_time_1_5x=120.0, overload_time_2x=60.0, overload_time_2_5x=20.0, overload_time_3x=5.0,
                weight=1.2, reduction_ratio=10.0, voltage=48.0,
                description="Bipedal robot joint."
            )
        ]
        for module_in in test_modules:
            crud.robot_module.create(db, obj_in=module_in)
