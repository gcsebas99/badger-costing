from sqlmodel import Session

from app.models.settings import AppSettings

SETTINGS_ID = 1


def get_settings(session: Session) -> AppSettings:
    """Return the single settings row, creating it with defaults on first use."""
    settings = session.get(AppSettings, SETTINGS_ID)
    if settings is None:
        settings = AppSettings(id=SETTINGS_ID)
        session.add(settings)
        session.commit()
        session.refresh(settings)
    return settings
