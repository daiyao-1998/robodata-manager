from typing import Optional
from pydantic import BaseModel

class RobotModuleBase(BaseModel):
    name: str
    manufacturer: Optional[str] = None
    peak_torque: Optional[float] = None
    nominal_torque: Optional[float] = None
    start_stop_torque: Optional[float] = None
    stall_torque: Optional[float] = None
    peak_speed: Optional[float] = None
    nominal_speed: Optional[float] = None
    peak_torque_density: Optional[float] = None
    nominal_torque_density: Optional[float] = None
    response_time: Optional[float] = None
    speed_fluctuation: Optional[float] = None
    torque_fluctuation: Optional[float] = None
    overload_time_1_5x: Optional[float] = None
    overload_time_2x: Optional[float] = None
    overload_time_2_5x: Optional[float] = None
    overload_time_3x: Optional[float] = None
    weight: Optional[float] = None
    reduction_ratio: Optional[float] = None
    voltage: Optional[float] = None
    actuator_outer_diameter: Optional[float] = None
    actuator_hollow_diameter: Optional[float] = None
    actuator_axial_length: Optional[float] = None
    stator_inner_diameter: Optional[float] = None
    stator_outer_diameter: Optional[float] = None
    rotor_inner_diameter: Optional[float] = None
    rotor_outer_diameter: Optional[float] = None
    description: Optional[str] = None

class RobotModuleCreate(RobotModuleBase):
    pass

class RobotModuleUpdate(RobotModuleBase):
    name: Optional[str] = None

class RobotModuleInDBBase(RobotModuleBase):
    id: int

    class Config:
        from_attributes = True

class RobotModule(RobotModuleInDBBase):
    pass
