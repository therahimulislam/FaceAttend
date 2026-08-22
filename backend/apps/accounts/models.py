"""
FaceAttend — Custom User Model

This model is the authentication foundation for all roles:
STUDENT, FACULTY, DEPARTMENT_ADMIN, SUPER_ADMIN.

Must be defined before the first migration.
Role-specific profiles (StudentProfile, FacultyProfile) are in their own apps.
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    STUDENT = "STUDENT", "Student"
    FACULTY = "FACULTY", "Faculty"
    DEPARTMENT_ADMIN = "DEPARTMENT_ADMIN", "Department Admin"
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"


class UserStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
    SUSPENDED = "SUSPENDED", "Suspended"
    TRANSFERRED = "TRANSFERRED", "Transferred"
    RESIGNED = "RESIGNED", "Resigned"


class UserManager(BaseUserManager):
    """Custom manager for the User model (email as username)."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email address is required.")
        email = self.normalize_email(email)
        extra_fields.setdefault("role", UserRole.STUDENT)
        extra_fields.setdefault("status", UserStatus.ACTIVE)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_faculty(self, email, password=None, **extra_fields):
        extra_fields["role"] = UserRole.FACULTY
        return self.create_user(email, password, **extra_fields)

    def create_department_admin(self, email, password=None, **extra_fields):
        extra_fields["role"] = UserRole.DEPARTMENT_ADMIN
        extra_fields.setdefault("is_staff", True)
        return self.create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.SUPER_ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    FaceAttend User model.

    All users authenticate via email + password.
    Role determines which profile extension and capabilities apply.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)

    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.STUDENT,
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=UserStatus.choices,
        default=UserStatus.ACTIVE,
    )

    # Django built-ins
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []  # email and password are sufficient

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    @property
    def is_student(self):
        return self.role == UserRole.STUDENT

    @property
    def is_faculty(self):
        return self.role == UserRole.FACULTY

    @property
    def is_department_admin(self):
        return self.role == UserRole.DEPARTMENT_ADMIN

    @property
    def is_super_admin(self):
        return self.role == UserRole.SUPER_ADMIN

    @property
    def is_admin(self):
        return self.role in (UserRole.DEPARTMENT_ADMIN, UserRole.SUPER_ADMIN)

    def update_last_login(self):
        self.last_login = timezone.now()
        self.save(update_fields=["last_login"])
