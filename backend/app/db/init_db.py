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
