from django.urls import path
from . import views

urlpatterns = [
    path("",      views.health_check,       name="health-check"),        # Shallow — load balancer
    path("deep/", views.deep_health_check,  name="health-check-deep"),   # Deep — monitoring
]
