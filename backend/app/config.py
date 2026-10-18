from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="COSTEO_")

    app_name: str = "Badger Grub Costeo"
    version: str = "0.1.0"
    database_url: str = f"sqlite:///{REPO_ROOT / 'data' / 'costeo.db'}"
    backup_dir: Path = REPO_ROOT / "data" / "backups"


settings = Settings()
