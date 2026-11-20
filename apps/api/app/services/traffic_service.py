from app.schemas.traffic import PredictionCollection, TrafficCollection

TRAFFIC_UNAVAILABLE_REASON = (
    "Simulation-derived traffic metrics are unavailable until a simulation engine provides measurements."
)


def get_intersections() -> TrafficCollection:
    return TrafficCollection(available=False, items=[], reason=TRAFFIC_UNAVAILABLE_REASON)


def get_metrics() -> TrafficCollection:
    return TrafficCollection(available=False, items=[], reason=TRAFFIC_UNAVAILABLE_REASON)


def get_congestion() -> TrafficCollection:
    return TrafficCollection(available=False, items=[], reason=TRAFFIC_UNAVAILABLE_REASON)


def get_predictions() -> PredictionCollection:
    return PredictionCollection(
        available=False,
        items=[],
        reason="No traffic prediction model is configured.",
    )
