"""
FaceAttend — GPS / Geofence Utilities (Phase 8)

Provides the Haversine distance formula and geofence check used when
a student submits attendance for a session that has a room with GPS coordinates.

Algorithm: Haversine (spherical law of cosines approximation for short distances)
Accuracy: ±0.3% for distances < 1 km — sufficient for classroom geofencing.
"""
import math
from dataclasses import dataclass


EARTH_RADIUS_METERS = 6_371_000  # Mean radius of the Earth in meters


@dataclass
class GeofenceResult:
    """Result of a geofence check."""
    within: bool
    distance_meters: float
    allowed_radius: int

    @property
    def exceeded_by_meters(self) -> float:
        return max(0.0, self.distance_meters - self.allowed_radius)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth.

    Args:
        lat1, lon1: First point in decimal degrees (WGS84).
        lat2, lon2: Second point in decimal degrees (WGS84).

    Returns:
        Distance in meters.
    """
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(a))

    return EARTH_RADIUS_METERS * c


def check_geofence(
    student_lat: float,
    student_lon: float,
    room_lat: float,
    room_lon: float,
    radius_meters: int,
) -> GeofenceResult:
    """
    Check whether the student is within the room's geofence.

    Args:
        student_lat, student_lon: Student GPS coordinates.
        room_lat, room_lon: Room center GPS coordinates.
        radius_meters: Geofence radius in meters.

    Returns:
        GeofenceResult with within flag and distance.
    """
    distance = haversine_distance(student_lat, student_lon, room_lat, room_lon)
    return GeofenceResult(
        within=distance <= radius_meters,
        distance_meters=round(distance, 1),
        allowed_radius=radius_meters,
    )
