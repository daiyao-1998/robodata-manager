from sqlalchemy import Column, Integer, String, Float, Text
from app.db.session import Base

class RobotModule(Base):
    __tablename__ = "robot_modules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    manufacturer = Column(String, nullable=True)
    
    # 基础与核心性能参数
    peak_torque = Column(Float, nullable=True) # 峰值扭矩 (Nm)
    nominal_torque = Column(Float, nullable=True) # 额定扭矩 (Nm)
    start_stop_torque = Column(Float, nullable=True) # 启停扭矩 (Nm)
    stall_torque = Column(Float, nullable=True) # 堵转扭矩 (Nm)
    peak_speed = Column(Float, nullable=True) # 峰值转速 (rpm)
    nominal_speed = Column(Float, nullable=True) # 额定转速 (rpm)
    peak_torque_density = Column(Float, nullable=True) # 峰值扭矩密度 (Nm/kg)
    nominal_torque_density = Column(Float, nullable=True) # 额定扭矩密度 (Nm/kg)
    
    # 动态响应参数
    response_time = Column(Float, nullable=True) # 响应时间 (ms)
    speed_fluctuation = Column(Float, nullable=True) # 转速波动 (%)
    torque_fluctuation = Column(Float, nullable=True) # 转矩波动 (%)
    
    # 过载时间参数 (不同倍数额定扭矩下)
    overload_time_1_5x = Column(Float, nullable=True) # 1.5倍过载时间 (s)
    overload_time_2x = Column(Float, nullable=True) # 2倍过载时间 (s)
    overload_time_2_5x = Column(Float, nullable=True) # 2.5倍过载时间 (s)
    overload_time_3x = Column(Float, nullable=True) # 3倍过载时间 (s)
    
    # 物理与其他参数
    weight = Column(Float, nullable=True) # 重量 (kg)
    reduction_ratio = Column(Float, nullable=True) # 减速比
    voltage = Column(Float, nullable=True) # 额定电压 (V)
    
    # 尺寸参数
    actuator_outer_diameter = Column(Float, nullable=True) # 执行器外径 (mm)
    actuator_hollow_diameter = Column(Float, nullable=True) # 执行器中空直径 (mm)
    actuator_axial_length = Column(Float, nullable=True) # 执行器轴向长度 (mm)
    stator_inner_diameter = Column(Float, nullable=True) # 电机定子内径 (mm)
    stator_outer_diameter = Column(Float, nullable=True) # 电机定子外径 (mm)
    rotor_inner_diameter = Column(Float, nullable=True) # 电机转子内径 (mm)
    rotor_outer_diameter = Column(Float, nullable=True) # 电机转子外径 (mm)
    
    description = Column(Text, nullable=True)
