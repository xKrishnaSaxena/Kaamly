from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, loaded from environment / .env file."""

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kaamly"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    app_env: str = "development"

    # Voice pipeline (optional). Free tier at console.groq.com. Without a key,
    # STT falls back to the browser and intent uses the rule-based parser.
    groq_api_key: str = ""
    groq_stt_model: str = "whisper-large-v3"
    groq_llm_model: str = "llama-3.3-70b-versatile"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def has_stt(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def has_llm(self) -> bool:
        return bool(self.groq_api_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        """Normalize any Postgres URL to the async (asyncpg) driver.

        Lets you paste Supabase's connection string verbatim (it hands out a
        plain ``postgresql://`` URL) without editing the scheme by hand.
        """
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]

        # asyncpg doesn't understand libpq's ``sslmode`` query param — drop it
        # (SSL is handled via connect_args instead, see db_connect_args).
        parts = urlsplit(url)
        if parts.query:
            kept = [(k, v) for k, v in parse_qsl(parts.query) if k != "sslmode"]
            url = urlunsplit(parts._replace(query=urlencode(kept)))
        return url

    @property
    def db_connect_args(self) -> dict:
        """Driver-level connect args, tuned for Supabase where applicable."""
        args: dict = {}
        low = self.database_url.lower()
        if "supabase" in low:
            args["ssl"] = "require"
        # Supabase transaction pooler (port 6543 / pgbouncer) can't use the
        # prepared-statement cache — disable it to avoid "prepared statement
        # does not exist" errors.
        if ":6543" in low or "pooler" in low:
            args["statement_cache_size"] = 0
        return args


settings = Settings()
