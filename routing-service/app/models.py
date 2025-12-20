"""SQLAlchemy models matching the PostgreSQL database schema."""

from sqlalchemy import Column, String, Integer, Float, DateTime, JSON, Numeric
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geography
from app.database import Base


class Vehicle(Base):
    """Vehicle model."""
    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True)
    make = Column(String(100))
    model = Column(String(100))
    year = Column(Integer)
    license_plate = Column(String(20), unique=True)
    vin = Column(String(17))
    vehicle_type = Column(String(50))
    capacity_weight_kg = Column(Numeric(10, 2))
    capacity_volume_m3 = Column(Numeric(10, 2))
    fuel_type = Column(String(20))
    status = Column(String(20))
    current_location = Column(Geography('POINT', srid=4326))
    current_odometer_km = Column(Numeric(10, 2))
    last_maintenance_date = Column(DateTime)
    next_maintenance_km = Column(Numeric(10, 2))
    metadata = Column(JSON)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    deleted_at = Column(DateTime)


class Job(Base):
    """Job model."""
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True)
    customer_name = Column(String(200))
    customer_phone = Column(String(20))
    customer_email = Column(String(100))
    pickup_address = Column(String(500))
    pickup_location = Column(Geography('POINT', srid=4326))
    delivery_address = Column(String(500))
    delivery_location = Column(Geography('POINT', srid=4326))
    time_window_start = Column(DateTime)
    time_window_end = Column(DateTime)
    weight = Column(Numeric(10, 2))
    volume = Column(Numeric(10, 2))
    quantity = Column(Integer)
    priority = Column(String(20))
    status = Column(String(20))
    estimated_duration = Column(Numeric(10, 2))
    actual_duration = Column(Numeric(10, 2))
    notes = Column(String)
    special_instructions = Column(String)
    assigned_route_id = Column(UUID(as_uuid=True))
    completed_at = Column(DateTime)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    deleted_at = Column(DateTime)


class Driver(Base):
    """Driver model."""
    __tablename__ = "drivers"

    id = Column(UUID(as_uuid=True), primary_key=True)
    first_name = Column(String(100))
    last_name = Column(String(100))
    email = Column(String(100), unique=True)
    phone = Column(String(20))
    employee_id = Column(String(50), unique=True)
    license_number = Column(String(50), unique=True)
    license_expiry_date = Column(DateTime)
    status = Column(String(20))
    employment_status = Column(String(20))
    current_vehicle_id = Column(UUID(as_uuid=True))
    certifications = Column(JSON)
    performance_rating = Column(Numeric(3, 2))
    total_deliveries = Column(Integer)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    deleted_at = Column(DateTime)
