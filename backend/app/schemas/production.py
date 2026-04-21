from pydantic import BaseModel
from uuid import UUID


class FabricAvailabilityCheckRequest(BaseModel):
    fabric_id: UUID
    required_meters: float


class FabricAvailabilityCheckResponse(BaseModel):
    fabric_id: UUID
    required_meters: float
    total_available_meters: float
    largest_roll_length: float
    has_total_stock: bool
    has_single_roll_enough: bool
    status: str
    alert_message: str
