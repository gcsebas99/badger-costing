"""Week prep planner: calculated on request, never stored."""

import re
from datetime import date

from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import Session

from app.db import SessionDep
from app.schemas.prep_plan import PrepPlanExportIn, PrepPlanIn, PrepPlanRead
from app.services.csv_export import prep_plan_csv
from app.services.prep_plan import PlanLine, PrepPlan, PrepPlanError, build_prep_plan
from app.services.text import fold

router = APIRouter(tags=["prep-plan"])


def _build(session: Session, payload: PrepPlanIn) -> PrepPlan:
    lines = [PlanLine(i.product_id, i.target_qty, i.extra_qty) for i in payload.items]
    try:
        return build_prep_plan(session, lines, payload.buffer_rate)
    except PrepPlanError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc


@router.post("/prep-plan", response_model=PrepPlanRead)
def calculate_prep_plan(payload: PrepPlanIn, session: SessionDep):
    return PrepPlanRead.model_validate(_build(session, payload))


@router.post(
    "/prep-plan/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def export_prep_plan(payload: PrepPlanExportIn, session: SessionDep):
    plan = _build(session, payload)
    slug = re.sub(r"[^a-z0-9]+", "-", fold(payload.name)).strip("-") or "plan"
    filename = f"badger-{slug}-{date.today():%Y%m%d}.csv"
    return Response(
        content=prep_plan_csv(plan).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
