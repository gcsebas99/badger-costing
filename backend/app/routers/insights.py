"""Dashboard, impact simulator, CSV exports and database backups."""

from datetime import date

from fastapi import APIRouter, HTTPException, Response, status
from fastapi.responses import FileResponse

from app.db import SessionDep
from app.models.supply import Supply
from app.schemas.insights import BackupRead, DashboardRead, SimulationIn, SimulationRead
from app.services.backup import create_backup, find_backup, list_backups
from app.services.csv_export import products_csv, recipes_csv, supplies_csv
from app.services.dashboard import build_dashboard
from app.services.simulation import simulate

router = APIRouter(tags=["insights"])


@router.get("/dashboard", response_model=DashboardRead)
def dashboard(session: SessionDep):
    data = build_dashboard(session)
    return DashboardRead.model_validate(
        {
            **data.__dict__,
            "unpriced_supplies": [{"id": i, "name": n} for i, n in data.unpriced_supplies],
        }
    )


@router.post("/simulate", response_model=SimulationRead)
def simulate_price_change(payload: SimulationIn, session: SessionDep):
    """What-if: change supply costs by a % and see affected recipes and products."""
    changes = {c.supply_id: c.change_rate for c in payload.changes}
    if len(changes) != len(payload.changes):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Hay suministros repetidos.")
    for supply_id in changes:
        if session.get(Supply, supply_id) is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"El suministro #{supply_id} no existe."
            )
    return SimulationRead.model_validate(simulate(session, changes))


EXPORTS = {
    "suministros": supplies_csv,
    "recetas": recipes_csv,
    "productos": products_csv,
}


@router.get(
    "/export/{kind}.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}}},
)
def export_csv(kind: str, session: SessionDep):
    builder = EXPORTS.get(kind)
    if builder is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exportación desconocida.")
    filename = f"badger-{kind}-{date.today():%Y%m%d}.csv"
    return Response(
        content=builder(session).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/backups", response_model=list[BackupRead])
def backups():
    return [BackupRead.model_validate(b.__dict__) for b in list_backups()]


@router.post("/backups", response_model=BackupRead, status_code=status.HTTP_201_CREATED)
def make_backup():
    try:
        backup = create_backup()
    except FileNotFoundError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "No hay base de datos que respaldar."
        ) from exc
    return BackupRead.model_validate(backup.__dict__)


@router.get("/backups/{name}", response_class=FileResponse)
def download_backup(name: str):
    path = find_backup(name)
    if path is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Respaldo no encontrado.")
    return FileResponse(path, media_type="application/vnd.sqlite3", filename=name)
