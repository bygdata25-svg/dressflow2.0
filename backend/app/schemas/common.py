from pydantic import BaseModel, ConfigDict


class PaginatedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list
    page: int
    page_size: int
    total: int
