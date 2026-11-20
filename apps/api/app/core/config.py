from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SmartFlow AI API"
    app_env: str = "development"
    app_version: str = "1.0.0"
    frontend_url: str = "http://localhost:5174,http://127.0.0.1:5174"

    here_api_key: str = Field(default="", repr=False)
    here_traffic_base_url: str = "https://data.traffic.hereapi.com/v7"
    here_city: str = "Jaipur"
    here_latitude: float = 26.9124
    here_longitude: float = 75.7873
    here_radius_meters: int = 5000
    supabase_url: str = ""
    supabase_anon_key: str = Field(default="", repr=False)
    supabase_service_role_key: str = Field(default="", repr=False)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip().rstrip("/") for origin in self.frontend_url.split(",") if origin.strip()]


settings = Settings()
