from django.apps import AppConfig


class ConnectorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "connector"

    def ready(self):
        """[シグナルを登録するためにreadyを処理]"""
        try:
            import connector.signals
        except ImportError:
            pass
