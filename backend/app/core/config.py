from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Robot Module DataManager"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "your-super-secret-key-for-jwt-change-it"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 days
    
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///./sql_app.db"
    
    class Config:
        case_sensitive = True

settings = Settings()
